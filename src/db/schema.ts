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
  // Roles: 'DEV', 'PRESIDENT', 'DIRECTOR', 'SUBDIRECTOR', 'TREASURER', 'MEMBER', 'VOLUNTEER'
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
});

export const semesters = sqliteTable("semester", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).default(false),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
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
// 6. RELACIONES (DRIZZLE ORM RELATIONS API) - ¡RECUPERADO Y OPTIMIZADO!
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  currentArea: one(areas, { fields: [users.currentAreaId], references: [areas.id] }),
  positionHistory: many(positionHistory),
  attendanceRecords: many(attendanceRecords),
  grades: many(grades, { relationName: "studentGrades" }), // Notas que recibo
  assignedGrades: many(grades, { relationName: "evaluatorGrades" }), // Notas que pongo
  monthlySummaries: many(kpiMonthlySummaries),
  createdEvents: many(events, { relationName: "creator" }),
}));

export const areasRelations = relations(areas, ({ many }) => ({
  members: many(users),
  events: many(events),
  kpiSummaries: many(areaKpiSummaries),
}));

export const semestersRelations = relations(semesters, ({ many }) => ({
  events: many(events),
  gradeDefinitions: many(gradeDefinitions),
  kpiSummaries: many(kpiMonthlySummaries),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  semester: one(semesters, { fields: [events.semesterId], references: [semesters.id] }),
  targetArea: one(areas, { fields: [events.targetAreaId], references: [areas.id] }),
  createdBy: one(users, { fields: [events.createdById], references: [users.id], relationName: "creator" }),
  attendanceRecords: many(attendanceRecords),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  event: one(events, { fields: [attendanceRecords.eventId], references: [events.id] }),
  user: one(users, { fields: [attendanceRecords.userId], references: [users.id] }),
  reviewedBy: one(users, { fields: [attendanceRecords.reviewedById], references: [users.id] }),
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
