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
} from "@/server/services/event-permissions.service";
import { getAllExtraPermissionsForUser } from "@/server/data-access/custom-roles";
import { hasProjectPermission } from "@/lib/project-permissions";
import type { ActionResult } from "@/types";
import type { EventType } from "@/lib/constants";

const AccessPreviewSchema = z.object({
  mode: z.enum(["USER", "ROLE"]),
  userId: z.string().optional(),
  role: z.string().optional(),
  areaId: z.string().nullable().optional(),
  extraPermissions: z.array(z.string()).optional(),
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
  }>;
  areas: Array<{ id: string; name: string; code: string | null }>;
  roles: string[];
  permissions: string[];
}

interface EndpointDecision {
  key: string;
  scope: "events" | "projects";
  label: string;
  allowed: boolean;
  reason: string;
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
}

function describePermission(permission: Permission, role: string, customPermissions: string[]) {
  const fromRole = (PERMISSIONS[permission] as readonly string[]).includes(role);
  const fromCustom = customPermissions.includes(permission);
  if (fromRole && fromCustom) return "Permitido por rol base y permisos extra";
  if (fromRole) return "Permitido por rol base";
  if (fromCustom) return "Permitido por permisos extra";
  return "No contiene el permiso requerido";
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
    };
  }

  return {
    key,
    scope,
    label,
    allowed: true,
    reason: `Permitido por ${matching}`,
  };
}

function sanitizePermissions(input: string[] | undefined) {
  const allowed = new Set(ALL_PERMISSIONS);
  return (input || []).filter((permission) => allowed.has(permission as Permission));
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

    const [usersList, areasList] = await Promise.all([
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
    ]);

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
        })),
        areas: areasList,
        roles: Array.from(new Set(Object.values(PERMISSIONS).flat())) as string[],
        permissions: ALL_PERMISSIONS,
      },
    };
  } catch (error) {
    console.error("Error loading preview bootstrap:", error);
    return { success: false, error: "No se pudo cargar datos base de la vista previa" };
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
    let sourceUser: AccessPreviewResult["context"]["sourceUser"] = null;

    let extraPermissions = sanitizePermissions(payload.extraPermissions);
    let projectMemberships: ProjectMembershipContext[] = [];
    let projectMembershipChecks: ProjectMembershipCheck[] = [];

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

    const [areaInfo, activeSemester, allProjects] = await Promise.all([
      resolvedAreaId
        ? db.query.areas.findFirst({ where: eq(areas.id, resolvedAreaId), columns: { name: true } })
        : Promise.resolve(null),
      db.query.semesters.findFirst({ where: eq(semesters.isActive, true), columns: { id: true } }),
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
      },
    );

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
      },
    };
  } catch (error) {
    console.error("Error generating access preview:", error);
    return { success: false, error: "No se pudo generar la vista previa de acceso" };
  }
}
