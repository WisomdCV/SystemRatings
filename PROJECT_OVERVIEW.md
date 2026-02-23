# Visión General del Proyecto

Este documento describe el stack tecnológico, la arquitectura del backend y la estructura organizativa del proyecto **Sistema de Calificaciones**.

---

## 🛠️ Stack Tecnológico

### Core & Framework
- **[Next.js 15](https://nextjs.org/)**: Framework de React con **App Router** para SSR y rutas.
- **[React 19](https://react.dev/)**: Biblioteca para interfaces de usuario.
- **[TypeScript](https://www.typescriptlang.org/)**: Tipado estático para desarrollo robusto.

### Base de Datos & ORM
- **[SQLite / LibSQL](https://www.sqlite.org/)**: Motor de BD ligero (compatible con Turso).
- **[Drizzle ORM](https://orm.drizzle.team/)**: ORM moderno con tipado seguro.
- **[Drizzle Kit](https://orm.drizzle.team/kit)**: Migraciones y Drizzle Studio.

### Estilos
- **[Tailwind CSS v4](https://tailwindcss.com/)**: Framework de utilidades CSS.
- **[TailAdmin](https://github.com/TailAdmin/free-nextjs-admin-dashboard/)**: Plantilla de dashboard.

### Autenticación & Seguridad
- **[NextAuth.js v5](https://authjs.dev/)**: Autenticación con Google OAuth.
- **[Zod](https://zod.dev/)**: Validación de schemas.

---

## 🏗️ Arquitectura del Backend

El proyecto implementa una **Service Layer Architecture** de 3 capas:

| Capa | Ubicación | Responsabilidad |
|:---|:---|:---|
| **Actions** | `src/server/actions/` | API pública, validación Zod, permisos |
| **Services** | `src/server/services/` | Lógica de negocio pura |
| **Data Access** | `src/server/data-access/` | Consultas Drizzle ORM |

```
Frontend (React) 
    ↓ "use server"
Server Actions → Validación + Permisos
    ↓
Services → Lógica de Negocio
    ↓
Data Access → Drizzle ORM → SQLite
```

---

## 📂 Estructura de Archivos

```
src/
├── app/                          # Rutas y páginas (App Router)
│   ├── api/                      # Endpoints REST (ej. /api/auth/*)
│   ├── (dashboard)/              # Páginas protegidas
│   └── (public)/                 # Páginas públicas
│
├── components/                   # Componentes React reutilizables
│   └── ui/                       # Componentes base (Button, Input, etc.)
│
├── db/                           # Capa de Base de Datos
│   ├── index.ts                  # Cliente Drizzle
│   ├── schema.ts                 # Definición de 21 tablas
│   └── seed.ts                   # Datos iniciales
│
├── lib/                          # Utilidades compartidas
│   ├── utils/                    # Helpers generales
│   └── validators/               # Schemas Zod (5 archivos)
│
├── server/                       # Backend Core
│   ├── auth.ts                   # Configuración NextAuth completa
│   ├── actions/                  # 9 archivos, 46 Server Actions
│   ├── services/                 # 3 servicios de negocio
│   └── data-access/              # 5 módulos DAO
│
└── types/                        # Definiciones TypeScript
    ├── index.ts                  # ActionResult<T>
    └── next-auth.d.ts            # Extensión de tipos NextAuth
```

---

## �️ Esquema de Base de Datos

El esquema contiene **21 tablas** organizadas en 7 dominios:

### 1. Usuarios y Autenticación
| Tabla | Propósito |
|:---|:---|
| `users` | Usuarios con roles, área, estado, categoría |
| `accounts` | Cuentas OAuth (Google) |
| `sessions` | Sesiones JWT activas |
| `verificationTokens` | Tokens de verificación |
| `positionHistory` | Historial de cargos (Auditoría) |

**Roles:** `DEV` · `PRESIDENT` · `DIRECTOR` · `SUBDIRECTOR` · `TREASURER` · `MEMBER` · `VOLUNTEER`

**Estados:** `ACTIVE` · `BANNED` · `SUSPENDED` · `WARNED`

**Categorías:** `TRAINEE` · `JUNIOR` · `SENIOR` · `MASTER`

### 2. Estructura Organizativa
| Tabla | Propósito |
|:---|:---|
| `areas` | Áreas de la organización |
| `semesters` | Ciclos con fechas y estado activo |

> **Nota:** Solo puede haber un semestre activo a la vez.

### 3. Eventos y Asistencia
| Tabla | Propósito |
|:---|:---|
| `events` | Eventos con Google Meet integrado |
| `attendanceRecords` | Registros de asistencia |

**Estados de asistencia:** `PRESENT` · `ABSENT` · `LATE` · `EXCUSED`

**Estados de justificación:** `NONE` · `PENDING` · `APPROVED` · `REJECTED` · `ACKNOWLEDGED`

### 4. Sistema de Calificaciones
| Tabla | Propósito |
|:---|:---|
| `gradeDefinitions` | Pilares de evaluación con pesos |
| `grades` | Notas asignadas por pilar |

> **Pesos duales:** Los pilares tienen `weight` (miembros) y `directorWeight` (directores).

### 5. Analítica (KPI)
| Tabla | Propósito |
|:---|:---|
| `kpiMonthlySummaries` | KPI mensual por usuario |
| `areaKpiSummaries` | Promedio y ranking por área |

### 6. Módulo de Proyectos
| Tabla | Propósito |
|:---|:---|
| `projects` | Proyectos con estado (PLANNING, ACTIVE, etc.) y prioridad |
| `projectMembers` | Miembros asignados a proyectos con sub-roles (DIRECTOR, COORDINATOR, MEMBER) |
| `projectTasks` | Tareas Kanban asociadas a proyectos con estados (TODO, IN_PROGRESS, DONE) |
| `taskAssignments` | Asignación de usuarios a tareas específicas |

### 7. Roles Personalizables (Custom Roles)
| Tabla | Propósito |
|:---|:---|
| `customRoles` | Definición de roles dinámicos (nombre, color, jerarquía) y del sistema |
| `customRolePermissions` | Relación de permisos granulares asignados a cada rol personalizado |
| `userCustomRoles` | Relación entre usuarios y los roles personalizados que se les asignan |

---

## 🎯 Server Actions

### attendance.actions.ts (8 funciones)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `getAttendanceSheetAction` | Lista de asistencia | `DIRECTOR+` |
| `saveAttendanceAction` | Guardar asistencia | `DIRECTOR+` |
| `getMyAttendanceHistoryAction` | Historial personal | Usuario |
| `submitJustificationAction` | Enviar justificación | Usuario |
| `reviewJustificationAction` | Aprobar/rechazar | `DIRECTOR+` |
| `getPendingJustificationsAction` | Listar pendientes | `DIRECTOR+` |
| `acknowledgeRejectionAction` | Reconocer rechazo | Propietario |

### event.actions.ts (3 funciones)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `createEventAction` | Crear evento + Meet | `DIRECTOR+` |
| `updateEventAction` | Actualizar evento | Creador/`PRESIDENT+` |
| `deleteEventAction` | Eliminar evento | Creador/`PRESIDENT+` |

### grading.actions.ts (1 función)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `upsertGradeAction` | Crear/actualizar nota + KPI | `PRESIDENT`/`DIRECTOR`/`DEV` |

### grading-view.actions.ts (1 función)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `getGradingSheetAction` | Tabla de calificaciones | `DIRECTOR+` (área), `PRESIDENT+` (todos) |

### pillar.actions.ts (4 funciones)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `getPillarsBySemesterAction` | Listar pilares | Autenticado |
| `upsertPillarAction` | Crear/editar pilar | `PRESIDENT`/`DEV` |
| `deletePillarAction` | Eliminar pilar | `PRESIDENT`/`DEV` |
| `clonePillarsAction` | Clonar entre ciclos | `PRESIDENT`/`DEV` |

### semester.actions.ts (3 funciones)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `getAllSemestersAction` | Listar ciclos | Autenticado |
| `createSemesterAction` | Crear ciclo | `PRESIDENT`/`DEV` |
| `toggleSemesterStatusAction` | Activar/desactivar | `PRESIDENT`/`DEV` |

### user.actions.ts (4 funciones)
| Action | Descripción | Permisos |
|:---|:---|:---|
| `getUsersAction` | Lista paginada | Autenticado |
| `updateUserRoleAction` | Promoción/traslado | `PRESIDENT`/`DEV` |
| `updateUserDataAction` | Actualizar datos | `PRESIDENT`/`DEV` |
| `moderateUserAction` | Moderación | `PRESIDENT`/`DEV` |

### project.actions.ts (14 funciones)
| Acción Principal | Descripción | Criterio de Permiso |
|:---|:---|:---|
| Todo CRUD y Tareas | Gestión Integral de Proyectos y Tareas | Delegado mediante `canManageProject` (Director/Coordinador) o SuperAdmin. Creadores o miembros según la tarea. |

### custom-role.actions.ts (8 funciones)
| Acción Principal | Descripción | Criterio de Permiso |
|:---|:---|:---|
| Todo CRUD y Asignaciones | Gestión integral de roles personalizados y bindings | Restringido exclusivamente a `admin:full` (`DEV`, `PRESIDENT`) |

---

## 🧠 Services

### kpi.service.ts
Cálculo de KPI ponderado con reglas de negocio:

```
KPI = Σ (NotaNormalizada × Peso/100)
NotaNormalizada = (NotaRaw / MaxScore) × 10
```

**Reglas:**
- Pilares `isDirectorOnly` se omiten para no-directores
- Directores usan `directorWeight` si está definido

### user.service.ts
| Servicio | Descripción |
|:---|:---|
| `getUsersListService` | Lista con filtros |
| `promoteUserService` | Cambio de rol con auditoría |
| `updateUserDataService` | Actualizar CUI, teléfono, categoría |
| `moderateUserService` | Aplicar estados de moderación |

### google-calendar.service.ts
| Función | API Google |
|:---|:---|
| `createGoogleMeeting` | `POST /calendars/primary/events` |
| `updateGoogleEvent` | `PATCH /calendars/primary/events/{id}` |
| `deleteGoogleEvent` | `DELETE /calendars/primary/events/{id}` |

---

## 🔐 Autenticación

**Configuración:** `src/server/auth.ts`

| Característica | Implementación |
|:---|:---|
| Proveedor | Google OAuth 2.0 |
| Adapter | Drizzle |
| Estrategia | JWT |
| Sesión | 7 días |

**Scopes de Google:**
```
openid email profile https://www.googleapis.com/auth/calendar.events
```

**Callbacks personalizados:**
- `signIn`: Bloquea usuarios `BANNED` o `SUSPENDED`
- `jwt`: Enriquece con `role`, `currentAreaId`, tokens de Google
- `session`: Expone datos al cliente

**Refresh automático:** El token se renueva cuando expira usando `refreshToken`.

---

## 📝 Validación (Zod)

| Archivo | Schemas |
|:---|:---|
| `event.ts` | `CreateEventSchema`, `UpdateEventSchema` |
| `grading.ts` | `UpsertGradeSchema` |
| `pillar.ts` | `UpsertPillarSchema` |
| `semester.ts` | `CreateSemesterSchema` |
| `user.ts` | `UpdateUserRoleSchema`, `UpdateUserProfileSchema`, `ModerateUserSchema` |

---

## 📝 Scripts Disponibles

| Script | Descripción |
|:---|:---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run db:push` | Sincronizar esquema |
| `npm run db:seed` | Insertar datos iniciales |
| `npm run db:studio` | Abrir Drizzle Studio |

---

## 🚀 Escalabilidad y Despliegue

### Base de Datos (Turso/libSQL)
- Replicación en el borde (Edge Replication)
- Separación de almacenamiento y cómputo
- Drizzle ORM con overhead casi nulo

### Frontend/Backend (Next.js)
- Server Components para reducir carga cliente
- Soporte nativo para caché
- Arquitectura Serverless-ready

### Compatibilidad con Vercel
- 100% compatible
- Server Actions como funciones serverless
- CDN global para contenido estático

### Variables de Entorno Requeridas
```env
DATABASE_URL=           # URL de LibSQL/Turso
LIBSQL_AUTH_TOKEN=      # Token si es remoto
GOOGLE_CLIENT_ID=       # OAuth Client ID
GOOGLE_CLIENT_SECRET=   # OAuth Client Secret
AUTH_SECRET=            # Secret para NextAuth
```

---

## 🛠️ Guía de Extensión

### Agregar Nueva Tabla
1. Definir en `src/db/schema.ts`
2. Ejecutar `npm run db:push`
3. Tipos se infieren automáticamente

### Agregar Nueva Funcionalidad
1. **DAO:** Crear funciones en `src/server/data-access/`
2. **Servicio:** Lógica de negocio en `src/server/services/`
3. **Action:** API pública en `src/server/actions/`
4. **Validador:** Schema Zod en `src/lib/validators/`

### Agregar Nueva Página
- Crear carpeta en `src/app/` con `page.tsx`
- Usar layouts anidados para estructuras compartidas

> **Importante:** Nunca escribir lógica de negocio directamente en Actions. Siempre delegar a Services o DAO.
