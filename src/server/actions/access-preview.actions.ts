"use server";

import { z } from "zod";
import { authFresh } from "@/server/auth-fresh";
import { db } from "@/db";
import {
  users,
  areas,
  areaPermissions,
  projects,
  projectMembers,
  events,
  semesters,
} from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { hasPermission, PERMISSIONS, ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import {
  filterVisibleProjects,
  type ProjectVisibilityContext,
} from "@/server/services/project-visibility.service";
import {
  prepareEventsForClient,
  type VisibilityContext,
  type ProjectMembershipContext,
} from "@/server/services/event-visibility.service";
import {
  canCreateIISEEvent,
  canCreateProjectEvent,
  canManageEvent,
  canTargetAnyArea,
} from "@/server/services/event-permissions.service";
import { getAllExtraPermissionsForUser } from "@/server/data-access/custom-roles";
import {
  canBypassProjectPerms,
  hasProjectPermission,
  type MembershipWithPerms,
} from "@/lib/project-permissions";
import {
  CreateEventSchema,
  UpdateEventSchema,
  type CreateEventDTO,
  type UpdateEventDTO,
} from "@/lib/validators/event";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  type CreateProjectDTO,
  type UpdateProjectDTO,
} from "@/lib/validators/project";
import { getActiveSemester, isProjectWritable } from "@/server/services/project-cycle.service";
import type { ActionResult } from "@/types";
import type { EventType } from "@/lib/constants";

const AccessPreviewSchema = z.object({
  mode: z.enum(["USER", "ROLE"]),
  userId: z.string().optional(),
  role: z.string().optional(),
  areaId: z.string().nullable().optional(),
  extraPermissions: z.array(z.string()).optional(),
});

