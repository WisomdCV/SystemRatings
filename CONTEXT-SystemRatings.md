# CONTEXT-SystemRatings

## Estado del documento

Este documento es de contexto vivo y actualizable.
Consolida el estado actual del proyecto y, cuando se confirme por negocio, puede incluir alcance funcional objetivo pendiente de implementacion.
No incluye recomendaciones ni propuestas de cambio.

Fecha de consolidacion: 2026-03-28

---
### 1.1 Conexion de datos (Drizzle + Turso)

Hechos operativos confirmados:
- El entorno local usa .env con DATABASE_URL y LIBSQL_AUTH_TOKEN apuntando a Turso en la nube.
- Drizzle ORM traduce el codigo TypeScript a operaciones SQL en Turso.
- Comandos como npm run db:push y el uso de Drizzle Studio local impactan datos reales de produccion.
- Entorno local (Mac) y despliegue (Vercel) comparten la misma base de datos central.

Implicancia operativa:
- Cualquier cambio de schema o datos debe tratarse como cambio en vivo.
---
### 1.2 Conexion de despliegue (GitHub + Vercel)

Hechos operativos confirmados:
- GitHub es el repositorio fuente.
- Vercel esta conectado al repo y despliega automaticamente tras detectar commit nuevo en main.
- app.iiseunsa.com refleja la version mas reciente desplegada desde main.
- Flujo actual: desarrollo local -> pruebas localhost -> push -> despliegue automatico.

---

## 1. Objetivo

Guia de contexto para agentes IA sobre:
- arquitectura backend
- autenticacion y sesion
- permisos y jerarquia de roles
- reglas aplicadas por modulo
- matriz de capacidades por rol
- diferencias observadas entre componentes

