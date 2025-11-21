import { integer, sqliteTable, text, real, primaryKey } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

// ========================================================
// 1. MÓDULO DE CATÁLOGOS Y ORGANIZACIÓN
// ========================================================

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // 'DEV', 'ADMIN', 'DIRECTOR', 'MIEMBRO', 'VOLUNTARIO'
  codePrefix: text("code_prefix"),       // 'D', 'S', 'M', 'V'
  level: integer("level").default(4),    // 1=Max Poder, 4=Min Poder
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // 'TRAINEE', 'JUNIOR', 'SENIOR', 'MASTER'
});

export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),         // 'Logística'
  abbreviation: text("abbreviation").notNull().unique(), // 'LO'
  description: text("description"),
});

// ========================================================
// 2. MÓDULO DE USUARIOS Y SEGURIDAD (Core)
// ========================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID generado por el sistema
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),

  // Identificadores de Negocio
  institutionalCode: text("institutional_code").unique(), // CUI Real (Input Manual): '20212836'
  internalCode: text("internal_code").unique(),      // Smart Code (Generado): 'DLO-2836'
  phone: text("phone"),

  // Relaciones Organizacionales
  roleId: integer("role_id").references(() => roles.id),
  areaId: integer("area_id").references(() => areas.id),
  categoryId: integer("category_id").references(() => categories.id),

  // Estado de Membresía (Flujo de Aprobación)
  membershipStatus: text("membership_status", { enum: ['NONE', 'REQUESTED', 'ACTIVE', 'REJECTED'] }).default('NONE'),

  // Sistema de Baneo / Suspensión
  isBanned: integer("is_banned").default(0), // 0=Falso, 1=Verdadero
  banExpiresAt: integer("ban_expires_at", { mode: "timestamp" }),      // NULL = Permanente, Fecha = Temporal
  banReason: text("ban_reason"),

  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

// ========================================================
// 3. MÓDULO DE EVALUACIÓN (Notas Manuales)
// ========================================================

export const monthlyScores = sqliteTable("monthly_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // Formato "YYYY-MM" (Ej: "2025-03")

  // Puntajes Parciales
  scoreGeneralMeeting: real("score_general_meeting").default(0), // Max 5
  scoreArea: real("score_area").default(0),            // Max 15
  scoreProjects: real("score_projects").default(0),        // Max 10
  scoreStaff: real("score_staff").default(0),           // Max 5
  scoreCd: real("score_cd").default(0),              // Max 15 (Solo Directores)

  finalKpi: real("final_kpi").default(0),             // Calculado antes de insertar
  feedbackNotes: text("feedback_notes"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow(),
}); // UNIQUE(user_id, period) needs to be handled via uniqueIndex or similar if supported/needed, or app logic. Drizzle supports unique().

// ========================================================
// 4. MÓDULO DE GESTIÓN (Agenda y Justificaciones)
// ========================================================

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  dateTime: integer("date_time", { mode: "timestamp" }).notNull(),

  locationLink: text("location_link"),
  googleMeetCode: text("google_meet_code"),

  type: text("type", { enum: ['VIRTUAL', 'PRESENCIAL'] }),

  // Visibilidad: NULL = General (Todos ven), ID = Privada de Área
  areaId: integer("area_id").references(() => areas.id),

  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
});

export const justifications = sqliteTable("justifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  meetingId: integer("meeting_id").references(() => meetings.id),

  reason: text("reason").notNull(),
  evidenceUrl: text("evidence_url"),

  status: text("status", { enum: ['PENDING', 'APPROVED', 'REJECTED'] }).default('PENDING'),
  adminComment: text("admin_comment"),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
});