const AccessDryRunScenarioSchema = z.object({
  type: z.enum([
    "EVENT_CREATE",
    "EVENT_UPDATE",
    "EVENT_DELETE",
    "PROJECT_CREATE",
    "PROJECT_UPDATE",
    "PROJECT_DELETE",
  ]),
  eventId: z.string().optional(),
  projectId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const AccessDryRunSchema = AccessPreviewSchema.extend({
  scenario: AccessDryRunScenarioSchema,
});

export interface AccessPreviewBootstrapData {
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    currentAreaId: string | null;
    currentAreaName: string | null;
    status: string | null;
    projectMemberships: Array<{
      projectId: string;
      projectName: string;
      projectStatus: string;
      projectRoleName: string;
      projectAreaName: string | null;
    }>;
  }>;
  areas: Array<{ id: string; name: string; code: string | null }>;
  projects: Array<{ id: string; name: string; status: string }>;
  events: Array<{ id: string; title: string; date: string; eventScope: string | null; eventType: string | null }>;
  roles: string[];
  permissions: string[];
}

interface DryRunCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface AccessDryRunResult {
  context: AccessPreviewResult["context"];
  scenario: {
    type: z.infer<typeof AccessDryRunScenarioSchema>["type"];
    eventId: string | null;
    projectId: string | null;
  };
  allowed: boolean;
  summary: string;
  checks: DryRunCheck[];
  normalizedPayload: Record<string, unknown> | null;
}

interface SimulatedActorContext {
  mode: "USER" | "ROLE";
  userId: string;
  role: string;
  areaId: string | null;
  sourceUser: { id: string; name: string | null; email: string } | null;
  customPermissions: string[];
  projectMemberships: ProjectMembershipContext[];
  membershipByProjectId: Map<string, MembershipWithPerms>;
}

interface EndpointDecision {
  key: string;
  scope: "events" | "projects";
  label: string;
  allowed: boolean;
  reason: string;
  permissionOrigin: "ROLE_BASE" | "EXTRA_PERMISSION" | "ROLE_AND_EXTRA" | "NONE" | "CONSOLIDATED";
}

interface EventPreviewItem {
  id: string;
  title: string;
  date: string;
  eventScope: string | null;
  eventType: string | null;
  targetArea: string | null;
  targetProject: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canTakeAttendance: boolean;
}

interface ProjectPreviewItem {
  id: string;
  name: string;
  status: string;
  visibilityRule: string;
}

interface ProjectMembershipCheck {
  projectId: string;
  projectName: string;
  projectRole: string;
  projectArea: string | null;
  canCreateGeneralEvent: boolean;
  canCreateAreaEvent: boolean;
  canCreateMeetingEvent: boolean;
  canCreateTreasuryEvent: boolean;
  canManageEvents: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canManageTasksAny: boolean;
}

interface UIViewItem {
  key: string;
  group: "dashboard" | "admin" | "cycle-flow" | "quick-actions" | "auth-flow";
  label: string;
  path: string;
  allowed: boolean;
  reason: string;
}

interface UIViewPreview {
  totalAllowed: number;
  totalEvaluated: number;
  items: UIViewItem[];
}

export interface AccessPreviewResult {
  context: {
    mode: "USER" | "ROLE";
    sourceUser: { id: string; name: string | null; email: string } | null;
    role: string;
    areaId: string | null;
    areaName: string | null;
    customPermissionCount: number;
    hasGlobalEventManage: boolean;
    hasGlobalProjectManage: boolean;
  };
  endpointDecisions: EndpointDecision[];
  events: {
    visibleCount: number;
    totalEvaluated: number;
    sample: EventPreviewItem[];
  };
  projects: {
    visibleCount: number;
    totalEvaluated: number;
    deniedCount: number;
    sample: ProjectPreviewItem[];
  };
  projectMembershipChecks: ProjectMembershipCheck[];
  uiViews: UIViewPreview;
}

function describePermission(permission: Permission, role: string, customPermissions: string[]) {
  const origin = resolvePermissionOrigin(permission, role, customPermissions);
  if (origin === "ROLE_AND_EXTRA") return "Permitido por rol base y permisos extra";
  if (origin === "ROLE_BASE") return "Permitido por rol base";
  if (origin === "EXTRA_PERMISSION") return "Permitido por permisos extra";
  return "No contiene el permiso requerido";
}

function resolvePermissionOrigin(permission: Permission, role: string, customPermissions: string[]) {
  const fromRole = (PERMISSIONS[permission] as readonly string[]).includes(role);
  const fromCustom = customPermissions.includes(permission);
  if (fromRole && fromCustom) return "ROLE_AND_EXTRA" as const;
  if (fromRole) return "ROLE_BASE" as const;
  if (fromCustom) return "EXTRA_PERMISSION" as const;
  return "NONE" as const;
}

function permissionDecision(
  key: string,
  scope: "events" | "projects",
  label: string,
  permission: Permission,
  role: string,
  customPermissions: string[],
): EndpointDecision {
  const allowed = hasPermission(role, permission, customPermissions);
  return {
    key,
    scope,
    label,
    allowed,
    reason: describePermission(permission, role, customPermissions),
    permissionOrigin: allowed
      ? resolvePermissionOrigin(permission, role, customPermissions)
      : "NONE",
  };
}

function anyPermissionDecision(
  key: string,
  scope: "events" | "projects",
  label: string,
  permissions: Permission[],
  role: string,
  customPermissions: string[],
): EndpointDecision {
  const matching = permissions.find((permission) => hasPermission(role, permission, customPermissions));
  if (!matching) {
    return {
      key,
      scope,
      label,
      allowed: false,
      reason: `Requiere alguno de: ${permissions.join(", ")}`,
      permissionOrigin: "NONE",
    };
  }

  return {
    key,
    scope,
    label,
    allowed: true,
    reason: `Permitido por ${matching}. ${describePermission(matching, role, customPermissions)}`,
    permissionOrigin: resolvePermissionOrigin(matching, role, customPermissions),
  };
}

function sanitizePermissions(input: string[] | undefined) {
  const allowed = new Set(ALL_PERMISSIONS);
  return (input || []).filter((permission) => allowed.has(permission as Permission));
}

function buildUIViewPreview(params: {
  role: string;
  customPermissions: string[];
  status: string | null;
  hasActiveSemester: boolean;
  hasAnySemester: boolean;
  visibleProjectsCount: number;
  hasTakeAttendanceActionableEvent: boolean;
}): UIViewPreview {
  const {
    role,
    customPermissions,
    status,
    hasActiveSemester,
    hasAnySemester,
    visibleProjectsCount,
    hasTakeAttendanceActionableEvent,
  } = params;

  const items: UIViewItem[] = [];
  const add = (
    key: string,
    group: UIViewItem["group"],
    label: string,
    path: string,
    allowed: boolean,
    reason: string,
  ) => {
    items.push({ key, group, label, path, allowed, reason });
  };

  const canAdminAccess = hasPermission(role, "admin:access", customPermissions);
  const canApproveUsers = hasPermission(role, "user:approve", customPermissions);
  const canManageUserRoles = hasPermission(role, "user:manage_role", customPermissions);
  const canManageUserData = hasPermission(role, "user:manage_data", customPermissions);
  const canModerateUsers = hasPermission(role, "user:moderate", customPermissions);
  const canManageUsers = canManageUserRoles || canManageUserData || canModerateUsers;
  const canManageAreas = hasPermission(role, "area:manage", customPermissions);
  const canManageAdminRoles = hasPermission(role, "admin:roles", customPermissions);
  const canViewAdminAudit = hasPermission(role, "admin:audit", customPermissions);
  const canManageSemesters = hasPermission(role, "semester:manage", customPermissions);
  const canManagePillars = hasPermission(role, "pillar:manage", customPermissions);

  const canViewGrades =
    hasPermission(role, "grade:view_all", customPermissions)
    || hasPermission(role, "grade:view_own_area", customPermissions);
  const canViewAreaComparison = hasPermission(role, "dashboard:analytics", customPermissions);

  const blockedByStatus = status === "BANNED" || status === "SUSPENDED";
  const blockedByPendingFlow = status === "PENDING_APPROVAL" || (status === "ACTIVE" && role === "VOLUNTEER");

  let dashboardBlockReason = "Cumple condiciones de acceso al dashboard";
  if (status === "BANNED") {
    dashboardBlockReason = "Estado BANNED: redirección a /auth/error?error=RequestRejected";
  } else if (status === "SUSPENDED") {
    dashboardBlockReason = "Estado SUSPENDED: redirección a /auth/error?error=AccessDenied";
  } else if (blockedByPendingFlow) {
    dashboardBlockReason = "Usuario en flujo de aprobación: redirección a /pending-approval";
  } else if (!hasActiveSemester) {
    if (!hasAnySemester) {
      dashboardBlockReason = "No existe ningún ciclo: redirección a /setup?first=true";
    } else if (canManageSemesters) {
      dashboardBlockReason = "Sin ciclo activo pero con semester:manage: redirección a /setup";
    } else {
      dashboardBlockReason = "Sin ciclo activo y sin permisos de gestión: redirección a /no-cycle";
    }
  }

  const dashboardAllowed = !blockedByStatus && !blockedByPendingFlow && hasActiveSemester;

  add("dashboard.home", "dashboard", "Dashboard principal", "/dashboard", dashboardAllowed, dashboardBlockReason);
  add("dashboard.profile", "dashboard", "Mi perfil", "/dashboard/profile", dashboardAllowed, dashboardAllowed ? "Visible en menú principal" : dashboardBlockReason);
  add("dashboard.agenda", "dashboard", "Agenda de eventos", "/dashboard/agenda", dashboardAllowed, dashboardAllowed ? "Visible en navegación de dashboard" : dashboardBlockReason);
  add("dashboard.history", "dashboard", "Historial personal", "/dashboard/history", dashboardAllowed, dashboardAllowed ? "Visible en navegación de dashboard" : dashboardBlockReason);
  add("dashboard.projects", "dashboard", "Proyectos", "/dashboard/projects", dashboardAllowed, dashboardAllowed ? "Visible en navegación de dashboard" : dashboardBlockReason);
  add(
    "dashboard.project_detail",
    "dashboard",
    "Detalle de proyecto",
    "/dashboard/projects/[id]",
    dashboardAllowed && visibleProjectsCount > 0,
    !dashboardAllowed
      ? dashboardBlockReason
      : visibleProjectsCount > 0
        ? "Tiene proyectos visibles para navegar a detalle"
        : "No tiene proyectos visibles con su contexto de permisos",
  );
  add(
    "dashboard.grades",
    "dashboard",
    "Gestión de calificaciones",
    "/dashboard/management/grades",
    dashboardAllowed && canViewGrades,
    !dashboardAllowed
      ? dashboardBlockReason
      : canViewGrades
        ? "Cumple grade:view_all o grade:view_own_area"
        : "Falta grade:view_all o grade:view_own_area",
  );
  add(
    "dashboard.areas",
    "dashboard",
    "Analítica de áreas",
    "/dashboard/areas",
    dashboardAllowed && canViewAreaComparison,
    !dashboardAllowed
      ? dashboardBlockReason
      : canViewAreaComparison
        ? "Cumple dashboard:analytics"
        : "Falta dashboard:analytics",
  );
  add("dashboard.attendance", "dashboard", "Asistencia (mis registros)", "/dashboard/attendance", dashboardAllowed, dashboardAllowed ? "Visible para usuarios de dashboard" : dashboardBlockReason);
  add(
    "dashboard.attendance_detail",
    "dashboard",
    "Hoja de asistencia por evento",
    "/dashboard/attendance/[id]",
    dashboardAllowed && hasTakeAttendanceActionableEvent,
    !dashboardAllowed
      ? dashboardBlockReason
      : hasTakeAttendanceActionableEvent
        ? "Tiene al menos un evento visible con capacidad de tomar asistencia"
        : "No hay eventos visibles con permiso efectivo de asistencia",
  );

  add(
    "cycle.setup",
    "cycle-flow",
    "Pantalla de setup de ciclo",
    "/setup",
    !hasActiveSemester && (!hasAnySemester || canManageSemesters),
    hasActiveSemester
      ? "Con ciclo activo no se usa este flujo"
      : !hasAnySemester
        ? "Primer ciclo: acceso habilitado"
        : canManageSemesters
          ? "Sin ciclo activo y con semester:manage"
          : "Sin semester:manage, se redirige a /no-cycle",
  );
  add(
    "cycle.no_cycle",
    "cycle-flow",
    "Pantalla sin ciclo activo",
    "/no-cycle",
    !hasActiveSemester && hasAnySemester && !canManageSemesters,
    hasActiveSemester
      ? "Con ciclo activo no se usa este flujo"
      : !hasAnySemester
        ? "Primer ciclo redirige a /setup?first=true"
        : canManageSemesters
          ? "Con permisos de gestión se redirige a /setup"
          : "Sin permisos de gestión y sin ciclo activo",
  );

  const adminReasonBase = canAdminAccess
    ? "Cumple admin:access"
    : "Falta admin:access (bloqueado por middleware /admin)";

  add("admin.home", "admin", "Hub de administración", "/admin", canAdminAccess, adminReasonBase);
  add("admin.events", "admin", "Gestión de eventos (admin)", "/admin/events", canAdminAccess, adminReasonBase);
  add(
    "admin.events_attendance_detail",
    "admin",
    "Asistencia de evento (admin)",
    "/admin/events/[id]/attendance",
    canAdminAccess && hasTakeAttendanceActionableEvent,
    !canAdminAccess
      ? adminReasonBase
      : hasTakeAttendanceActionableEvent
        ? "Tiene al menos un evento visible con capacidad de tomar asistencia"
        : "No hay eventos visibles con permiso efectivo de asistencia",
  );
  add(
    "admin.approvals",
    "admin",
    "Solicitudes de acceso",
    "/admin/approvals",
    canAdminAccess && canApproveUsers,
    !canAdminAccess ? adminReasonBase : canApproveUsers ? "Cumple user:approve" : "Falta user:approve",
  );
  add(
    "admin.users",
    "admin",
    "Gestión de usuarios",
    "/admin/users",
    canAdminAccess && canManageUsers,
    !canAdminAccess ? adminReasonBase : canManageUsers ? "Cumple permisos user:manage_* / user:moderate" : "Falta user:manage_role, user:manage_data y user:moderate",
  );
  add(
    "admin.areas",
    "admin",
    "Gestión de áreas",
    "/admin/areas",
    canAdminAccess && canManageAreas,
    !canAdminAccess ? adminReasonBase : canManageAreas ? "Cumple area:manage" : "Falta area:manage",
  );
  add(
    "admin.roles",
    "admin",
    "Permisos y roles",
    "/admin/roles",
    canAdminAccess && canManageAdminRoles,
    !canAdminAccess ? adminReasonBase : canManageAdminRoles ? "Cumple admin:roles" : "Falta admin:roles",
  );
  add(
    "admin.project_settings",
    "admin",
    "Ajustes de proyectos",
    "/admin/project-settings",
    canAdminAccess && canManageAdminRoles,
    !canAdminAccess ? adminReasonBase : canManageAdminRoles ? "Cumple admin:roles" : "Falta admin:roles",
  );
  add(
    "admin.cycles",
    "admin",
    "Ciclos académicos",
    "/admin/cycles",
    canAdminAccess && (canManageSemesters || canManagePillars),
    !canAdminAccess
      ? adminReasonBase
      : (canManageSemesters || canManagePillars)
        ? "Cumple semester:manage o pillar:manage"
        : "Falta semester:manage y pillar:manage",
  );
  add(
    "admin.cycle_pillars",
    "admin",
    "Pilares por ciclo",
    "/admin/cycles/[id]/pillars",
    canAdminAccess && canManagePillars,
    !canAdminAccess ? adminReasonBase : canManagePillars ? "Cumple pillar:manage" : "Falta pillar:manage",
  );
  add(
    "admin.audit",
    "admin",
    "Auditoría de permisos",
    "/admin/audit",
    canAdminAccess && canViewAdminAudit,
    !canAdminAccess ? adminReasonBase : canViewAdminAudit ? "Cumple admin:audit" : "Falta admin:audit",
  );
  add(
    "admin.access_preview",
    "admin",
    "Vista previa de accesos",
    "/admin/access-preview",
    canAdminAccess && (canViewAdminAudit || canManageAdminRoles),
    !canAdminAccess
      ? adminReasonBase
      : (canViewAdminAudit || canManageAdminRoles)
        ? "Cumple admin:audit o admin:roles"
        : "Falta admin:audit y admin:roles",
  );
  add(
    "admin.setup_wizard",
    "admin",
    "Asistente de setup",
    "/admin/setup-wizard",
    canAdminAccess && canManageSemesters,
    !canAdminAccess ? adminReasonBase : canManageSemesters ? "Cumple semester:manage" : "Falta semester:manage",
  );

  const eventsQuickPath = canAdminAccess ? "/admin/events" : "/dashboard/agenda";
  add(
    "quick.events",
    "quick-actions",
    "Acción rápida: Eventos",
    eventsQuickPath,
    canAdminAccess || dashboardAllowed,
    canAdminAccess
      ? "Quick action apunta a /admin/events"
      : dashboardAllowed
        ? "Quick action apunta a /dashboard/agenda"
        : dashboardBlockReason,
  );

  add(
    "quick.grades_or_projects",
    "quick-actions",
    canViewGrades ? "Acción rápida: Evaluar equipos" : "Acción rápida: Mis proyectos",
    canViewGrades ? "/dashboard/management/grades" : "/dashboard/projects",
    dashboardAllowed && (canViewGrades || true),
    !dashboardAllowed ? dashboardBlockReason : canViewGrades ? "Cumple permisos de notas" : "Sin permisos de notas, muestra acceso a proyectos",
  );

  add(
    "quick.admin_or_profile",
    "quick-actions",
    canAdminAccess ? "Acción rápida: Configuración admin" : "Acción rápida: Mi perfil",
    canAdminAccess ? "/admin" : "/dashboard/profile",
    canAdminAccess || dashboardAllowed,
    canAdminAccess ? "Cumple admin:access" : dashboardAllowed ? "Perfil disponible en dashboard" : dashboardBlockReason,
  );

  // Entry/auth flow visibility simulation for route-level behavior understanding.
  add(
    "flow.root_entry",
    "auth-flow",
    "Entrada raíz",
    "/",
    true,
    blockedByStatus
      ? "Redirige a /auth/error según estado"
      : blockedByPendingFlow
        ? "Redirige a /pending-approval"
        : "Con sesión válida redirige a /dashboard; sin sesión a /login",
  );
  add(
    "flow.login",
    "auth-flow",
    "Login",
    "/login",
    true,
    dashboardAllowed || canAdminAccess
      ? "Con sesión activa redirige a /dashboard"
      : "Disponible para autenticación",
  );
  add(
    "flow.pending_approval",
    "auth-flow",
    "Pendiente de aprobación",
    "/pending-approval",
    blockedByPendingFlow,
    blockedByPendingFlow
      ? "Visible para usuarios en estado pendiente o volunteer activo sin aprobación"
      : "Si no está pendiente, redirige a dashboard o error",
  );
  add(
    "flow.auth_error",
    "auth-flow",
    "Pantalla de error de acceso",
    "/auth/error",
    true,
    "Ruta informativa invocada por flujos de acceso denegado/suspendido/rechazado",
  );

  return {
    totalAllowed: items.filter((item) => item.allowed).length,
    totalEvaluated: items.length,
    items,
  };
}

function normalizeRoleName(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function getTreasurySpecialInvitees(projectId: string): Promise<string[]> {
  const members = await db.query.projectMembers.findMany({
    where: eq(projectMembers.projectId, projectId),
    with: {
      projectRole: { columns: { name: true } },
      user: { columns: { id: true } },
    },
  });

  return members
    .filter((member) => normalizeRoleName(member.projectRole?.name) === "director de area")
    .map((member) => member.user.id);
}

function serializePayloadForClient(payload: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(payload, (_key, value) => (value instanceof Date ? value.toISOString() : value)),
  ) as Record<string, unknown>;
}

function buildDryRunResult(
  actor: SimulatedActorContext,
  areaName: string | null,
  scenario: z.infer<typeof AccessDryRunScenarioSchema>,
  allowed: boolean,
  summary: string,
  checks: DryRunCheck[],
  normalizedPayload: Record<string, unknown> | null,
): AccessDryRunResult {
  return {
    context: {
      mode: actor.mode,
      sourceUser: actor.sourceUser,
      role: actor.role,
      areaId: actor.areaId,
      areaName,
      customPermissionCount: actor.customPermissions.length,
      hasGlobalEventManage: hasPermission(actor.role, "event:manage_all", actor.customPermissions),
      hasGlobalProjectManage: hasPermission(actor.role, "project:manage", actor.customPermissions),
    },
    scenario: {
      type: scenario.type,
      eventId: scenario.eventId || null,
      projectId: scenario.projectId || null,
    },
    allowed,
    summary,
    checks,
    normalizedPayload,
  };
}

async function resolveSimulatedActor(
  payload: z.infer<typeof AccessPreviewSchema>,
): Promise<ActionResult<SimulatedActorContext>> {
  let resolvedUserId = "preview-role-mode";
  let resolvedRole = payload.role || "VOLUNTEER";
  let resolvedAreaId: string | null = payload.areaId || null;
  let sourceUser: SimulatedActorContext["sourceUser"] = null;

  let extraPermissions = sanitizePermissions(payload.extraPermissions);
  let projectMemberships: ProjectMembershipContext[] = [];
  const membershipByProjectId = new Map<string, MembershipWithPerms>();

  if (payload.mode === "USER") {
    if (!payload.userId) return { success: false, error: "Selecciona un usuario para la vista previa" };

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
      columns: { id: true, name: true, email: true, role: true, currentAreaId: true },
    });
    if (!targetUser) return { success: false, error: "Usuario objetivo no encontrado" };

    resolvedUserId = targetUser.id;
    resolvedRole = targetUser.role || "VOLUNTEER";
    resolvedAreaId = targetUser.currentAreaId;
    sourceUser = { id: targetUser.id, name: targetUser.name, email: targetUser.email };

    extraPermissions = await getAllExtraPermissionsForUser(targetUser.id);

    const memberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, targetUser.id),
      with: {
        project: { columns: { id: true, name: true } },
        projectRole: { columns: { hierarchyLevel: true, name: true }, with: { permissions: true } },
        projectArea: { columns: { id: true, name: true } },
      },
    });

    projectMemberships = memberships.map((membership) => ({
      projectId: membership.projectId,
      projectAreaId: membership.projectAreaId,
      projectPermissions: membership.projectRole.permissions.map((permission) => permission.permission),
    }));

    memberships.forEach((membership) => {
      membershipByProjectId.set(membership.projectId, {
        projectAreaId: membership.projectAreaId,
        projectRole: {
          hierarchyLevel: membership.projectRole.hierarchyLevel,
          permissions: membership.projectRole.permissions,
        },
      });
    });
  } else {
    if (!payload.role) return { success: false, error: "Selecciona un rol para la simulación" };
    const areaInherited = await resolveRoleModeAreaPermissions(payload.areaId);
    extraPermissions = Array.from(new Set([...extraPermissions, ...areaInherited]));
  }

  return {
    success: true,
    data: {
      mode: payload.mode,
      userId: resolvedUserId,
      role: resolvedRole,
      areaId: resolvedAreaId,
      sourceUser,
      customPermissions: extraPermissions,
      projectMemberships,
      membershipByProjectId,
    },
  };
}