Fuentes principales de verdad:
- ARCHITECTURE.md
- PROJECT_OVERVIEW.md
- src/lib/permissions.ts
- src/server/auth.ts
- src/auth.config.ts
- src/server/actions/*
- src/server/services/*
- src/server/data-access/*
- src/db/schema.ts

---

## 2. Arquitectura backend activa

Patron en uso:
- app (pages/layouts) -> server actions
- server/actions -> auth, permisos, validacion y orquestacion
- server/services -> reglas de negocio
- server/data-access -> queries ORM
- db/schema -> tablas y relaciones

Ejemplos:
- Eventos:
  - src/server/actions/event.actions.ts
  - src/server/services/event-permissions.service.ts
  - src/server/data-access/events.ts
- Usuarios:
  - src/server/actions/user.actions.ts
  - src/server/services/user.service.ts
  - src/server/data-access/users.ts

---

## 3. Auth y proteccion de rutas

## 3.1 Auth de servidor
Archivo: src/server/auth.ts

Hechos implementados:
1. Login Google OAuth con scope calendar.events.
2. Primer usuario puede ser promovido automaticamente a DEV.
3. Nuevos VOLUNTEER ACTIVE pasan a PENDING_APPROVAL.
4. BANNED bloquea acceso.
5. SUSPENDED bloquea acceso segun fecha de suspension.
6. Token guarda role, status, currentAreaId y customPermissions.
7. Refresco periodico desde DB cada 10 segundos.
8. Session propaga customPermissions para guards.

## 3.2 authFresh
Archivo: src/server/auth-fresh.ts

Hechos implementados:
- relee role/status/currentAreaId desde DB
- relee customPermissions en cada llamada
- calcula roleChanged comparando loginRole vs role actual

Uso real:
- layouts/pages protegidos usan authFresh para evitar cache stale de permisos.

## 3.3 Middleware y authorized
Archivos:
- src/middleware.ts
- src/auth.config.ts
- auth.config.ts (raiz)

Hechos implementados:
- middleware usa src/auth.config.ts
- /dashboard requiere login
- /admin requiere admin:access
- existe ademas auth.config.ts en raiz con authorized simplificado
- src/server/auth.ts importa authConfig desde raiz y lo extiende

Estado de configuracion:
- hay dos auth config coexistiendo con usos distintos.

---

## 4. Modelo de permisos

Archivo base: src/lib/permissions.ts

Capas implementadas:
1. Layer 1: permisos por defecto por rol del sistema
2. Layer 2: permisos por custom roles
3. Layer 3: permisos por area

Resolucion central:
- hasPermission(role, permission, customPermissions)

Construccion de customPermissions:
- src/server/data-access/custom-roles.ts
  - getCustomPermissionsForUser
  - getAreaPermissionsForUser
  - getAllExtraPermissionsForUser

Persistencia asociada:
- area_permission
- custom_role_permission
- user_custom_role
(tablas en src/db/schema.ts)

Compatibilidad legacy activa en hasPermission:
- user:manage <-> user:approve/user:manage_role/user:manage_data/user:moderate
- admin:full <-> admin:roles/admin:audit
- dashboard:analytics <-> dashboard:area_comparison/dashboard:leadership_view

---

## 5. Roles y jerarquia

## 5.1 Roles del sistema
Definidos en src/lib/permissions.ts:
- DEV
- PRESIDENT
- VICEPRESIDENT
- SECRETARY
- DIRECTOR
- SUBDIRECTOR
- TREASURER
- MEMBER
- VOLUNTEER

## 5.2 Jerarquia de gestion de usuarios
Definida en src/lib/permissions.ts:
- DEV > PRESIDENT > VICEPRESIDENT > SECRETARY > TREASURER > DIRECTOR > SUBDIRECTOR > MEMBER > VOLUNTEER

Reglas implementadas:
- canManageUserByHierarchy: actor solo gestiona roles inferiores
- canAssignRoleByHierarchy: actor solo asigna roles inferiores
- solo DEV puede asignar DEV

Estado confirmado por negocio:
- esta jerarquia se mantiene como correcta.

---

## 6. Catalogo de permisos vigente

Fuente: const PERMISSIONS en src/lib/permissions.ts

Dominios:
- event:*
- attendance:*
- grade:*
- pillar:manage
- semester:manage
- user:*
- area:manage
- project:*
- dashboard:*
- admin:*

---

## 7. Modulos y controles aplicados

## 7.1 Aprobaciones
Archivos:
- src/server/actions/approval.actions.ts
- src/app/admin/approvals/page.tsx

Controles aplicados:
- requiere user:approve
- universo pendiente: PENDING_APPROVAL o VOLUNTEER+ACTIVE
- approve/reject validan jerarquia sobre target con canManageUserByHierarchy

## 7.2 Gestion de usuarios
Archivos:
- src/server/actions/user.actions.ts
- src/server/services/user.service.ts
- src/server/data-access/users.ts
- src/app/admin/users/page.tsx

Controles aplicados:
- acceso a gestion: al menos uno entre user:manage_role, user:manage_data, user:moderate
- update role/area: user:manage_role + jerarquia
- update data: user:manage_data + jerarquia
- moderacion: user:moderate + jerarquia
- listado excluye role DEV y status PENDING_APPROVAL

## 7.3 Semestres y setup
Archivos:
- src/server/actions/semester.actions.ts
- src/app/setup/page.tsx
- src/app/admin/setup-wizard/page.tsx

Controles aplicados:
- create/toggle semester usan semester:manage
- excepcion activa: primer semestre permite creacion sin semester:manage
- activar/cerrar ciclo degrada roles ciclicos a MEMBER:
  - VICEPRESIDENT, SECRETARY, DIRECTOR, SUBDIRECTOR, TREASURER

Estado acordado:
- excepcion de primer semestre se mantiene por ahora.

## 7.4 Pilares
Archivos:
- src/server/actions/pillar.actions.ts
- src/app/admin/cycles/[id]/pillars/page.tsx

Controles aplicados:
- mutaciones requieren pillar:manage
- validacion de pesos evita exceder 100 para miembros/directores
- delete/clone verifica relacion con grades

## 7.5 Areas
Archivos:
- src/server/actions/area.actions.ts
- src/app/admin/areas/page.tsx

Controles aplicados:
- gestion requiere area:manage
- delete area bloquea si existe dependencia en users/events/history/kpi
- updateAreaPermissionsAction reemplaza permisos del area

Validacion actual de keys en area:
- schemas de area usan permissions como string[]

## 7.6 Eventos
Archivos:
- src/server/actions/event.actions.ts
- src/server/services/event-permissions.service.ts
- src/server/services/event-visibility.service.ts
- src/app/dashboard/agenda/page.tsx
- src/app/admin/events/page.tsx
- src/app/dashboard/page.tsx

Controles aplicados:
- create IISE usa canCreateIISEEvent
- create PROJECT usa canCreateProjectEvent
- update/delete usa canManageEvent
- INDIVIDUAL_GROUP normaliza targets y no trackea asistencia
- visibilidad cliente se calcula con prepareEventsForClient

## 7.7 Asistencia
Archivos:
- src/server/actions/attendance.actions.ts
- src/server/data-access/attendance.ts
- src/app/admin/events/[id]/attendance/page.tsx
- src/app/dashboard/attendance/[id]/page.tsx

Controles aplicados:
- take_all permite global
- take_own_area exige targetArea == userArea y canManageEvent
- review_all permite global
- review_own_area exige targetArea == userArea y canManageEvent
- tracksAttendance false bloquea hoja y guardado

Elegibilidad de attendance sheet en DAO:
- IISE general: ACTIVE no DEV
- area de liderazgo: DIRECTOR/SUBDIRECTOR/TREASURER
- PROJECT: miembros del proyecto, filtrables por area de proyecto
- creador no DEV se agrega a elegibles si no estaba

## 7.8 Calificaciones
Archivos:
- src/server/actions/grading.actions.ts
- src/server/actions/grading-view.actions.ts
- src/app/dashboard/management/grades/page.tsx

Controles aplicados:
- asignar nota requiere grade:assign_own_area o grade:assign_all
- sin assign_all solo puede calificar su area
- target DEV bloqueado
- vista requiere grade:view_own_area o grade:view_all
- hoja filtra usuarios ACTIVE no DEV

## 7.9 Dashboard analytics
Archivos:
- src/server/actions/area-comparison.actions.ts
- src/app/dashboard/areas/page.tsx

Controles aplicados:
- todos los endpoints analytics usan canAccessDashboardAnalytics
- /dashboard/areas requiere dashboard:analytics

## 7.10 Proyectos y tareas
Archivos:
- src/server/actions/project.actions.ts
- src/app/dashboard/projects/page.tsx
- src/app/dashboard/projects/[id]/page.tsx

Controles aplicados:
- create project: project:create
- manage project: project:manage o jerarquia local >= 80
- create task: requiere membresia o isSystemAdmin
- update status task: asignado o manager
- task scope: la tarea puede ser general (sin area) o de un area especifica de proyecto

Actualizaciones de alcance confirmadas para Proyectos (pendientes de implementacion):
- Orden jerarquico objetivo en proyecto: Director de proyecto y Subdirector de proyecto por encima de Project Management.
- Excepcion funcional confirmada: Project Management mantiene autoridad de asignacion para Director, Subdirector y Tesorero aunque Director/Subdirector esten por encima en orden jerarquico.
- Director de proyecto, Subdirector de proyecto y Project Management mantienen permisos completos de proyecto; cambia el orden jerarquico, no el alcance funcional esperado.
- Tesorero de proyecto queda con alcance restringido: tareas propias y asignaciones desde roles superiores.
- Tesorero de proyecto no crea eventos generales de proyecto; caso especial: puede crear reuniones con directores de area (con asistencia activa).
- Miembro/asignado a tarea puede actualizar estado y adjuntar links solo en tareas a las que pertenece.
- Las tareas de proyecto se mantienen en dos alcances funcionales: general y por area especifica.

## 7.11 Roles personalizados
Archivos:
- src/server/actions/custom-role.actions.ts
- src/server/data-access/custom-roles.ts
- src/app/admin/roles/page.tsx

Controles aplicados:
- create/update/delete/assign/remove: admin:roles
- getCustomRolesAction/getCustomRoleByIdAction/getUserCustomRolesAction: autenticado

Estado acordado:
- exposicion de catalogos para autenticados se mantiene por ahora.

## 7.12 Project settings global
Archivos:
- src/server/actions/project-settings.actions.ts
- src/app/admin/project-settings/page.tsx

Controles aplicados:
- mutaciones: admin:roles
- lecturas getProjectAreasAction/getProjectRolesAction: autenticado

---

## 8. Matriz por rol (defaults de sistema)

La matriz usa solo PERMISSIONS por rol base.
Capacidad real final puede aumentar por customPermissions.

Leyenda:
- SI: permitido por default
- NO: no permitido por default
- OWN: alcance propio

| Rol | admin:access | admin:audit | admin:roles | user:* | semester:manage | pillar:manage | area:manage | event:* | attendance:* | grade:* | dashboard:analytics | project:create | project:manage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DEV | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI |
| PRESIDENT | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI |
| VICEPRESIDENT | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI |
| SECRETARY | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI |
| TREASURER | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI |
| DIRECTOR | SI | NO | NO | NO | NO | NO | NO | OWN | OWN | NO | SI | SI | NO |
| SUBDIRECTOR | SI | NO | NO | NO | NO | NO | NO | OWN | OWN | NO | SI | NO | NO |
| MEMBER | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| VOLUNTEER | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |

Fuente:
- src/lib/permissions.ts

---

## 9. Seeds que afectan permisos efectivos

Archivo: src/db/seed.ts

Hechos cargados en seed:
- area TH recibe permisos amplios de eventos/asistencia/calificaciones
- area MD recibe esos permisos + admin/user/dashboard

En MD se cargan:
- admin:access
- admin:audit
- admin:roles
- dashboard:analytics
- user:approve
- user:manage_role
- user:manage_data
- user:moderate

---

## 10. Diferencias observadas entre componentes (hechos)

1. Evaluacion de project:manage sin customPermissions en dos paginas.
Archivos:
- src/app/admin/events/page.tsx
- src/app/dashboard/projects/[id]/page.tsx

2. assignTaskAction llama canManageProject sin customPermissions.
Archivo:
- src/server/actions/project.actions.ts

3. isAdmin(role) usa admin:full por rol base.
Archivos:
- src/lib/permissions.ts
- uso en src/server/actions/project.actions.ts

4. Paginas de asistencia consultan metadato de evento antes de action con guard.
Archivos:
- src/app/admin/events/[id]/attendance/page.tsx
- src/app/dashboard/attendance/[id]/page.tsx

5. Coexisten dos auth config con usos distintos.
Archivos:
- auth.config.ts
- src/auth.config.ts
- src/server/auth.ts
- src/middleware.ts

6. Jerarquia de roles en seed de proyecto prioriza actualmente Coordinador/Project Management por encima de Director y Subdirector.
Archivo:
- src/db/seed.ts

7. Restriccion funcional especifica para Tesorero (solo tareas propias + reuniones especiales con directores de area) no esta expresada como regla dedicada en el motor actual.
Archivos:
- src/server/actions/project.actions.ts
- src/server/services/event-permissions.service.ts

8. Adjuntos tipo links por tarea para miembro/asignado no existen hoy como flujo dedicado en tareas.
Archivos:
- src/server/actions/project.actions.ts
- src/db/schema.ts

---

## 11. Decisiones de alcance confirmadas (vigentes)

1. Jerarquia actual con SECRETARY y TREASURER por encima de DIRECTOR/SUBDIRECTOR se mantiene.
2. Excepcion de primer semestre se mantiene.
3. Exposicion de catalogos de roles/areas para autenticados se mantiene.
4. Entregable final diferido: formato pregunta-respuesta por modulo.
5. En modulo Proyectos, Director de proyecto y Subdirector de proyecto quedan por encima de Project Management en orden jerarquico.
6. En modulo Proyectos, Project Management mantiene excepcion funcional para asignar Director, Subdirector y Tesorero aunque Director/Subdirector esten por encima en orden jerarquico.
7. En modulo Proyectos, Director de proyecto, Subdirector de proyecto y Project Management conservan permisos completos; el cambio confirmado es de orden jerarquico.
8. En modulo Proyectos, Tesorero queda restringido a tareas propias y asignaciones de roles superiores; no crea eventos generales de proyecto.
9. En modulo Proyectos, Tesorero mantiene caso especial para reuniones con directores de area, con asistencia activa.
10. En modulo Proyectos, miembro/asignado a tarea puede actualizar estado y adjuntar links solo en tareas a las que pertenece.
11. En modulo Proyectos, las tareas pueden ser generales o asociadas a un area especifica.

---

## 12. Indice rapido de archivos criticos

Permisos y jerarquia:
- src/lib/permissions.ts

Auth y sesion:
- src/server/auth.ts
- src/server/auth-fresh.ts
- src/auth.config.ts
- auth.config.ts
- src/middleware.ts

Permisos extra y schema:
- src/db/schema.ts
- src/server/data-access/custom-roles.ts
- src/db/seed.ts

Actions principales:
- src/server/actions/approval.actions.ts
- src/server/actions/user.actions.ts
- src/server/actions/semester.actions.ts
- src/server/actions/pillar.actions.ts
- src/server/actions/area.actions.ts
- src/server/actions/event.actions.ts
- src/server/actions/attendance.actions.ts
- src/server/actions/grading.actions.ts
- src/server/actions/grading-view.actions.ts
- src/server/actions/area-comparison.actions.ts
- src/server/actions/project.actions.ts
- src/server/actions/custom-role.actions.ts
- src/server/actions/project-settings.actions.ts
- src/server/actions/audit.actions.ts

Servicios clave:
- src/server/services/event-permissions.service.ts
- src/server/services/event-visibility.service.ts
- src/server/services/user.service.ts

Rutas con guards relevantes:
- src/app/dashboard/layout.tsx
- src/app/admin/page.tsx
- src/app/admin/events/page.tsx
- src/app/dashboard/agenda/page.tsx
- src/app/dashboard/projects/[id]/page.tsx
- src/app/dashboard/areas/page.tsx
- src/app/admin/users/page.tsx
- src/app/admin/approvals/page.tsx
- src/app/admin/roles/page.tsx
- src/app/admin/audit/page.tsx
- src/app/setup/page.tsx
- src/app/pending-approval/page.tsx
