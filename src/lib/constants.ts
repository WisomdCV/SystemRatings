// =============================================================================
// CONSTANTES CENTRALIZADAS DEL SISTEMA
// =============================================================================
// Fuente ÚNICA de verdad para todos los strings de estado, tipo y categoría.
// Importar desde aquí en vez de usar strings literales.
//
// Regla: si necesitas comparar contra un status/type/scope, debe venir de aquí.
// =============================================================================

// ─── User ───────────────────────────────────────────────────────────────────

export const USER_STATUSES = [
  "ACTIVE",
  "PENDING_APPROVAL",
  "BANNED",
  "SUSPENDED",
  "WARNED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_CATEGORIES = [
  "TRAINEE",
  "JUNIOR",
  "SENIOR",
  "MASTER",
] as const;
export type UserCategory = (typeof USER_CATEGORIES)[number];

// ─── Events ─────────────────────────────────────────────────────────────────

export const EVENT_SCOPES = ["IISE", "PROJECT"] as const;
export type EventScope = (typeof EVENT_SCOPES)[number];

export const EVENT_TYPES = [
  "GENERAL",
  "AREA",
  "INDIVIDUAL_GROUP",
  "TREASURY_SPECIAL",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["SCHEDULED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_INVITEE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
export type EventInviteeStatus = (typeof EVENT_INVITEE_STATUSES)[number];

// ─── Attendance ─────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const JUSTIFICATION_STATUSES = [
  "NONE",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ACKNOWLEDGED",
] as const;
export type JustificationStatus = (typeof JUSTIFICATION_STATUSES)[number];

// ─── Projects ───────────────────────────────────────────────────────────────

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

/** Statuses that allow manual extension to a new cycle */
export const EXTENDABLE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  "ACTIVE",
  "PAUSED",
  "PLANNING",
] as const;

// ─── Project Cycles ─────────────────────────────────────────────────────────

export const CYCLE_STATUSES = ["ACTIVE", "EXTENDED", "ARCHIVED"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

// ─── Tasks ──────────────────────────────────────────────────────────────────

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "BLOCKED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ─── Invitations ────────────────────────────────────────────────────────────

export const INVITATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_EXPIRY_DAYS = 7;

// ─── Comments ──────────────────────────────────────────────────────────────

/** Maximum nesting depth for task comments (1 = replies allowed, no nested replies) */
export const COMMENT_MAX_DEPTH = 1;

// ─── Resource Links ─────────────────────────────────────────────────────────

export const LINK_STATUSES = [
  "ACTIVE",
  "INACCESSIBLE",
  "RESTRICTED",
  "UNKNOWN",
] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];
