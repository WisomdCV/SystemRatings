# CONTEXT-Projects

## Estado del documento

Este documento consolida el contexto funcional del modulo de Proyectos para su rediseno de roles, permisos y flujos.
No ejecuta cambios de codigo por si mismo.
Toda discrepancia entre codigo, reglas documentadas y criterio funcional debe confirmarse con el owner antes de implementarse.

Fecha de consolidacion: 2026-03-28

---

## 1. Contexto operativo global (confirmado)

### 1.1 Conexion de datos (Drizzle + Turso)

Hechos operativos:
- El entorno local usa .env con DATABASE_URL y LIBSQL_AUTH_TOKEN apuntando a Turso en la nube.
- Drizzle ORM traduce el codigo TypeScript a operaciones SQL en Turso.
- Comandos como npm run db:push y Drizzle Studio local afectan datos reales de produccion.
- Entorno local (Mac) y despliegue (Vercel) comparten la misma base de datos central.

Implicancia:
- Todo ajuste de schema/datos para Proyectos debe tratarse como cambio en vivo.

### 1.2 Conexion de despliegue (GitHub + Vercel)

Hechos operativos:
- GitHub es el repositorio fuente.
- Vercel despliega automaticamente al detectar commits nuevos en main.
- app.iiseunsa.com refleja la version desplegada mas reciente de main.
- Flujo activo: desarrollo local -> pruebas localhost -> push -> despliegue automatico.

---

## 2. Alcance de este contexto

Objetivo:
- Definir de forma ordenada como debe funcionar Proyectos para la siguiente etapa de implementacion.
- Separar con claridad: estado actual auditado vs funcionamiento objetivo.
- Mantener trazabilidad para futuras decisiones de implementacion.

Regla de trabajo:
- Ante disconcordancia o ambiguedad, no se asume una regla nueva; se consulta al owner.

---

## 3. Estado actual auditado (base de partida)

## 3.1 Permisos string activos hoy para Proyectos

Catalogo actual en permisos globales:
- project:create
- project:manage

## 3.2 Control actual local en Proyectos

Capacidades resueltas hoy con hardcode + flags locales:
- project_role.canCreateEvents
- project_role.canCreateTasks
- project_role.canViewAllAreaEvents
- project_area.membersCanCreateEvents
- umbrales de jerarquia local (ejemplo: >= 80 y < 70 en partes del flujo)
- project_role.permissions (text JSON) existe, pero no es eje real de autorizacion hoy

## 3.3 Dependencia con IISE General (estado actual)

- Proyectos usa entidades propias para roles/areas de proyecto.
- Algunas validaciones y visibilidad todavia se cruzan con permisos globales IISE (por ejemplo event:* en ciertos flujos de gestion de eventos).
- Vistas y listados actuales usan contexto de semestre activo en varios puntos.

---

## 4. Funcionamiento objetivo solicitado para Proyectos

## 4.1 Principio de independencia

Los roles y areas del modulo Proyectos deben ser independientes de areas y roles IISE General para la logica interna del proyecto.

Se mantiene:
- administracion global por admins IISE para configurar catalogos (roles/areas/permisos de Proyectos)
- reglas de visibilidad global solicitadas para ciertos perfiles IISE (ver seccion 10)

## 4.2 Roles base requeridos para Proyectos

Roles existentes requeridos para Proyectos:
1. Coordinador / Project Management
2. Director de proyecto
3. Subdirector de proyecto
4. Tesorero de proyecto
5. Director de cada area del proyecto
6. Miembro de un area del proyecto

Reglas solicitadas:
- El creador del proyecto adquiere automaticamente el rol Coordinador / Project Management.
- Director de proyecto, Subdirector de proyecto y Tesorero de proyecto son asignados por Coordinador/Project Management.
- Orden jerarquico objetivo: Director de proyecto y Subdirector de proyecto por encima de Coordinador / Project Management.
- La jerarquia de roles de Proyecto debe ser modificable desde administracion global por admins IISE General.
- Coordinador, Director de proyecto y Subdirector de proyecto comparten permisos completos de proyecto.
- Tesorero de proyecto no comparte permisos completos: queda acotado a tareas propias y a asignaciones desde roles superiores.
- Director de area y Miembro de area tienen capacidades acotadas por area y permisos configurables.

