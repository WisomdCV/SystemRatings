/**
 * Centralized Project Visibility Service
 *
 * Single source of truth for:
 *   1. Which projects a user can SEE (listing filter)
 *   2. Whether a user can ACCESS a specific project (detail guard)
 *   3. Which tasks/resources within a project a user can see (area filter)
 *   4. Visibility trace for audit (explainVisibility)
 */

import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { projectMembers, projectTasks, projectResources, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getAllExtraPermissionsForUser } from "@/server/data-access/custom-roles";

export interface ProjectVisibilityContext {
  userId: string;
  userRole: string;
  userAreaId: string | null;
  customPermissions?: string[];
}

export type VisibilityRule =
  | "BYPASS_PROJECT_MANAGE"
  | "BYPASS_PROJECT_VIEW_ANY"
  | "MEMBER"
  | "IISE_AREA_MATCH"
  | "TASK_VIEW_ALL_AREAS"
  | "TASK_NO_AREA"
  | "TASK_SAME_AREA"
  | "TASK_ASSIGNED"
  | "TASK_CREATOR"
  | "RESOURCE_VIEW_ALL"
  | "RESOURCE_NO_AREA"
  | "RESOURCE_SAME_AREA"
  | "RESOURCE_CREATOR"
  | "INVITATION_OWN"
  | "INVITATION_MANAGE_MEMBERS"
  | "DENIED";

export interface VisibilityDecision {
  visible: boolean;
  rule: VisibilityRule;
}

export interface MembershipContext {
  projectAreaId: string | null;
  projectPermissions: string[];
}

export interface TaskForVisibility {
  id: string;
  projectAreaId: string | null;
  createdById: string;
  assignments: { user: { id: string } }[];
}

export interface ResourceForVisibility {
  id: string;
  projectAreaId: string | null;
  createdById: string;
  taskId: string | null;
}

export function filterVisibleProjects<
  T extends {
    id: string;
    members: { user: { id: string; currentAreaId?: string | null } }[];
  },
>(projects: T[], ctx: ProjectVisibilityContext): (T & { _visibilityRule: VisibilityRule })[] {
  const canManage = hasPermission(ctx.userRole, "project:manage", ctx.customPermissions);
  const canViewAny = hasPermission(ctx.userRole, "project:view_any", ctx.customPermissions);

  if (canManage || canViewAny) {
    const rule: VisibilityRule = canManage ? "BYPASS_PROJECT_MANAGE" : "BYPASS_PROJECT_VIEW_ANY";
    return projects.map((project) => ({ ...project, _visibilityRule: rule }));
  }

  const canViewIISEArea = hasPermission(ctx.userRole, "project:view_iise_area", ctx.customPermissions);

  return projects
    .map((project) => {
      const isMember = project.members.some((member) => member.user.id === ctx.userId);
      if (isMember) return { ...project, _visibilityRule: "MEMBER" as const };

      if (canViewIISEArea && ctx.userAreaId) {
        const hasAreaMember = project.members.some((member) => member.user.currentAreaId === ctx.userAreaId);
        if (hasAreaMember) return { ...project, _visibilityRule: "IISE_AREA_MATCH" as const };
      }

      return null;
    })
    .filter((project): project is NonNullable<typeof project> => project !== null);
}

export async function canAccessProject(
  projectId: string,
  ctx: ProjectVisibilityContext,
): Promise<VisibilityDecision> {
  if (hasPermission(ctx.userRole, "project:manage", ctx.customPermissions)) {
    return { visible: true, rule: "BYPASS_PROJECT_MANAGE" };
  }

  if (hasPermission(ctx.userRole, "project:view_any", ctx.customPermissions)) {
    return { visible: true, rule: "BYPASS_PROJECT_VIEW_ANY" };
  }

  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, ctx.userId),
    ),
    columns: { id: true },
  });

  if (membership) return { visible: true, rule: "MEMBER" };

  if (hasPermission(ctx.userRole, "project:view_iise_area", ctx.customPermissions) && ctx.userAreaId) {
    const areaMembers = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, projectId),
      with: {
        user: { columns: { currentAreaId: true } },
      },
    });

    const hasAreaMatch = areaMembers.some((member) => member.user.currentAreaId === ctx.userAreaId);
    if (hasAreaMatch) return { visible: true, rule: "IISE_AREA_MATCH" };
  }

  return { visible: false, rule: "DENIED" };
}

