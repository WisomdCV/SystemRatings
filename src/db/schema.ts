import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
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
  isLeadershipArea: integer("is_leadership_area", { mode: "boolean" }).default(false),
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

  targetAreaId: text("target_area_id").references(() => areas.id),

  date: integer("date", { mode: "timestamp" }).notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),

  isVirtual: integer("is_virtual", { mode: "boolean" }).default(false),
  meetLink: text("meet_link"),
  googleEventId: text("google_event_id"),

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
// 6. MÓDULO DE PROYECTOS
// =============================================================================

export const projects = sqliteTable("project", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  semesterId: text("semester_id").references(() => semesters.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
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

export const projectMembers = sqliteTable("project_member", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // DIRECTOR | COORDINATOR | MEMBER — sub-rol independiente del rol principal
  projectRole: text("project_role").default("MEMBER").notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const projectTasks = sqliteTable("project_task", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // TODO | IN_PROGRESS | REVIEW | DONE | BLOCKED
  status: text("status").default("TODO").notNull(),
  // LOW | MEDIUM | HIGH
  priority: text("priority").default("MEDIUM").notNull(),
  createdById: text("created_by_id").references(() => users.id).notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  position: integer("position").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const taskAssignments = sqliteTable("task_assignment", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => projectTasks.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  assignedAt: integer("assigned_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

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
  createdProjects: many(projects, { relationName: "projectCreator" }),
  taskAssignments: many(taskAssignments),
  customRoles: many(userCustomRoles, { relationName: "userCustomRoles" }),
  assignedCustomRoles: many(userCustomRoles, { relationName: "roleAssigner" }),
}));

export const areasRelations = relations(areas, ({ many }) => ({
  members: many(users),
  events: many(events),
  kpiSummaries: many(areaKpiSummaries),
  semesterAreas: many(semesterAreas),
}));

export const semestersRelations = relations(semesters, ({ many }) => ({
  events: many(events),
  gradeDefinitions: many(gradeDefinitions),
  kpiSummaries: many(kpiMonthlySummaries),
  semesterAreas: many(semesterAreas),
  projects: many(projects),
}));

export const semesterAreasRelations = relations(semesterAreas, ({ one }) => ({
  semester: one(semesters, { fields: [semesterAreas.semesterId], references: [semesters.id] }),
  area: one(areas, { fields: [semesterAreas.areaId], references: [areas.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  semester: one(semesters, { fields: [events.semesterId], references: [semesters.id] }),
  targetArea: one(areas, { fields: [events.targetAreaId], references: [areas.id] }),
  createdBy: one(users, { fields: [events.createdById], references: [users.id], relationName: "creator" }),
  attendanceRecords: many(attendanceRecords),
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
  members: many(projectMembers),
  tasks: many(projectTasks),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const projectTasksRelations = relations(projectTasks, ({ one, many }) => ({
  project: one(projects, { fields: [projectTasks.projectId], references: [projects.id] }),
  createdBy: one(users, { fields: [projectTasks.createdById], references: [users.id] }),
  assignments: many(taskAssignments),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(projectTasks, { fields: [taskAssignments.taskId], references: [projectTasks.id] }),
  user: one(users, { fields: [taskAssignments.userId], references: [users.id] }),
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