async function resolveRoleModeAreaPermissions(areaId: string | null | undefined) {
  if (!areaId) return [];
  const rows = await db.query.areaPermissions.findMany({
    where: eq(areaPermissions.areaId, areaId),
    columns: { permission: true },
  });
  return rows.map((row) => row.permission);
}

export async function getAccessPreviewBootstrapAction(): Promise<ActionResult<AccessPreviewBootstrapData>> {
  try {
    const session = await authFresh();
    if (!session?.user) return { success: false, error: "No autenticado" };

    const role = session.user.role || "";
    if (!hasPermission(role, "admin:audit", session.user.customPermissions) && !hasPermission(role, "admin:roles", session.user.customPermissions)) {
      return { success: false, error: "Sin permisos para vista previa" };
    }

    const activeSemester = await getActiveSemester();

    const [usersList, areasList, projectsList, eventsList, membershipsList] = await Promise.all([
      db.query.users.findMany({
        columns: { id: true, name: true, email: true, role: true, currentAreaId: true, status: true },
        with: {
          currentArea: { columns: { name: true } },
        },
        orderBy: [asc(users.name)],
      }),
      db.query.areas.findMany({
        columns: { id: true, name: true, code: true },
        orderBy: [asc(areas.name)],
      }),
      db.query.projects.findMany({
        columns: { id: true, name: true, status: true },
        orderBy: [desc(projects.createdAt)],
        limit: 120,
      }),
      activeSemester
        ? db.query.events.findMany({
          where: eq(events.semesterId, activeSemester.id),
          columns: { id: true, title: true, date: true, eventScope: true, eventType: true },
          orderBy: [desc(events.date)],
          limit: 120,
        })
        : Promise.resolve([]),
      db.query.projectMembers.findMany({
        columns: { userId: true },
        with: {
          project: { columns: { id: true, name: true, status: true } },
          projectRole: { columns: { name: true } },
          projectArea: { columns: { name: true } },
        },
        orderBy: [asc(projectMembers.joinedAt)],
      }),
    ]);

    const membershipsByUserId = membershipsList.reduce<Record<string, AccessPreviewBootstrapData["users"][number]["projectMemberships"]>>((acc, membership) => {
      const bucket = acc[membership.userId] || [];
      bucket.push({
        projectId: membership.project.id,
        projectName: membership.project.name,
        projectStatus: membership.project.status,
        projectRoleName: membership.projectRole.name,
        projectAreaName: membership.projectArea?.name || null,
      });
      acc[membership.userId] = bucket;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        users: usersList.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          currentAreaId: user.currentAreaId,
          currentAreaName: user.currentArea?.name || null,
          status: user.status,
          projectMemberships: membershipsByUserId[user.id] || [],
        })),
        areas: areasList,
        projects: projectsList,
        events: eventsList.map((event) => ({
          id: event.id,
          title: event.title,
          date: event.date.toISOString(),
          eventScope: event.eventScope,
          eventType: event.eventType,
        })),
        roles: Array.from(new Set(Object.values(PERMISSIONS).flat())) as string[],
        permissions: ALL_PERMISSIONS,
      },
    };
  } catch (error) {
    console.error("Error loading preview bootstrap:", error);
    return { success: false, error: "No se pudo cargar datos base de la vista previa" };
  }
}