export function filterVisibleTasks<T extends TaskForVisibility>(
  tasks: T[],
  userId: string,
  membership: MembershipContext | null,
  isBypass: boolean,
): (T & { _visibilityRule: VisibilityRule })[] {
  if (isBypass) {
    return tasks.map((task) => ({ ...task, _visibilityRule: "BYPASS_PROJECT_MANAGE" as const }));
  }

  if (!membership) return [];

  const canViewAll =
    membership.projectPermissions.includes("project:view_all_areas")
    || membership.projectPermissions.includes("project:task_manage_any");

  if (canViewAll) {
    return tasks.map((task) => ({ ...task, _visibilityRule: "TASK_VIEW_ALL_AREAS" as const }));
  }

  return tasks
    .map((task) => {
      if (!task.projectAreaId) return { ...task, _visibilityRule: "TASK_NO_AREA" as const };
      if (task.projectAreaId === membership.projectAreaId) return { ...task, _visibilityRule: "TASK_SAME_AREA" as const };
      if (task.assignments.some((assignment) => assignment.user.id === userId)) return { ...task, _visibilityRule: "TASK_ASSIGNED" as const };
      if (task.createdById === userId) return { ...task, _visibilityRule: "TASK_CREATOR" as const };
      return null;
    })
    .filter((task): task is NonNullable<typeof task> => task !== null);
}

export function filterVisibleResources<T extends ResourceForVisibility>(
  resources: T[],
  userId: string,
  membership: MembershipContext | null,
  isBypass: boolean,
  visibleTaskIds?: Set<string>,
): (T & { _visibilityRule: VisibilityRule })[] {
  if (isBypass) {
    return resources.map((resource) => ({ ...resource, _visibilityRule: "BYPASS_PROJECT_MANAGE" as const }));
  }

  if (!membership) return [];

  const canViewAll =
    membership.projectPermissions.includes("project:resource_view_all")
    || membership.projectPermissions.includes("project:view_all_areas");

  if (canViewAll) {
    return resources.map((resource) => ({ ...resource, _visibilityRule: "RESOURCE_VIEW_ALL" as const }));
  }

  return resources
    .map((resource) => {
      if (resource.taskId && visibleTaskIds) {
        if (visibleTaskIds.has(resource.taskId)) {
          return { ...resource, _visibilityRule: "TASK_SAME_AREA" as const };
        }
        return null;
      }

      if (!resource.projectAreaId) return { ...resource, _visibilityRule: "RESOURCE_NO_AREA" as const };
      if (resource.projectAreaId === membership.projectAreaId) return { ...resource, _visibilityRule: "RESOURCE_SAME_AREA" as const };
      if (resource.createdById === userId) return { ...resource, _visibilityRule: "RESOURCE_CREATOR" as const };

      return null;
    })
    .filter((resource): resource is NonNullable<typeof resource> => resource !== null);
}

export function filterVisibleInvitations<T extends { userId: string; status: string }>(
  invitations: T[],
  userId: string,
  membership: MembershipContext | null,
  isBypass: boolean,
): (T & { _visibilityRule: VisibilityRule })[] {
  if (isBypass) {
    return invitations.map((invitation) => ({ ...invitation, _visibilityRule: "BYPASS_PROJECT_MANAGE" as const }));
  }

  if (membership?.projectPermissions.includes("project:manage_members")) {
    return invitations.map((invitation) => ({ ...invitation, _visibilityRule: "INVITATION_MANAGE_MEMBERS" as const }));
  }

  return invitations
    .filter((invitation) => invitation.userId === userId)
    .map((invitation) => ({ ...invitation, _visibilityRule: "INVITATION_OWN" as const }));
}

export type ProfileVisibilityLevel = "PUBLIC" | "CONTACT" | "SENSITIVE";

export function getMemberProfileLevel(
  viewerCtx: {
    userId: string;
    isBypass: boolean;
    isAdminAccess: boolean;
    membership: MembershipContext | null;
  },
  targetMember: {
    userId: string;
    projectAreaId: string | null;
  },
): ProfileVisibilityLevel {
  if (viewerCtx.userId === targetMember.userId) return "SENSITIVE";
  if (viewerCtx.isBypass || viewerCtx.isAdminAccess) return "SENSITIVE";

  if (viewerCtx.membership?.projectPermissions.includes("project:manage_members")) {
    return "CONTACT";
  }

  if (
    viewerCtx.membership?.projectAreaId
    && viewerCtx.membership.projectAreaId === targetMember.projectAreaId
  ) {
    return "CONTACT";
  }

  return "PUBLIC";
}

export function filterMemberFields<
  T extends {
    user: { id: string; name: string | null; image: string | null; email: string; role: string | null };
  },
>(member: T, level: ProfileVisibilityLevel): T {
  if (level !== "PUBLIC") return member;
  return {
    ...member,
    user: {
      ...member.user,
      email: "",
    },
  };
}

