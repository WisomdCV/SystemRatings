"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import {
  projectInvitations,
  projectMembers,
  projectRoles,
  projectAreas,
  projects,
  users,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  CreateProjectInvitationSchema,
  RespondInvitationSchema,
  CancelInvitationSchema,
  INVITATION_EXPIRY_DAYS,
  type CreateProjectInvitationDTO,
  type RespondInvitationDTO,
  type CancelInvitationDTO,
} from "@/lib/validators/project";
import { canBypassProjectPerms, hasProjectPermission } from "@/lib/project-permissions";
import { hasPermission } from "@/lib/permissions";
import { filterVisibleInvitations, type MembershipContext } from "@/server/services/project-visibility.service";

async function getProjectMembershipWithPerms(userId: string, projectId: string) {
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ),
    with: {
      projectRole: { with: { permissions: true } },
      projectArea: true,
    },
  });
  return membership ?? null;
}

function revalidateInvitations(projectId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
}

function computeExpiresAt() {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + INVITATION_EXPIRY_DAYS);
  return expiration;
}

function isExpired(expiresAt: Date | null) {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

export async function createProjectInvitationAction(input: CreateProjectInvitationDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = CreateProjectInvitationSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const { projectId, userId, projectRoleId, projectAreaId, message } = validated.data;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true },
    });
    if (!project) return { success: false as const, error: "Proyecto no encontrado." };

    const invitedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!invitedUser) return { success: false as const, error: "Usuario no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    let inviterHierarchy = Number.POSITIVE_INFINITY;

    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
      if (!membership) {
        return { success: false as const, error: "No eres miembro del proyecto." };
      }
      if (!hasProjectPermission(membership, "project:manage_members")) {
        return { success: false as const, error: "No tienes permisos para gestionar miembros." };
      }
      inviterHierarchy = membership.projectRole.hierarchyLevel;
    }

    const targetRole = await db.query.projectRoles.findFirst({
      where: eq(projectRoles.id, projectRoleId),
      columns: { id: true, hierarchyLevel: true },
    });
    if (!targetRole) {
      return { success: false as const, error: "Rol de proyecto no encontrado." };
    }

    if (targetRole.hierarchyLevel > inviterHierarchy) {
      return { success: false as const, error: "No puedes invitar con un rol de mayor jerarquía que el tuyo." };
    }

    if (projectAreaId) {
      const area = await db.query.projectAreas.findFirst({
        where: eq(projectAreas.id, projectAreaId),
        columns: { id: true },
      });
      if (!area) {
        return { success: false as const, error: "Área de proyecto no encontrada." };
      }
    }

    const existingMember = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
      columns: { id: true },
    });
    if (existingMember) {
      return { success: false as const, error: "El usuario ya es miembro de este proyecto." };
    }

    const existingPending = await db.query.projectInvitations.findFirst({
      where: and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.userId, userId),
        eq(projectInvitations.status, "PENDING"),
      ),
      columns: { id: true },
    });
    if (existingPending) {
      return { success: false as const, error: "Ya existe una invitación pendiente para este usuario en este proyecto." };
    }

    await db.insert(projectInvitations).values({
      projectId,
      userId,
      projectRoleId,
      projectAreaId: projectAreaId || null,
      invitedById: session.user.id,
      status: "PENDING",
      message: message || null,
      expiresAt: computeExpiresAt(),
    });

    revalidateInvitations(projectId);
    return { success: true as const, message: "Invitación enviada." };
  } catch (error) {
    console.error("Error creating project invitation:", error);
    return { success: false as const, error: "Error al crear invitación." };
  }
}