export async function getAccessDryRunAction(
  input: z.infer<typeof AccessDryRunSchema>,
): Promise<ActionResult<AccessDryRunResult>> {
  try {
    const session = await authFresh();
    if (!session?.user) return { success: false, error: "No autenticado" };

    const adminRole = session.user.role || "";
    if (!hasPermission(adminRole, "admin:audit", session.user.customPermissions) && !hasPermission(adminRole, "admin:roles", session.user.customPermissions)) {
      return { success: false, error: "Sin permisos para vista previa" };
    }

    const parsed = AccessDryRunSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Payload inválido" };

    const payload = parsed.data;
    const actorResult = await resolveSimulatedActor(payload);
    if (!actorResult.success) return { success: false, error: actorResult.error };
    const actor = actorResult.data;

    const areaInfo = actor.areaId
      ? await db.query.areas.findFirst({ where: eq(areas.id, actor.areaId), columns: { name: true } })
      : null;

    const checks: DryRunCheck[] = [];
    const addCheck = (key: string, label: string, passed: boolean, detail: string) => {
      checks.push({ key, label, passed, detail });
    };

    const fail = (summary: string, normalizedPayload: Record<string, unknown> | null = null) => ({
      success: true as const,
      data: buildDryRunResult(actor, areaInfo?.name || null, payload.scenario, false, summary, checks, normalizedPayload),
    });

    const pass = (summary: string, normalizedPayload: Record<string, unknown> | null = null) => ({
      success: true as const,
      data: buildDryRunResult(actor, areaInfo?.name || null, payload.scenario, true, summary, checks, normalizedPayload),
    });

    if (payload.scenario.type === "EVENT_CREATE") {
      const parseResult = CreateEventSchema.safeParse(payload.scenario.payload ?? {});
      if (!parseResult.success) {
        addCheck("schema", "Validación de payload", false, parseResult.error.issues[0]?.message || "Payload inválido");
        return fail("DENY: payload inválido para crear evento");
      }

      const data: CreateEventDTO = parseResult.data;
      addCheck("schema", "Validación de payload", true, "Payload compatible con CreateEventSchema");

      const eventScope = data.eventScope;
      const eventType = data.eventType;

      if (eventType === "GENERAL") {
        data.targetAreaId = null;
        data.targetProjectAreaId = null;
      }
      if (eventType === "INDIVIDUAL_GROUP" || eventType === "TREASURY_SPECIAL") {
        data.targetAreaId = null;
        data.targetProjectAreaId = null;
      }

      if (eventScope === "IISE") {
        const canCreate = await canCreateIISEEvent(
          {
            userRole: actor.role,
            userAreaId: actor.areaId,
            customPermissions: actor.customPermissions,
          },
          eventType,
          data.targetAreaId,
        );

        addCheck(
          "permission",
          "Permisos IISE para creación",
          canCreate,
          canCreate
            ? `Permitido para ${eventType}`
            : `No cumple permisos IISE para ${eventType}`,
        );

        if (!canCreate) return fail("DENY: sin permisos IISE para crear este tipo de evento", serializePayloadForClient(data));

        if (eventType === "AREA" && !canTargetAnyArea({
          userRole: actor.role,
          userAreaId: actor.areaId,
          customPermissions: actor.customPermissions,
        })) {
          data.targetAreaId = actor.areaId;
          addCheck("normalization", "Normalización de targetArea", true, "Se forzó targetArea al área propia (create_area_own)");
        }
      } else {
        if (!data.projectId) {
          addCheck("project_required", "Proyecto requerido", false, "Los eventos PROJECT requieren projectId");
          return fail("DENY: falta projectId en evento de scope PROJECT", serializePayloadForClient(data));
        }

        const canCreate = await canCreateProjectEvent(
          {
            userRole: actor.role,
            userAreaId: actor.areaId,
            customPermissions: actor.customPermissions,
            projectId: data.projectId,
            userId: actor.userId,
          },
          eventType,
          data.targetProjectAreaId,
        );

        addCheck(
          "permission",
          "Permisos de proyecto para creación",
          canCreate,
          canCreate
            ? `Permitido para ${eventType} en proyecto ${data.projectId}`
            : `No cumple permisos de proyecto para ${eventType}`,
        );
        if (!canCreate) return fail("DENY: sin permisos de proyecto para crear este evento", serializePayloadForClient(data));

        if (eventType === "TREASURY_SPECIAL") {
          const invitees = await getTreasurySpecialInvitees(data.projectId);
          if (invitees.length === 0) {
            addCheck("treasury_invitees", "Invitados de tesorería", false, "No hay directores de área en el proyecto");
            return fail("DENY: no hay directores de área para reunión de tesorería", serializePayloadForClient(data));
          }
          data.inviteeUserIds = invitees;
          addCheck("treasury_invitees", "Invitados de tesorería", true, `Se resolvieron ${invitees.length} directores de área`);
        }
      }

      addCheck("external", "Integración Google Calendar", true, "No evaluada en dry-run (solo permisos y reglas)");
      return pass("ALLOW: el backend debería permitir createEventAction para este escenario", serializePayloadForClient(data));
    }

    if (payload.scenario.type === "EVENT_UPDATE") {
      if (!payload.scenario.eventId) {
        addCheck("event_required", "Evento objetivo", false, "Debes seleccionar un eventId");
        return fail("DENY: falta eventId para update");
      }

      const event = await db.query.events.findFirst({
        where: eq(events.id, payload.scenario.eventId),
        columns: {
          id: true,
          createdById: true,
          eventScope: true,
          eventType: true,
          targetAreaId: true,
          projectId: true,
          targetProjectAreaId: true,
        },
      });

      if (!event) {
        addCheck("event_exists", "Evento existente", false, "El evento no existe");
        return fail("DENY: evento no encontrado");
      }
      addCheck("event_exists", "Evento existente", true, "Evento encontrado");

      const canManage = await canManageEvent(
        {
          userRole: actor.role,
          userId: actor.userId,
          userAreaId: actor.areaId,
          customPermissions: actor.customPermissions,
        },
        {
          createdById: event.createdById,
          eventScope: event.eventScope,
          eventType: event.eventType,
          targetAreaId: event.targetAreaId,
          projectId: event.projectId,
          targetProjectAreaId: event.targetProjectAreaId,
        },
      );
      addCheck("manage", "Permiso de gestión sobre evento", canManage, canManage ? "Puede editar/eliminar este evento" : "No puede gestionar este evento");
      if (!canManage) return fail("DENY: sin permisos para editar este evento");

      const parseResult = UpdateEventSchema.safeParse(payload.scenario.payload ?? {});
      if (!parseResult.success) {
        addCheck("schema", "Validación de payload", false, parseResult.error.issues[0]?.message || "Payload inválido");
        return fail("DENY: payload inválido para updateEventAction");
      }
      const data: UpdateEventDTO = parseResult.data;
      addCheck("schema", "Validación de payload", true, "Payload compatible con UpdateEventSchema");

      const effectiveEventType = (data.eventType ?? event.eventType) as EventType;
      const effectiveEventScope = data.eventScope ?? event.eventScope;
      const effectiveProjectId = data.projectId ?? event.projectId;

      if (effectiveEventType === "GENERAL") {
        data.targetAreaId = null;
        data.targetProjectAreaId = null;
      } else if (effectiveEventType === "AREA") {
        if (effectiveEventScope === "IISE") data.targetProjectAreaId = null;
        if (effectiveEventScope === "PROJECT") data.targetAreaId = null;
      }

      if (effectiveEventType === "INDIVIDUAL_GROUP" || effectiveEventType === "TREASURY_SPECIAL") {
        data.targetAreaId = null;
        data.targetProjectAreaId = null;
      }

      if (effectiveEventType === "TREASURY_SPECIAL") {
        if (!effectiveProjectId) {
          addCheck("treasury_project", "Proyecto requerido para tesorería", false, "TREASURY_SPECIAL requiere projectId");
          return fail("DENY: la reunión de tesorería requiere proyecto", serializePayloadForClient(data));
        }

        const invitees = await getTreasurySpecialInvitees(effectiveProjectId);
        if (invitees.length === 0) {
          addCheck("treasury_invitees", "Invitados de tesorería", false, "No hay directores de área en el proyecto");
          return fail("DENY: no hay directores de área para reunión de tesorería", serializePayloadForClient(data));
        }

        data.eventScope = "PROJECT";
        data.eventType = "TREASURY_SPECIAL";
        data.projectId = effectiveProjectId;
        data.inviteeUserIds = invitees;
        addCheck("treasury_invitees", "Invitados de tesorería", true, `Se resolvieron ${invitees.length} directores de área`);
      }

      addCheck("external", "Integración Google Calendar", true, "No evaluada en dry-run (solo permisos y validación)");
      return pass("ALLOW: el backend debería permitir updateEventAction para este escenario", serializePayloadForClient(data));
    }

    if (payload.scenario.type === "EVENT_DELETE") {
      if (!payload.scenario.eventId) {
        addCheck("event_required", "Evento objetivo", false, "Debes seleccionar un eventId");
        return fail("DENY: falta eventId para delete");
      }

      const event = await db.query.events.findFirst({
        where: eq(events.id, payload.scenario.eventId),
        columns: {
          id: true,
          createdById: true,
          eventScope: true,
          eventType: true,
          targetAreaId: true,
          projectId: true,
          targetProjectAreaId: true,
        },
      });

      if (!event) {
        addCheck("event_exists", "Evento existente", false, "El evento no existe");
        return fail("DENY: evento no encontrado");
      }
      addCheck("event_exists", "Evento existente", true, "Evento encontrado");

      const canManage = await canManageEvent(
        {
          userRole: actor.role,
          userId: actor.userId,
          userAreaId: actor.areaId,
          customPermissions: actor.customPermissions,
        },
        {
          createdById: event.createdById,
          eventScope: event.eventScope,
          eventType: event.eventType,
          targetAreaId: event.targetAreaId,
          projectId: event.projectId,
          targetProjectAreaId: event.targetProjectAreaId,
        },
      );
      addCheck("manage", "Permiso de gestión sobre evento", canManage, canManage ? "Puede eliminar este evento" : "No puede eliminar este evento");
      if (!canManage) return fail("DENY: sin permisos para eliminar este evento");

      addCheck("external", "Integración Google Calendar", true, "No evaluada en dry-run (eliminación local/permisos)");
      return pass("ALLOW: el backend debería permitir deleteEventAction para este escenario");
    }

    if (payload.scenario.type === "PROJECT_CREATE") {
      const parseResult = CreateProjectSchema.safeParse(payload.scenario.payload ?? {});
      if (!parseResult.success) {
        addCheck("schema", "Validación de payload", false, parseResult.error.issues[0]?.message || "Payload inválido");
        return fail("DENY: payload inválido para crear proyecto");
      }

      const data: CreateProjectDTO = parseResult.data;
      addCheck("schema", "Validación de payload", true, "Payload compatible con CreateProjectSchema");

      const canCreate = hasPermission(actor.role, "project:create", actor.customPermissions);
      addCheck("permission", "Permiso project:create", canCreate, canCreate ? "Incluye permiso project:create" : "No tiene permiso project:create");
      if (!canCreate) return fail("DENY: sin permiso project:create", serializePayloadForClient(data));

      const activeSemester = await getActiveSemester();
      addCheck("semester", "Ciclo activo", !!activeSemester, activeSemester ? `Ciclo activo: ${activeSemester.name}` : "No hay ciclo activo");
      if (!activeSemester) return fail("DENY: no hay ciclo activo", serializePayloadForClient(data));

      return pass("ALLOW: el backend debería permitir createProjectAction para este escenario", serializePayloadForClient(data));
    }

    if (payload.scenario.type === "PROJECT_UPDATE") {
      if (!payload.scenario.projectId) {
        addCheck("project_required", "Proyecto objetivo", false, "Debes seleccionar un projectId");
        return fail("DENY: falta projectId para update");
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, payload.scenario.projectId),
        columns: { id: true, status: true },
      });
      if (!project) {
        addCheck("project_exists", "Proyecto existente", false, "El proyecto no existe");
        return fail("DENY: proyecto no encontrado");
      }
      addCheck("project_exists", "Proyecto existente", true, "Proyecto encontrado");

      const rawPayload = {
        ...(payload.scenario.payload || {}),
        id: payload.scenario.projectId,
      };
      const parseResult = UpdateProjectSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        addCheck("schema", "Validación de payload", false, parseResult.error.issues[0]?.message || "Payload inválido");
        return fail("DENY: payload inválido para updateProjectAction");
      }

      const data: UpdateProjectDTO = parseResult.data;
      addCheck("schema", "Validación de payload", true, "Payload compatible con UpdateProjectSchema");

      const bypass = canBypassProjectPerms(actor.role, actor.customPermissions);
      addCheck("bypass", "Bypass IISE (project:manage)", bypass, bypass ? "Tiene project:manage global" : "No tiene bypass global");

      if (!bypass) {
        const writable = await isProjectWritable(payload.scenario.projectId);
        addCheck("writable", "Proyecto editable en ciclo", writable, writable ? "Proyecto en ciclo activo" : "Proyecto en solo lectura");
        if (!writable) return fail("DENY: proyecto en modo solo lectura", serializePayloadForClient(data));

        const membership = actor.membershipByProjectId.get(payload.scenario.projectId);
        const canManageSettings = hasProjectPermission(membership, "project:manage_settings");
        addCheck("manage_settings", "Permiso project:manage_settings", canManageSettings, canManageSettings ? "Puede editar configuración" : "No tiene project:manage_settings");
        if (!canManageSettings) return fail("DENY: sin permisos para editar proyecto", serializePayloadForClient(data));

        if (data.status !== project.status) {
          const canManageStatus = hasProjectPermission(membership, "project:manage_status");
          addCheck("manage_status", "Permiso project:manage_status", canManageStatus, canManageStatus ? "Puede cambiar estado" : "No puede cambiar estado");
          if (!canManageStatus) return fail("DENY: no puede cambiar estado del proyecto", serializePayloadForClient(data));
        }
      }

      return pass("ALLOW: el backend debería permitir updateProjectAction para este escenario", serializePayloadForClient(data));
    }

    if (!payload.scenario.projectId) {
      addCheck("project_required", "Proyecto objetivo", false, "Debes seleccionar un projectId");
      return fail("DENY: falta projectId para delete");
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, payload.scenario.projectId),
      columns: { id: true },
    });
    if (!project) {
      addCheck("project_exists", "Proyecto existente", false, "El proyecto no existe");
      return fail("DENY: proyecto no encontrado");
    }
    addCheck("project_exists", "Proyecto existente", true, "Proyecto encontrado");

    const bypass = canBypassProjectPerms(actor.role, actor.customPermissions);
    addCheck("bypass", "Bypass IISE (project:manage)", bypass, bypass ? "Tiene project:manage global" : "No tiene bypass global");

    if (!bypass) {
      const writable = await isProjectWritable(payload.scenario.projectId);
      addCheck("writable", "Proyecto editable en ciclo", writable, writable ? "Proyecto en ciclo activo" : "Proyecto en solo lectura");
      if (!writable) return fail("DENY: proyecto en modo solo lectura");

      const membership = actor.membershipByProjectId.get(payload.scenario.projectId);
      const canDelete = hasProjectPermission(membership, "project:delete");
      addCheck("delete_permission", "Permiso project:delete", canDelete, canDelete ? "Puede eliminar proyecto" : "No tiene project:delete");
      if (!canDelete) return fail("DENY: sin permisos para eliminar proyecto");
    }

    return pass("ALLOW: el backend debería permitir deleteProjectAction para este escenario");
  } catch (error) {
    console.error("Error generating dry-run access preview:", error);
    return { success: false, error: "No se pudo ejecutar la simulación dry-run" };
  }
}