const RULE_EXPLANATIONS: Record<VisibilityRule, string> = {
  BYPASS_PROJECT_MANAGE: "El usuario tiene permiso IISE 'project:manage' (bypass total).",
  BYPASS_PROJECT_VIEW_ANY: "El usuario tiene permiso IISE 'project:view_any' (ve todos los proyectos).",
  MEMBER: "El usuario es miembro directo del proyecto.",
  IISE_AREA_MATCH: "El usuario tiene 'project:view_iise_area' y el proyecto tiene miembros de su misma area IISE.",
  TASK_VIEW_ALL_AREAS: "El miembro tiene 'project:view_all_areas' o 'project:task_manage_any'.",
  TASK_NO_AREA: "La tarea no tiene area asignada (general) y es visible para miembros.",
  TASK_SAME_AREA: "La tarea pertenece a la misma area del miembro en el proyecto.",
  TASK_ASSIGNED: "El usuario esta asignado a esta tarea.",
  TASK_CREATOR: "El usuario creo esta tarea.",
  RESOURCE_VIEW_ALL: "El miembro tiene 'project:resource_view_all' o 'project:view_all_areas'.",
  RESOURCE_NO_AREA: "El recurso no tiene area asignada (general) y es visible para miembros.",
  RESOURCE_SAME_AREA: "El recurso pertenece a la misma area del miembro en el proyecto.",
  RESOURCE_CREATOR: "El usuario creo este recurso.",
  INVITATION_OWN: "El usuario es el destinatario de la invitacion.",
  INVITATION_MANAGE_MEMBERS: "El miembro tiene 'project:manage_members'.",
  DENIED: "Sin regla aplicable. Acceso denegado.",
};

export function explainRule(rule: VisibilityRule): string {
  return RULE_EXPLANATIONS[rule] ?? "Regla desconocida.";
}

/**
 * Generate a visibility report for a target user on a specific project.
 * Useful for admin/audit panels to understand what a user can see.
 *
 * Returns project-level access decision plus a sample of up to 10 tasks and
 * 10 resources showing what the target user can/cannot see and why.
 */
export async function generateVisibilityReport(
  projectId: string,
  targetUserId: string,
  ctx: ProjectVisibilityContext,
): Promise<{
  project: VisibilityDecision;
  tasksSample: { taskId: string; title: string; decision: VisibilityDecision }[];
  resourcesSample: { resourceId: string; name: string; decision: VisibilityDecision }[];
} | null> {
  if (
    !hasPermission(ctx.userRole, "project:manage", ctx.customPermissions)
    && !hasPermission(ctx.userRole, "admin:audit", ctx.customPermissions)
  ) {
    return null;
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
    columns: { id: true, role: true, currentAreaId: true },
  });
  if (!targetUser) return null;

  // Mirror runtime permission layers (custom roles + area permissions) for the target user.
  const targetCustomPermissions = await getAllExtraPermissionsForUser(targetUser.id);

  const targetCtx: ProjectVisibilityContext = {
    userId: targetUser.id,
    userRole: targetUser.role || "",
    userAreaId: targetUser.currentAreaId,
    customPermissions: targetCustomPermissions,
  };

  const projectDecision = await canAccessProject(projectId, targetCtx);

  // Build membership context for task/resource visibility
  const targetMembership = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, targetUser.id),
    ),
    with: {
      projectRole: { with: { permissions: true } },
      projectArea: true,
    },
  });

  const membershipCtx: MembershipContext | null = targetMembership
    ? {
        projectAreaId: targetMembership.projectAreaId,
        projectPermissions: targetMembership.projectRole.permissions.map((p) => p.permission),
      }
    : null;

  const isBypass = hasPermission(targetUser.role || "", "project:manage", targetCustomPermissions);

  // Sample up to 10 tasks
  const SAMPLE_LIMIT = 10;
  const tasks = await db.query.projectTasks.findMany({
    where: eq(projectTasks.projectId, projectId),
    columns: { id: true, title: true, projectAreaId: true, createdById: true },
    with: { assignments: { with: { user: { columns: { id: true } } } } },
    limit: SAMPLE_LIMIT,
  });

  const visibleTasks = filterVisibleTasks(tasks, targetUser.id, membershipCtx, isBypass);
  const visibleTaskIds = new Set(visibleTasks.map((t) => t.id));

  const tasksSample = tasks.map((task) => {
    const visible = visibleTasks.find((vt) => vt.id === task.id);
    return {
      taskId: task.id,
      title: task.title,
      decision: visible
        ? { visible: true as const, rule: visible._visibilityRule }
        : { visible: false as const, rule: "DENIED" as VisibilityRule },
    };
  });

  // Sample up to 10 resources
  const resources = await db.query.projectResources.findMany({
    where: eq(projectResources.projectId, projectId),
    columns: { id: true, name: true, projectAreaId: true, createdById: true, taskId: true },
    limit: SAMPLE_LIMIT,
  });

  const visibleResources = filterVisibleResources(resources, targetUser.id, membershipCtx, isBypass, visibleTaskIds);

  const resourcesSample = resources.map((resource) => {
    const visible = visibleResources.find((vr) => vr.id === resource.id);
    return {
      resourceId: resource.id,
      name: resource.name,
      decision: visible
        ? { visible: true as const, rule: visible._visibilityRule }
        : { visible: false as const, rule: "DENIED" as VisibilityRule },
    };
  });

  return {
    project: projectDecision,
    tasksSample,
    resourcesSample,
  };
}