export async function respondToInvitationAction(input: RespondInvitationDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = RespondInvitationSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const { invitationId, action, rejectionReason } = validated.data;

    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.id, invitationId),
    });
    if (!invitation) {
      return { success: false as const, error: "Invitación no encontrada." };
    }

    if (invitation.userId !== session.user.id) {
      return { success: false as const, error: "Esta invitación no te pertenece." };
    }

    if (invitation.status !== "PENDING") {
      return { success: false as const, error: `La invitación ya fue ${invitation.status.toLowerCase()}.` };
    }

    if (isExpired(invitation.expiresAt)) {
      await db
        .update(projectInvitations)
        .set({ status: "EXPIRED", respondedAt: new Date() })
        .where(eq(projectInvitations.id, invitationId));

      revalidateInvitations(invitation.projectId);
      return { success: false as const, error: "La invitación ha expirado." };
    }

    if (action === "ACCEPT") {
      const role = await db.query.projectRoles.findFirst({
        where: eq(projectRoles.id, invitation.projectRoleId),
        columns: { id: true },
      });
      if (!role) {
        return {
          success: false as const,
          error: "El rol asignado ya no existe. Contacta al administrador del proyecto.",
        };
      }

      if (invitation.projectAreaId) {
        const area = await db.query.projectAreas.findFirst({
          where: eq(projectAreas.id, invitation.projectAreaId),
          columns: { id: true },
        });
        if (!area) {
          return {
            success: false as const,
            error: "El área asignada ya no existe. Contacta al administrador del proyecto.",
          };
        }
      }

      const existingMember = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, invitation.projectId),
          eq(projectMembers.userId, session.user.id),
        ),
        columns: { id: true },
      });
      if (existingMember) {
        await db
          .update(projectInvitations)
          .set({ status: "CANCELLED", respondedAt: new Date() })
          .where(eq(projectInvitations.id, invitationId));

        revalidateInvitations(invitation.projectId);
        return { success: false as const, error: "Ya eres miembro de este proyecto." };
      }

      await db.transaction(async (tx) => {
        await tx.insert(projectMembers).values({
          projectId: invitation.projectId,
          userId: session.user.id,
          projectRoleId: invitation.projectRoleId,
          projectAreaId: invitation.projectAreaId || null,
        });

        await tx
          .update(projectInvitations)
          .set({ status: "ACCEPTED", respondedAt: new Date() })
          .where(eq(projectInvitations.id, invitationId));
      });

      revalidateInvitations(invitation.projectId);
      return { success: true as const, message: "Invitación aceptada. Ya eres miembro del proyecto." };
    }

    await db
      .update(projectInvitations)
      .set({
        status: "REJECTED",
        rejectionReason: rejectionReason || null,
        respondedAt: new Date(),
      })
      .where(eq(projectInvitations.id, invitationId));

    revalidateInvitations(invitation.projectId);
    return { success: true as const, message: "Invitación rechazada." };
  } catch (error) {
    console.error("Error responding to invitation:", error);
    return { success: false as const, error: "Error al responder invitación." };
  }
}

export async function cancelProjectInvitationAction(input: CancelInvitationDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = CancelInvitationSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.id, validated.data.invitationId),
    });
    if (!invitation) {
      return { success: false as const, error: "Invitación no encontrada." };
    }

    if (invitation.status !== "PENDING") {
      return { success: false as const, error: "Solo se pueden cancelar invitaciones pendientes." };
    }

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass && invitation.invitedById !== session.user.id) {
      const membership = await getProjectMembershipWithPerms(session.user.id, invitation.projectId);
      if (!hasProjectPermission(membership, "project:manage_members")) {
        return { success: false as const, error: "No tienes permisos para cancelar esta invitación." };
      }
    }

    await db
      .update(projectInvitations)
      .set({ status: "CANCELLED", respondedAt: new Date() })
      .where(eq(projectInvitations.id, invitation.id));

    revalidateInvitations(invitation.projectId);
    return { success: true as const, message: "Invitación cancelada." };
  } catch (error) {
    console.error("Error cancelling invitation:", error);
    return { success: false as const, error: "Error al cancelar invitación." };
  }
}

export async function getPendingInvitationsForUserAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const invitations = await db.query.projectInvitations.findMany({
      where: and(
        eq(projectInvitations.userId, session.user.id),
        eq(projectInvitations.status, "PENDING"),
      ),
      with: {
        project: { columns: { id: true, name: true, color: true } },
        invitedBy: { columns: { id: true, name: true, image: true } },
        projectRole: { columns: { id: true, name: true, color: true } },
        projectArea: { columns: { id: true, name: true } },
      },
      orderBy: [desc(projectInvitations.createdAt)],
    });

    const activeInvitations: typeof invitations = [];
    for (const invitation of invitations) {
      if (isExpired(invitation.expiresAt)) {
        await db
          .update(projectInvitations)
          .set({ status: "EXPIRED", respondedAt: new Date() })
          .where(eq(projectInvitations.id, invitation.id));
      } else {
        activeInvitations.push(invitation);
      }
    }

    return { success: true as const, data: activeInvitations };
  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    return { success: false as const, error: "Error al obtener invitaciones." };
  }
}

export async function getProjectInvitationsAction(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    const membership = iiseBypass ? null : await getProjectMembershipWithPerms(session.user.id, projectId);

    const invitations = await db.query.projectInvitations.findMany({
      where: eq(projectInvitations.projectId, projectId),
      with: {
        user: { columns: { id: true, name: true, email: true, image: true } },
        invitedBy: { columns: { id: true, name: true, image: true } },
        projectRole: { columns: { id: true, name: true, color: true } },
        projectArea: { columns: { id: true, name: true } },
      },
      orderBy: [desc(projectInvitations.createdAt)],
    });

    const membershipCtx: MembershipContext | null = membership
      ? {
        projectAreaId: membership.projectAreaId,
        projectPermissions: membership.projectRole.permissions.map((permission) => permission.permission),
      }
      : null;

    const visibleInvitations = filterVisibleInvitations(
      invitations,
      session.user.id,
      membershipCtx,
      iiseBypass,
    );

    const isAuditAdmin = hasPermission(session.user.role, "admin:audit", session.user.customPermissions);
    const data = isAuditAdmin
      ? visibleInvitations
      : visibleInvitations.map(({ _visibilityRule, ...invitation }) => invitation);

    return { success: true as const, data };
  } catch (error) {
    console.error("Error fetching project invitations:", error);
    return { success: false as const, error: "Error al obtener invitaciones del proyecto." };
  }
}