export async function getAccessPreviewAction(
  input: z.infer<typeof AccessPreviewSchema>,
): Promise<ActionResult<AccessPreviewResult>> {
  try {
    const session = await authFresh();
    if (!session?.user) return { success: false, error: "No autenticado" };

    const adminRole = session.user.role || "";
    if (!hasPermission(adminRole, "admin:audit", session.user.customPermissions) && !hasPermission(adminRole, "admin:roles", session.user.customPermissions)) {
      return { success: false, error: "Sin permisos para vista previa" };
    }

    const parsed = AccessPreviewSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Payload inválido" };

    const payload = parsed.data;

    let resolvedUserId = "preview-role-mode";
    let resolvedRole = payload.role || "VOLUNTEER";
    let resolvedAreaId: string | null = payload.areaId || null;
    let resolvedStatus: string | null = payload.mode === "ROLE" ? "ACTIVE" : null;
    let sourceUser: AccessPreviewResult["context"]["sourceUser"] = null;

    let extraPermissions = sanitizePermissions(payload.extraPermissions);
    let projectMemberships: ProjectMembershipContext[] = [];
    let projectMembershipChecks: ProjectMembershipCheck[] = [];

    if (payload.mode === "USER") {
      if (!payload.userId) return { success: false, error: "Selecciona un usuario para la vista previa" };

      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, payload.userId),
        columns: { id: true, name: true, email: true, role: true, currentAreaId: true, status: true },
      });
      if (!targetUser) return { success: false, error: "Usuario objetivo no encontrado" };

      resolvedUserId = targetUser.id;
      resolvedRole = targetUser.role || "VOLUNTEER";
      resolvedAreaId = targetUser.currentAreaId;
      resolvedStatus = targetUser.status;
      sourceUser = { id: targetUser.id, name: targetUser.name, email: targetUser.email };

      extraPermissions = await getAllExtraPermissionsForUser(targetUser.id);

      const memberships = await db.query.projectMembers.findMany({
        where: eq(projectMembers.userId, targetUser.id),
        with: {
          project: { columns: { id: true, name: true } },
          projectRole: { columns: { name: true }, with: { permissions: true } },
          projectArea: { columns: { id: true, name: true } },
        },
      });

      projectMemberships = memberships.map((membership) => ({
        projectId: membership.projectId,
        projectAreaId: membership.projectAreaId,
        projectPermissions: membership.projectRole.permissions.map((permission) => permission.permission),
      }));

      projectMembershipChecks = await Promise.all(
        memberships.map(async (membership) => {
          const membershipPermissionContext = {
            projectAreaId: membership.projectAreaId,
            projectRole: {
              hierarchyLevel: 0,
              permissions: membership.projectRole.permissions,
            },
          };

          const context = {
            userRole: resolvedRole,
            userAreaId: resolvedAreaId,
            customPermissions: extraPermissions,
            projectId: membership.projectId,
            userId: resolvedUserId,
          };

          const [canGeneral, canArea, canMeeting, canTreasury] = await Promise.all([
            canCreateProjectEvent(context, "GENERAL"),
            canCreateProjectEvent(context, "AREA", membership.projectAreaId || undefined),
            canCreateProjectEvent(context, "INDIVIDUAL_GROUP"),
            canCreateProjectEvent(context, "TREASURY_SPECIAL"),
          ]);

          return {
            projectId: membership.projectId,
            projectName: membership.project.name,
            projectRole: membership.projectRole.name,
            projectArea: membership.projectArea?.name || null,
            canCreateGeneralEvent: canGeneral,
            canCreateAreaEvent: canArea,
            canCreateMeetingEvent: canMeeting,
            canCreateTreasuryEvent: canTreasury,
            canManageEvents: hasProjectPermission(membershipPermissionContext, "project:event_manage_any") || hasProjectPermission(membershipPermissionContext, "project:event_manage_own"),
            canManageMembers: hasProjectPermission(membershipPermissionContext, "project:manage_members"),
            canManageSettings: hasProjectPermission(membershipPermissionContext, "project:manage_settings"),
            canManageTasksAny: hasProjectPermission(membershipPermissionContext, "project:task_manage_any"),
          };
        }),
      );
    } else {
      if (!payload.role) return { success: false, error: "Selecciona un rol para la simulación" };
      const areaInherited = await resolveRoleModeAreaPermissions(payload.areaId);
      extraPermissions = Array.from(new Set([...extraPermissions, ...areaInherited]));
    }

    const projectVisCtx: ProjectVisibilityContext = {
      userId: resolvedUserId,
      userRole: resolvedRole,
      userAreaId: resolvedAreaId,
      customPermissions: extraPermissions,
    };

    const [areaInfo, activeSemester, anySemester, allProjects] = await Promise.all([
      resolvedAreaId
        ? db.query.areas.findFirst({ where: eq(areas.id, resolvedAreaId), columns: { name: true } })
        : Promise.resolve(null),
      db.query.semesters.findFirst({ where: eq(semesters.isActive, true), columns: { id: true } }),
      db.query.semesters.findFirst({ columns: { id: true } }),
      db.query.projects.findMany({
        columns: { id: true, name: true, status: true },
        with: {
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  currentAreaId: true,
                },
              },
            },
          },
        },
        orderBy: [desc(projects.createdAt)],
      }),
    ]);

    const visibleProjects = filterVisibleProjects(allProjects, projectVisCtx);
    const projectSample: ProjectPreviewItem[] = visibleProjects.slice(0, 25).map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      visibilityRule: project._visibilityRule,
    }));

    let eventRows: EventPreviewItem[] = [];
    let totalEventsEvaluated = 0;

    if (activeSemester) {
      const allEvents = await db.query.events.findMany({
        where: eq(events.semesterId, activeSemester.id),
        with: {
          targetArea: { columns: { name: true } },
          project: { columns: { name: true } },
          targetProjectArea: { columns: { id: true, name: true } },
          invitees: { columns: { userId: true } },
        },
        orderBy: [desc(events.date)],
      });

      totalEventsEvaluated = allEvents.length;

      const eventVisCtx: VisibilityContext = {
        userId: resolvedUserId,
        userRole: resolvedRole,
        userAreaId: resolvedAreaId,
        customPermissions: extraPermissions,
        projectMemberships,
        hasGlobalManage: hasPermission(resolvedRole, "event:manage_all", extraPermissions),
      };

      const visibleEvents = await prepareEventsForClient(allEvents, eventVisCtx);
      eventRows = visibleEvents.slice(0, 30).map((event) => ({
        id: event.id,
        title: event.title,
        date: new Date(event.date).toISOString(),
        eventScope: event.eventScope || null,
        eventType: event.eventType || null,
        targetArea: event.targetArea?.name || null,
        targetProject: event.project?.name || null,
        canEdit: event._permissions.canEdit,
        canDelete: event._permissions.canDelete,
        canTakeAttendance: event._permissions.canTakeAttendance,
      }));
    }

    const endpointDecisions: EndpointDecision[] = [
      permissionDecision("events.create_general", "events", "POST /events (GENERAL)", "event:create_general", resolvedRole, extraPermissions),
      anyPermissionDecision("events.create_area", "events", "POST /events (AREA)", ["event:create_area_own", "event:create_area_any"], resolvedRole, extraPermissions),
      permissionDecision("events.create_meeting", "events", "POST /events (INDIVIDUAL_GROUP)", "event:create_meeting", resolvedRole, extraPermissions),
      anyPermissionDecision("events.manage", "events", "PATCH/DELETE /events/:id", ["event:manage_own", "event:manage_all"], resolvedRole, extraPermissions),
      anyPermissionDecision("events.attendance_take", "events", "POST /attendance (tomar asistencia)", ["attendance:take_own_area", "attendance:take_all"], resolvedRole, extraPermissions),
      permissionDecision("projects.create", "projects", "POST /projects", "project:create", resolvedRole, extraPermissions),
      permissionDecision("projects.view_any", "projects", "GET /projects (view_any)", "project:view_any", resolvedRole, extraPermissions),
      permissionDecision("projects.view_iise_area", "projects", "GET /projects (view_iise_area)", "project:view_iise_area", resolvedRole, extraPermissions),
      permissionDecision("projects.manage", "projects", "PATCH /projects/:id (global manage)", "project:manage", resolvedRole, extraPermissions),
    ];

    const [canCreateGeneralIISE, canCreateAreaIISE, canCreateMeetingIISE] = await Promise.all([
      canCreateIISEEvent({ userRole: resolvedRole, userAreaId: resolvedAreaId, customPermissions: extraPermissions }, "GENERAL"),
      canCreateIISEEvent({ userRole: resolvedRole, userAreaId: resolvedAreaId, customPermissions: extraPermissions }, "AREA", resolvedAreaId || undefined),
      canCreateIISEEvent({ userRole: resolvedRole, userAreaId: resolvedAreaId, customPermissions: extraPermissions }, "INDIVIDUAL_GROUP"),
    ]);

    endpointDecisions.push(
      {
        key: "events.iise_capabilities",
        scope: "events",
        label: "Capacidad IISE consolidada",
        allowed: canCreateGeneralIISE || canCreateAreaIISE || canCreateMeetingIISE,
        reason: `GENERAL=${canCreateGeneralIISE ? "SI" : "NO"}, AREA=${canCreateAreaIISE ? "SI" : "NO"}, INDIVIDUAL=${canCreateMeetingIISE ? "SI" : "NO"}`,
        permissionOrigin: "CONSOLIDATED",
      },
    );

    const uiViews = buildUIViewPreview({
      role: resolvedRole,
      customPermissions: extraPermissions,
      status: resolvedStatus,
      hasActiveSemester: !!activeSemester,
      hasAnySemester: !!anySemester,
      visibleProjectsCount: visibleProjects.length,
      hasTakeAttendanceActionableEvent: eventRows.some((row) => row.canTakeAttendance),
    });

    return {
      success: true,
      data: {
        context: {
          mode: payload.mode,
          sourceUser,
          role: resolvedRole,
          areaId: resolvedAreaId,
          areaName: areaInfo?.name || null,
          customPermissionCount: extraPermissions.length,
          hasGlobalEventManage: hasPermission(resolvedRole, "event:manage_all", extraPermissions),
          hasGlobalProjectManage: hasPermission(resolvedRole, "project:manage", extraPermissions),
        },
        endpointDecisions,
        events: {
          visibleCount: eventRows.length,
          totalEvaluated: totalEventsEvaluated,
          sample: eventRows,
        },
        projects: {
          visibleCount: visibleProjects.length,
          totalEvaluated: allProjects.length,
          deniedCount: Math.max(allProjects.length - visibleProjects.length, 0),
          sample: projectSample,
        },
        projectMembershipChecks,
        uiViews,
      },
    };
  } catch (error) {
    console.error("Error generating access preview:", error);
    return { success: false, error: "No se pudo generar la vista previa de acceso" };
  }
}