Excepcion funcional confirmada:
- Aunque Director/Subdirector queden por encima de Project Management en orden jerarquico, Project Management mantiene autoridad de asignacion para Director, Subdirector y Tesorero.
- Director y Subdirector pueden asignar directores de area.
- Esta excepcion prevalece sobre la regla jerarquica estricta para el flujo de conformacion inicial del equipo de proyecto.

## 4.3 Areas base requeridas para Proyectos

Areas actuales requeridas:
- Logistica
- Relaciones Publicas
- Marketing
- Academica
- Sistemas
- Mesa de recursos humanos

Reglas solicitadas:
- Mesa de recursos humanos funciona con miembros; no es obligatorio que tenga director.
- La gestion de areas, roles y permisos debe ser configurable desde panel administrativo (admins IISE General), evitando hardcode.

---

## 5. Requerimientos de configurabilidad de permisos (objetivo)

Objetivo de autorizacion:
- Migrar a un modelo configurable por permisos string para Proyectos, similar al enfoque aplicado en IISE General.
- Evitar reglas hardcodeadas por role name o numeros magicos como regla principal.

Inventario funcional solicitado para permisos de Proyectos:

### 5.1 Eventos de proyecto
- project:event_create_any
- project:event_create_own_area
- project:event_manage_any
- project:event_manage_own
- project:event_view_all

### 5.2 Tareas de proyecto
- project:task_create_any
- project:task_create_own_area
- project:task_manage_any
- project:task_manage_own
- project:task_assign
- project:task_update_status

### 5.3 Gestion de proyecto
- project:manage_settings
- project:manage_members
- project:manage_status
- project:delete

### 5.4 Visibilidad
- project:view_all_areas

Notas de alcance:
- Este inventario se usa como base de migracion funcional.
- Debe revisarse convivencia/transicion con project:create y project:manage actuales.
- El mantenimiento de catalogos globales de roles/areas/permisos de Proyectos debe quedar bajo admins IISE General.

---

## 6. Modelo de datos objetivo para Proyecto (entidad principal)

Cada proyecto debe soportar y mantener:
- Fecha de inicio.
- Fecha de finalizacion.
- Estado del proyecto modificable.
- Color representativo del proyecto (visual).

Regla solicitada:
- La fecha de finalizacion, por ahora, no dispara cierre automatico tecnico; es visual y editable.

Estado/modo solicitado para seguimiento:
- En planificacion
- En curso
- Completado

Regla de gestion:
- Cambios de estado dirigidos por roles superiores del proyecto.

---

## 7. Gestion de miembros e invitaciones (objetivo)

Flujo solicitado:
1. Proyecto inicia con el creador como Project Management.
2. Antes de integrar miembros, debe existir flujo de invitacion al proyecto.
3. El usuario invitado visualiza la invitacion en dashboard.
4. El usuario acepta invitacion.
5. Al aceptar, entra con rol default.
6. Luego Project Management ajusta rol y area final del miembro.

Requisito funcional:
- El flujo de invitacion debe mejorar organizacion y trazabilidad de incorporacion de miembros.

---

## 8. Eventos/meetings solo de Proyecto (objetivo)

## 8.1 Alcance de eventos de Proyecto

- Son eventos internos del proyecto.
- No son eventos IISE General.
- Deben funcionar de manera similar al sistema de eventos IISE, pero separados en dominio funcional de Proyecto.

## 8.2 Creacion de eventos por rol

Reglas solicitadas:
- Project Management, Director de proyecto y Subdirector de proyecto:
  - pueden generar eventos/meetings para todos los integrantes del proyecto.
  - pueden generar eventos de area de proyecto.
  - pueden generar eventos individuales o grupales.

- Tesorero de proyecto (caso especial):
  - no crea eventos generales de proyecto.
  - puede crear reuniones orientadas a directores de area.
  - este flujo mantiene asistencia activa.

- Director de area:
  - solo crea eventos para su propia area de proyecto.
  - puede incluir miembros de su area en dichos eventos.

- Mesa de recursos humanos (sin director obligatorio):
  - miembros del area pueden crear eventos para su propia area.
  - miembros del area pueden crear eventos individuales o grupales con usuarios del mismo proyecto.

## 8.3 Historial de eventos por proyecto

Requisito solicitado:
- Cada proyecto debe tener registro/historial de eventos (equivalente conceptual al historial en IISE General, pero en contexto de Proyecto).

---

## 9. Asistencia en eventos de Proyecto (objetivo)

