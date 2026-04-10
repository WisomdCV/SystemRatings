import { sqliteTable, text, integer, real, primaryKey, unique, foreignKey, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccount } from "next-auth/adapters";

// =============================================================================
// 1. USUARIOS Y AUTENTICACIÓN (CORE + GOOGLE OAUTH)
// =============================================================================

export const users = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // --- DATOS DE IDENTIDAD (Google OAuth) ---
  name: text("name"),            // Nombre completo (Display Name)
  firstName: text("first_name"), // Para "Nombres" (given_name)
  lastName: text("last_name"),   // Para "Apellidos" (family_name)
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),          // Avatar de Google

  // --- DATOS DE LA ORGANIZACIÓN ---
  cui: text("cui"),
  phone: text("phone"),

  // --- JERARQUÍA ACTUAL ---
  currentAreaId: text("area_id").references(() => areas.id),
  // Roles: 'DEV', 'PRESIDENT', 'VICEPRESIDENT', 'SECRETARY', 'DIRECTOR', 'SUBDIRECTOR', 'TREASURER', 'MEMBER', 'VOLUNTEER'
  role: text("role").default("VOLUNTEER"),

  // --- ESTADOS Y ANTIGÜEDAD ---
  category: text("category").default("TRAINEE"), // 'TRAINEE', 'JUNIOR', 'SENIOR', 'MASTER'
  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(unixepoch())`),

  // --- MODERACIÓN ---
  status: text("status").default("ACTIVE"), // 'ACTIVE', 'BANNED', 'SUSPENDED', 'WARNED'
  moderationReason: text("moderation_reason"),
  suspendedUntil: integer("suspended_until", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const positionHistory = sqliteTable("position_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  areaId: text("area_id").references(() => areas.id),
  role: text("role"),

  semesterId: text("semester_id").references(() => semesters.id),
  reason: text("reason"), // Motivo del cambio (Audit)
  startDate: integer("start_date", { mode: "timestamp" }).default(sql`(unixepoch())`),
  endDate: integer("end_date", { mode: "timestamp" }),
});

// --- Tablas Requeridas por Auth.js ---

export const accounts = sqliteTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccount["type"]>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

// =============================================================================
// 2. ESTRUCTURA ORGANIZATIVA (CATÁLOGOS)
// =============================================================================

export const areas = sqliteTable("area", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  code: text("code").unique(),
  description: text("description"),
  color: text("color").default("#6366f1"), // Hex color for UI badges/charts
  isLeadershipArea: integer("is_leadership_area", { mode: "boolean" }).default(false),
});

// Area-level permissions: any member of this area inherits these permissions
export const areaPermissions = sqliteTable("area_permission", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  areaId: text("area_id").references(() => areas.id, { onDelete: "cascade" }).notNull(),
  permission: text("permission").notNull(), // e.g. "event:create_general", "attendance:take_all"
});

export const semesters = sqliteTable("semester", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).default(false),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
});

export const semesterAreas = sqliteTable("semester_area", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  semesterId: text("semester_id").references(() => semesters.id, { onDelete: "cascade" }).notNull(),
  areaId: text("area_id").references(() => areas.id, { onDelete: "cascade" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// =============================================================================
// 3. OPERACIONES: EVENTOS Y ASISTENCIA
// =============================================================================

export const events = sqliteTable("event", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  semesterId: text("semester_id").references(() => semesters.id).notNull(),
  createdById: text("created_by_id").references(() => users.id),

  title: text("title").notNull(),
  description: text("description"),

  // Scope & Type (Events v2)
  eventScope: text("event_scope").notNull().default("IISE"),          // "IISE" | "PROJECT"
  eventType: text("event_type").notNull().default("GENERAL"),          // "GENERAL" | "AREA" | "INDIVIDUAL_GROUP" | "TREASURY_SPECIAL"

  // IISE target
  targetAreaId: text("target_area_id").references(() => areas.id),

  // PROJECT target
  projectId: text("project_id").references(() => projects.id),
  // Explicit project-cycle linkage for cross-cycle traceability
  projectCycleId: text("project_cycle_id").references(() => projectCycles.id),
  targetProjectAreaId: text("target_project_area_id").references(() => projectAreas.id),

  date: integer("date", { mode: "timestamp" }).notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),

  isVirtual: integer("is_virtual", { mode: "boolean" }).default(false),
  meetLink: text("meet_link"),
  googleEventId: text("google_event_id"),

  // Attendance tracking (false for INDIVIDUAL_GROUP events)
  tracksAttendance: integer("tracks_attendance", { mode: "boolean" }).default(true),

  status: text("status").default("SCHEDULED"),

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const attendanceRecords = sqliteTable("attendance_record", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  status: text("status").notNull(),

  justificationStatus: text("justification_status").default("NONE"),
  justificationReason: text("justification_reason"),
  justificationLink: text("justification_link"),
  justificationNote: text("justification_note"),

  adminFeedback: text("admin_feedback"),
  reviewedById: text("reviewed_by_id").references(() => users.id),
});

// Event Invitees (for invitee-targeted events, e.g. INDIVIDUAL_GROUP/TREASURY_SPECIAL)
export const eventInvitees = sqliteTable("event_invitee", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("PENDING"), // PENDING | ACCEPTED | DECLINED
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  uniqueInvite: unique().on(table.eventId, table.userId),
}));

// =============================================================================
// 4. ACADÉMICO: NOTAS MANUALES
// =============================================================================

export const gradeDefinitions = sqliteTable("grade_definition", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  semesterId: text("semester_id").references(() => semesters.id).notNull(),

  name: text("name").notNull(),
  weight: real("weight").notNull(),

  // New column for dual-weight logic (Area: Member 30% vs Director 15%)
  directorWeight: real("director_weight"),

  maxScore: real("max_score").default(5),
  isDirectorOnly: integer("is_director_only", { mode: "boolean" }).default(false),
});

export const grades = sqliteTable("grade", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  definitionId: text("definition_id").references(() => gradeDefinitions.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  assignedById: text("assigned_by_id").references(() => users.id),

  score: real("score").notNull(),
  feedback: text("feedback"),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// =============================================================================
// 5. ANALÍTICA: TABLAS DE RESUMEN
// =============================================================================

export const kpiMonthlySummaries = sqliteTable("kpi_monthly_summary", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  semesterId: text("semester_id").references(() => semesters.id).notNull(),

  month: integer("month").notNull(),
  year: integer("year").notNull(),

  finalKpiScore: real("final_kpi_score").default(0),
  attendanceScore: real("attendance_score").default(0),

  appliedRole: text("applied_role"), // Snapshot of role at calculation time (MEMBER vs DIRECTOR)

  lastUpdated: integer("last_updated", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const areaKpiSummaries = sqliteTable("area_kpi_summary", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  areaId: text("area_id").references(() => areas.id).notNull(),
  semesterId: text("semester_id").references(() => semesters.id).notNull(),

  month: integer("month").notNull(),
  year: integer("year").notNull(),

  averageKpi: real("average_kpi").default(0),
  rankingPosition: integer("ranking_position"),
});

// =============================================================================
// 6. MÓDULO DE PROYECTOS (AVANZADO)
// =============================================================================

export const projects = sqliteTable("project", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  semesterId: text("semester_id").references(() => semesters.id).notNull(), // Origin cycle (kept for backward compatibility).
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1").notNull(),
  // PLANNING | ACTIVE | PAUSED | COMPLETED | CANCELLED
  status: text("status").default("PLANNING").notNull(),
  // LOW | MEDIUM | HIGH | CRITICAL
  priority: text("priority").default("MEDIUM").notNull(),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  startDate: integer("start_date", { mode: "timestamp" }),
  deadline: integer("deadline", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const projectCycles = sqliteTable("project_cycle", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  semesterId: text("semester_id").references(() => semesters.id).notNull(),
  // ACTIVE | EXTENDED | ARCHIVED
  status: text("status").default("ACTIVE").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  extendedFromCycleId: text("extended_from_cycle_id"),
  extendedById: text("extended_by_id").references(() => users.id),
  notes: text("notes"),
}, (table) => ({
  uniqueProjectSemester: unique().on(table.projectId, table.semesterId),
  idxProject: index("idx_cycle_project").on(table.projectId),
  // Self-reference: links to the cycle this one was extended from
  cycleLineageRef: foreignKey({ columns: [table.extendedFromCycleId], foreignColumns: [table.id] })
    .onDelete("set null"),
}));

export const projectAreas = sqliteTable("project_area", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#94a3b8"), // Slate-400 Default
  position: integer("position").default(0),
  isSystem: integer("is_system", { mode: "boolean" }).default(false),
});

export const projectRoles = sqliteTable("project_role", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  hierarchyLevel: integer("hierarchy_level").default(10).notNull(), // Authority level: who can modify/assign whom
  displayOrder: integer("display_order").default(0).notNull(), // Visual order only (0 = first)
  color: text("color").default("#6366f1"), // Added for UI Role badges
  isSystem: integer("is_system", { mode: "boolean" }).default(false),
});

export const projectMembers = sqliteTable("project_member", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Novedad: En lugar de texto duro, usamos FKs al nuevo sistema local
  projectRoleId: text("project_role_id").references(() => projectRoles.id).notNull(),
  projectAreaId: text("project_area_id").references(() => projectAreas.id, { onDelete: "set null" }), // Nulo significa "Coordinador General o sin área"

  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  uniqueProjectUser: unique().on(table.projectId, table.userId),
}));

export const projectInvitations = sqliteTable("project_invitation", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Snapshot of the proposed assignment at invite time.
  projectRoleId: text("project_role_id").references(() => projectRoles.id).notNull(),
  projectAreaId: text("project_area_id").references(() => projectAreas.id, { onDelete: "set null" }),

  invitedById: text("invited_by_id").references(() => users.id).notNull(),

  // PENDING | ACCEPTED | REJECTED | CANCELLED | EXPIRED
  status: text("status").default("PENDING").notNull(),

  message: text("message"),
  rejectionReason: text("rejection_reason"),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  respondedAt: integer("responded_at", { mode: "timestamp" }),
}, (table) => ({
  idxProjectUser: index("idx_invitation_project_user").on(table.projectId, table.userId),
}));

export const projectTasks = sqliteTable("project_task", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  projectAreaId: text("project_area_id").references(() => projectAreas.id, { onDelete: "set null" }), // Nulo significa area general
  title: text("title").notNull(),
  description: text("description"),
  // TODO | IN_PROGRESS | REVIEW | DONE | BLOCKED
  status: text("status").default("TODO").notNull(),
  // LOW | MEDIUM | HIGH
  priority: text("priority").default("MEDIUM").notNull(),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  startDate: integer("start_date", { mode: "timestamp" }),
  dueDate: integer("due_date", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  position: integer("position").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  idxProject: index("idx_task_project").on(table.projectId),
}));

export const taskAssignments = sqliteTable("task_assignment", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => projectTasks.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  assignedAt: integer("assigned_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  uniqueTaskUser: unique().on(table.taskId, table.userId),
}));

export const taskComments = sqliteTable("task_comment", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => projectTasks.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  parentId: text("parent_id"),
  isEdited: integer("is_edited", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  idxTask: index("idx_comment_task").on(table.taskId),
  parentRef: foreignKey({ columns: [table.parentId], foreignColumns: [table.id] })
    .onDelete("cascade"),
}));

export const projectRolePermissions = sqliteTable("project_role_permission", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectRoleId: text("project_role_id").references(() => projectRoles.id, { onDelete: "cascade" }).notNull(),
  permission: text("permission").notNull(),
}, (table) => ({
  idxRole: index("idx_role_perm_role").on(table.projectRoleId),
}));

// ─── Project Resource Categories (Hybrid: Global + Per-Project) ─────────────
export const projectResourceCategories = sqliteTable("project_resource_category", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color").default("#6366f1"),
  position: integer("position").default(0),

  // NULL = global category; set = project custom category
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),

  isSystem: integer("is_system", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// ─── Project Resources (Link-only resources) ───────────────────────────────
export const projectResources = sqliteTable("project_resource", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  projectAreaId: text("project_area_id").references(() => projectAreas.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => projectTasks.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => projectResourceCategories.id, { onDelete: "set null" }),

  name: text("name").notNull(),
  description: text("description"),

  createdById: text("created_by_id").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  idxProject: index("idx_resource_project").on(table.projectId),
}));

// ─── Project Resource Links (children of a resource) ───────────────────────
export const projectResourceLinks = sqliteTable("project_resource_link", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  resourceId: text("resource_id").references(() => projectResources.id, { onDelete: "cascade" }).notNull(),

  url: text("url").notNull(),
  previewUrl: text("preview_url"),
  label: text("label"),
  domain: text("domain"),

  // ACTIVE | INACCESSIBLE | RESTRICTED | UNKNOWN
  linkStatus: text("link_status").default("UNKNOWN").notNull(),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),

  addedById: text("added_by_id").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => ({
  idxResource: index("idx_link_resource").on(table.resourceId),
}));

// =============================================================================
// 7. ROLES PERSONALIZABLES (CUSTOM ROLES)
// =============================================================================

export const customRoles = sqliteTable("custom_role", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").default("#6366f1"), // Hex color for UI badges
  position: integer("position").default(0), // Order/hierarchy (lower = higher priority)
  isSystem: integer("is_system", { mode: "boolean" }).default(false), // System roles can't be deleted
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const customRolePermissions = sqliteTable("custom_role_permission", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customRoleId: text("custom_role_id").references(() => customRoles.id, { onDelete: "cascade" }).notNull(),
  permission: text("permission").notNull(), // e.g. "project:create", "event:manage"
});

export const userCustomRoles = sqliteTable("user_custom_role", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  customRoleId: text("custom_role_id").references(() => customRoles.id, { onDelete: "cascade" }).notNull(),
  assignedAt: integer("assigned_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  assignedById: text("assigned_by_id").references(() => users.id),
});

// =============================================================================
// 8. RELACIONES (DRIZZLE ORM RELATIONS API)
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  currentArea: one(areas, { fields: [users.currentAreaId], references: [areas.id] }),
  positionHistory: many(positionHistory),
  attendanceRecords: many(attendanceRecords, { relationName: "attendee" }),
  reviewedAttendanceRecords: many(attendanceRecords, { relationName: "reviewer" }),
  grades: many(grades, { relationName: "studentGrades" }),
  assignedGrades: many(grades, { relationName: "evaluatorGrades" }),
  monthlySummaries: many(kpiMonthlySummaries),
  createdEvents: many(events, { relationName: "creator" }),
  projectMemberships: many(projectMembers),
  receivedProjectInvitations: many(projectInvitations, { relationName: "invitedUser" }),
  sentProjectInvitations: many(projectInvitations, { relationName: "inviter" }),
  createdProjects: many(projects, { relationName: "projectCreator" }),
  taskAssignments: many(taskAssignments),
  taskComments: many(taskComments, { relationName: "taskCommenter" }),
  createdResources: many(projectResources, { relationName: "resourceCreator" }),
  uploadedResourceLinks: many(projectResourceLinks, { relationName: "resourceLinkUploader" }),
  extendedProjectCycles: many(projectCycles, { relationName: "cycleExtender" }),
  customRoles: many(userCustomRoles, { relationName: "userCustomRoles" }),
  assignedCustomRoles: many(userCustomRoles, { relationName: "roleAssigner" }),
}));

export const areasRelations = relations(areas, ({ many }) => ({
  members: many(users),
  events: many(events),
  kpiSummaries: many(areaKpiSummaries),
  semesterAreas: many(semesterAreas),
  permissions: many(areaPermissions, { relationName: "areaPermissions" }),
}));

export const areaPermissionsRelations = relations(areaPermissions, ({ one }) => ({
  area: one(areas, { fields: [areaPermissions.areaId], references: [areas.id], relationName: "areaPermissions" }),
}));

export const semestersRelations = relations(semesters, ({ many }) => ({
  events: many(events),
  gradeDefinitions: many(gradeDefinitions),
  kpiSummaries: many(kpiMonthlySummaries),
  semesterAreas: many(semesterAreas),
  projects: many(projects),
  projectCycles: many(projectCycles),
}));

export const semesterAreasRelations = relations(semesterAreas, ({ one }) => ({
  semester: one(semesters, { fields: [semesterAreas.semesterId], references: [semesters.id] }),
  area: one(areas, { fields: [semesterAreas.areaId], references: [areas.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  semester: one(semesters, { fields: [events.semesterId], references: [semesters.id] }),
  targetArea: one(areas, { fields: [events.targetAreaId], references: [areas.id] }),
  project: one(projects, { fields: [events.projectId], references: [projects.id], relationName: "projectEvents" }),
  projectCycle: one(projectCycles, { fields: [events.projectCycleId], references: [projectCycles.id] }),
  targetProjectArea: one(projectAreas, { fields: [events.targetProjectAreaId], references: [projectAreas.id] }),
  createdBy: one(users, { fields: [events.createdById], references: [users.id], relationName: "creator" }),
  attendanceRecords: many(attendanceRecords),
  invitees: many(eventInvitees),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  event: one(events, { fields: [attendanceRecords.eventId], references: [events.id] }),
  user: one(users, { fields: [attendanceRecords.userId], references: [users.id], relationName: "attendee" }),
  reviewedBy: one(users, { fields: [attendanceRecords.reviewedById], references: [users.id], relationName: "reviewer" }),
}));


export const gradeDefinitionsRelations = relations(gradeDefinitions, ({ one, many }) => ({
  semester: one(semesters, { fields: [gradeDefinitions.semesterId], references: [semesters.id] }),
  grades: many(grades),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  definition: one(gradeDefinitions, { fields: [grades.definitionId], references: [gradeDefinitions.id] }),
  user: one(users, { fields: [grades.userId], references: [users.id], relationName: "studentGrades" }),
  assignedBy: one(users, { fields: [grades.assignedById], references: [users.id], relationName: "evaluatorGrades" }),
}));

export const kpiMonthlySummariesRelations = relations(kpiMonthlySummaries, ({ one }) => ({
  user: one(users, { fields: [kpiMonthlySummaries.userId], references: [users.id] }),
  semester: one(semesters, { fields: [kpiMonthlySummaries.semesterId], references: [semesters.id] }),
}));

export const areaKpiSummariesRelations = relations(areaKpiSummaries, ({ one }) => ({
  area: one(areas, { fields: [areaKpiSummaries.areaId], references: [areas.id] }),
  semester: one(semesters, { fields: [areaKpiSummaries.semesterId], references: [semesters.id] }),
}));

export const positionHistoryRelations = relations(positionHistory, ({ one }) => ({
  user: one(users, { fields: [positionHistory.userId], references: [users.id] }),
  area: one(areas, { fields: [positionHistory.areaId], references: [areas.id] }),
  semester: one(semesters, { fields: [positionHistory.semesterId], references: [semesters.id] }),
}));

// --- Proyectos ---

export const projectsRelations = relations(projects, ({ one, many }) => ({
  semester: one(semesters, { fields: [projects.semesterId], references: [semesters.id] }),
  createdBy: one(users, { fields: [projects.createdById], references: [users.id], relationName: "projectCreator" }),
  cycles: many(projectCycles),
  members: many(projectMembers),
  invitations: many(projectInvitations),
  tasks: many(projectTasks),
  resources: many(projectResources),
  resourceCategories: many(projectResourceCategories),
  events: many(events, { relationName: "projectEvents" }),
}));

export const projectCyclesRelations = relations(projectCycles, ({ one, many }) => ({
  project: one(projects, { fields: [projectCycles.projectId], references: [projects.id] }),
  semester: one(semesters, { fields: [projectCycles.semesterId], references: [semesters.id] }),
  extendedFromCycle: one(projectCycles, {
    fields: [projectCycles.extendedFromCycleId],
    references: [projectCycles.id],
    relationName: "projectCycleLineage",
  }),
  extensions: many(projectCycles, { relationName: "projectCycleLineage" }),
  extendedBy: one(users, {
    fields: [projectCycles.extendedById],
    references: [users.id],
    relationName: "cycleExtender",
  }),
  events: many(events),
}));

export const projectAreasRelations = relations(projectAreas, ({ many }) => ({
  members: many(projectMembers),
  invitations: many(projectInvitations),
  resources: many(projectResources),
  events: many(events),
}));

export const projectRolesRelations = relations(projectRoles, ({ many }) => ({
  members: many(projectMembers),
  invitations: many(projectInvitations),
  permissions: many(projectRolePermissions),
}));

export const projectRolePermissionsRelations = relations(projectRolePermissions, ({ one }) => ({
  projectRole: one(projectRoles, { fields: [projectRolePermissions.projectRoleId], references: [projectRoles.id] }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
  projectRole: one(projectRoles, { fields: [projectMembers.projectRoleId], references: [projectRoles.id] }),
  projectArea: one(projectAreas, { fields: [projectMembers.projectAreaId], references: [projectAreas.id] }),
}));

export const projectInvitationsRelations = relations(projectInvitations, ({ one }) => ({
  project: one(projects, { fields: [projectInvitations.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectInvitations.userId], references: [users.id], relationName: "invitedUser" }),
  invitedBy: one(users, { fields: [projectInvitations.invitedById], references: [users.id], relationName: "inviter" }),
  projectRole: one(projectRoles, { fields: [projectInvitations.projectRoleId], references: [projectRoles.id] }),
  projectArea: one(projectAreas, { fields: [projectInvitations.projectAreaId], references: [projectAreas.id] }),
}));

export const projectTasksRelations = relations(projectTasks, ({ one, many }) => ({
  project: one(projects, { fields: [projectTasks.projectId], references: [projects.id] }),
  projectArea: one(projectAreas, { fields: [projectTasks.projectAreaId], references: [projectAreas.id] }),
  createdBy: one(users, { fields: [projectTasks.createdById], references: [users.id] }),
  assignments: many(taskAssignments),
  comments: many(taskComments),
  resources: many(projectResources),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(projectTasks, { fields: [taskAssignments.taskId], references: [projectTasks.id] }),
  user: one(users, { fields: [taskAssignments.userId], references: [users.id] }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one, many }) => ({
  task: one(projectTasks, { fields: [taskComments.taskId], references: [projectTasks.id] }),
  user: one(users, { fields: [taskComments.userId], references: [users.id], relationName: "taskCommenter" }),
  parent: one(taskComments, {
    fields: [taskComments.parentId],
    references: [taskComments.id],
    relationName: "commentReplies",
  }),
  replies: many(taskComments, { relationName: "commentReplies" }),
}));

// --- Project Resources ---

export const projectResourceCategoriesRelations = relations(projectResourceCategories, ({ one, many }) => ({
  project: one(projects, { fields: [projectResourceCategories.projectId], references: [projects.id] }),
  resources: many(projectResources),
}));

export const projectResourcesRelations = relations(projectResources, ({ one, many }) => ({
  project: one(projects, { fields: [projectResources.projectId], references: [projects.id] }),
  projectArea: one(projectAreas, { fields: [projectResources.projectAreaId], references: [projectAreas.id] }),
  task: one(projectTasks, { fields: [projectResources.taskId], references: [projectTasks.id] }),
  category: one(projectResourceCategories, { fields: [projectResources.categoryId], references: [projectResourceCategories.id] }),
  createdBy: one(users, { fields: [projectResources.createdById], references: [users.id], relationName: "resourceCreator" }),
  links: many(projectResourceLinks),
}));

export const projectResourceLinksRelations = relations(projectResourceLinks, ({ one }) => ({
  resource: one(projectResources, { fields: [projectResourceLinks.resourceId], references: [projectResources.id] }),
  addedBy: one(users, { fields: [projectResourceLinks.addedById], references: [users.id], relationName: "resourceLinkUploader" }),
}));

// --- Event Invitees ---

export const eventInviteesRelations = relations(eventInvitees, ({ one }) => ({
  event: one(events, { fields: [eventInvitees.eventId], references: [events.id] }),
  user: one(users, { fields: [eventInvitees.userId], references: [users.id] }),
}));

// --- Roles Personalizables ---

export const customRolesRelations = relations(customRoles, ({ many }) => ({
  permissions: many(customRolePermissions, { relationName: "rolePermissions" }),
  userAssignments: many(userCustomRoles, { relationName: "roleAssignments" }),
}));

export const customRolePermissionsRelations = relations(customRolePermissions, ({ one }) => ({
  role: one(customRoles, { fields: [customRolePermissions.customRoleId], references: [customRoles.id], relationName: "rolePermissions" }),
}));

export const userCustomRolesRelations = relations(userCustomRoles, ({ one }) => ({
  user: one(users, { fields: [userCustomRoles.userId], references: [users.id], relationName: "userCustomRoles" }),
  customRole: one(customRoles, { fields: [userCustomRoles.customRoleId], references: [customRoles.id], relationName: "roleAssignments" }),
  assignedBy: one(users, { fields: [userCustomRoles.assignedById], references: [users.id], relationName: "roleAssigner" }),
}));