Reglas solicitadas:
- Debe existir asistencia funcional en eventos generales de proyecto.
- Debe existir asistencia funcional en eventos por area de proyecto.
- No se toma asistencia en eventos individuales/grupales.
- Director de area puede tomar asistencia de su propia area.

---

## 10. Visibilidad UI de Proyectos (objetivo)

Reglas solicitadas:
- Miembros del area PMO a nivel IISE General pueden visualizar todos los proyectos.
- Usuarios no pertenecientes a MD en IISE General no visualizan proyectos salvo que hayan sido incluidos en alguno.
- En tarjetas/listados de proyectos se deben visualizar usuarios involucrados con iconos/avatar OAuth Google.

Nota de consistencia:
- La precedencia exacta de la regla PMO vs MD debe confirmarse si existe colision semantica en casos borde.

---

## 11. Persistencia multi-ciclo (objetivo)

Necesidad solicitada:
- Evaluar y soportar que proyectos, roles, permisos, eventos y usuarios del proyecto se mantengan independientes de cambios de ciclo.
- Un proyecto puede durar mas de un ciclo.
- El ciclo no debe reiniciar ni invalidar automaticamente la vida del proyecto.

---

## 12. Gestion de archivos por Proyecto (objetivo)

Se requiere un apartado "Archivos" por proyecto.

Formulario requerido por archivo/recurso:
- Nombre del archivo
- Descripcion (opcional)
- Links (multiples)
- Usuario que subio el recurso

Reglas de alcance por area:
- Director de area puede crear archivos solo para su area.
- Roles superiores pueden crear archivos generales o para un area especifica.

Requisito funcional:
- Registrar autor de subida y mantener trazabilidad por recurso.

---

## 13. Gestion de tareas tipo To Do (objetivo)

Requerimiento funcional general:
- Las tareas deben operar como To Do List.
- Tarea con fecha de inicio y fecha de fin.
- Tarea en dos alcances: general (sin area) o asociada a un area especifica del proyecto.
- Tareas creables/editables/eliminables segun permisos/rol.

Reglas de acceso solicitadas:
- Director de area puede generar tareas.
- Miembro no debe eliminar ni editar tareas por defecto solo por pertenecer a la tarea.
- Se debe evaluar gestion fina de permisos por creador, area, asignacion y rol.

Adjuntos de tarea solicitados:
- Capacidad de incluir recursos en tareas (archivos/logica similar a links/metadata).
- Incluir tags, links, descripciones.
- Registrar usuario que sube cada recurso.

---

## 14. Editar/eliminar proyecto y estado de proyecto (objetivo)

Se solicita incluir y validar:
- Opcion de editar proyecto.
- Opcion de eliminar proyecto.
- Opcion de solo visualizar cuando no tenga permisos de modificacion.
- Apartado de estado modificable del proyecto por roles superiores.

Estados solicitados como base:
- En planificacion
- En curso
- Completado

---

## 15. Admin de IISE General sobre configuracion de Proyectos

Requerimiento:
- Ajustar logica para modificar roles, areas y permisos de Proyecto de manera adecuada y configurable.
- Este apartado de configuracion corresponde a admins de IISE General.
- Ajustes de jerarquia y permisos de catalogo de Proyecto se administran desde este apartado.

Objetivo tecnico:
- Configuracion administrable y sin hardcodeos como regla principal.

---

## 16. Pendientes de confirmacion previa a implementacion

Se debe confirmar con owner antes de codificar cambios de logica cuando aplique:
1. Mapeo final y convivencia entre permisos nuevos de Proyecto y project:create/project:manage actuales.
2. Regla exacta de visibilidad global solicitada (PMO vs MD) y precedencia en casos cruzados.
3. Grado de separacion final entre eventos de Proyecto y validaciones heredadas de permisos globales de eventos IISE.
4. Modelo final de persistencia multi-ciclo para proyectos existentes y nuevos.
5. Modelo final de invitaciones (estados, caducidad, cancelacion, reasignacion de rol/area al aceptar).
6. Modelo final de "Archivos" de proyecto y de tareas (estructura de links multiples y trazabilidad de autor).
7. Regla operativa de asistencia para reuniones especiales creadas por Tesorero (quien toma asistencia y sobre que universo exacto).

---

## 17. Regla de consistencia de este documento

- Si codigo y documento divergen, se registra la diferencia explicitamente.
- No se ejecutan ajustes de reglas por deduccion.
- Toda regla nueva o ajuste de alcance se aplica solo tras confirmacion del owner.
