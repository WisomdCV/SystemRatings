"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import {
  projectResourceCategories,
  projectResources,
  projectResourceLinks,
  projectMembers,
  projectTasks,
  taskAssignments,
} from "@/db/schema";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  CreateResourceCategorySchema,
  UpdateResourceCategorySchema,
  CreateResourceSchema,
  UpdateResourceSchema,
  AddResourceLinkSchema,
  UpdateResourceLinkSchema,
  DeleteResourceLinkSchema,
  type CreateResourceCategoryDTO,
  type UpdateResourceCategoryDTO,
  type CreateResourceDTO,
  type UpdateResourceDTO,
  type AddResourceLinkDTO,
  type UpdateResourceLinkDTO,
  type DeleteResourceLinkDTO,
} from "@/lib/validators/project";
import { canBypassProjectPerms, hasProjectPermission } from "@/lib/project-permissions";
import { hasPermission } from "@/lib/permissions";
import {
  filterVisibleResources,
  filterVisibleTasks,
  type MembershipContext,
} from "@/server/services/project-visibility.service";
import {
  validateResourceUrl,
  isWhitelistedDomain,
  generatePreviewUrl,
  checkLinkHealth,
} from "@/lib/resource-links";

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

async function isUserAssignedToTask(userId: string, taskId: string) {
  const assignment = await db.query.taskAssignments.findFirst({
    where: and(
      eq(taskAssignments.taskId, taskId),
      eq(taskAssignments.userId, userId),
    ),
    columns: { id: true },
  });
  return !!assignment;
}

function revalidateResources(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/projects");
}

function canViewCrossArea(membership: Awaited<ReturnType<typeof getProjectMembershipWithPerms>>) {
  return hasProjectPermission(membership, "project:resource_view_all")
    || hasProjectPermission(membership, "project:view_all_areas");
}

// =============================================================================
// Resource Categories
// =============================================================================

export async function getGlobalResourceCategoriesAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      return { success: false as const, error: "No autorizado" };
    }

    const categories = await db.query.projectResourceCategories.findMany({
      where: isNull(projectResourceCategories.projectId),
      orderBy: [projectResourceCategories.position],
    });

    return { success: true as const, data: categories };
  } catch (error) {
    console.error("Error fetching global resource categories:", error);
    return { success: false as const, error: "Error al obtener categorías globales." };
  }
}

export async function getResourceCategoriesAction(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
      if (!membership) {
        return { success: false as const, error: "No eres miembro del proyecto." };
      }
    }

    const categories = await db.query.projectResourceCategories.findMany({
      where: or(
        isNull(projectResourceCategories.projectId),
        eq(projectResourceCategories.projectId, projectId),
      ),
      orderBy: [projectResourceCategories.position],
    });

    return { success: true as const, data: categories };
  } catch (error) {
    console.error("Error fetching resource categories:", error);
    return { success: false as const, error: "Error al obtener categorías." };
  }
}

export async function createResourceCategoryAction(input: CreateResourceCategoryDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = CreateResourceCategorySchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const { projectId, ...data } = validated.data;
    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);

    if (!projectId) {
      if (!iiseBypass) {
        return { success: false as const, error: "Solo admins IISE pueden crear categorías globales." };
      }
    } else if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
      if (!hasProjectPermission(membership, "project:manage_settings")) {
        return { success: false as const, error: "No tienes permisos para gestionar categorías." };
      }
    }

    const lastCategory = await db.query.projectResourceCategories.findFirst({
      where: projectId
        ? eq(projectResourceCategories.projectId, projectId)
        : isNull(projectResourceCategories.projectId),
      orderBy: [desc(projectResourceCategories.position)],
    });

    await db.insert(projectResourceCategories).values({
      name: data.name,
      description: data.description || null,
      icon: data.icon || null,
      color: data.color || "#6366f1",
      projectId: projectId || null,
      position: (lastCategory?.position ?? -1) + 1,
      isSystem: false,
    });

    if (projectId) {
      revalidateResources(projectId);
    } else {
      revalidatePath("/admin/project-settings");
    }

    return { success: true as const, message: "Categoría creada." };
  } catch (error) {
    console.error("Error creating resource category:", error);
    return { success: false as const, error: "Error al crear categoría." };
  }
}

export async function updateResourceCategoryAction(input: UpdateResourceCategoryDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = UpdateResourceCategorySchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const category = await db.query.projectResourceCategories.findFirst({
      where: eq(projectResourceCategories.id, validated.data.id),
    });
    if (!category) return { success: false as const, error: "Categoría no encontrada." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);

    if (!category.projectId) {
      if (!iiseBypass) return { success: false as const, error: "Solo admins IISE." };
    } else if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, category.projectId);
      if (!hasProjectPermission(membership, "project:manage_settings")) {
        return { success: false as const, error: "Sin permisos para editar categorías." };
      }
    }

    await db.update(projectResourceCategories)
      .set({
        name: validated.data.name,
        description: validated.data.description || null,
        icon: validated.data.icon || null,
        color: validated.data.color || "#6366f1",
      })
      .where(eq(projectResourceCategories.id, validated.data.id));

    if (category.projectId) {
      revalidateResources(category.projectId);
    } else {
      revalidatePath("/admin/project-settings");
    }

    return { success: true as const, message: "Categoría actualizada." };
  } catch (error) {
    console.error("Error updating resource category:", error);
    return { success: false as const, error: "Error al actualizar categoría." };
  }
}

export async function deleteResourceCategoryAction(categoryId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const category = await db.query.projectResourceCategories.findFirst({
      where: eq(projectResourceCategories.id, categoryId),
    });
    if (!category) return { success: false as const, error: "Categoría no encontrada." };
    if (category.isSystem) return { success: false as const, error: "No se puede eliminar una categoría de sistema." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);

    if (!category.projectId) {
      if (!iiseBypass) return { success: false as const, error: "Solo admins IISE." };
    } else if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, category.projectId);
      if (!hasProjectPermission(membership, "project:manage_settings")) {
        return { success: false as const, error: "Sin permisos para eliminar categorías." };
      }
    }

    await db.delete(projectResourceCategories)
      .where(eq(projectResourceCategories.id, categoryId));

    if (category.projectId) {
      revalidateResources(category.projectId);
    } else {
      revalidatePath("/admin/project-settings");
    }

    return { success: true as const, message: "Categoría eliminada." };
  } catch (error) {
    console.error("Error deleting resource category:", error);
    return { success: false as const, error: "Error al eliminar categoría." };
  }
}

// =============================================================================
// Resources
// =============================================================================

export async function createResourceAction(input: CreateResourceDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = CreateResourceSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const { projectId, projectAreaId, taskId, categoryId, name, description, links } = validated.data;
    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);

    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
      if (!membership) return { success: false as const, error: "No eres miembro del proyecto." };

      if (taskId) {
        const task = await db.query.projectTasks.findFirst({
          where: eq(projectTasks.id, taskId),
          columns: { id: true, projectId: true, createdById: true },
        });
        if (!task || task.projectId !== projectId) {
          return { success: false as const, error: "La tarea no pertenece al proyecto." };
        }

        const isAssigned = await isUserAssignedToTask(session.user.id, taskId);
        const canManageTaskAny = hasProjectPermission(membership, "project:task_manage_any");
        const canManageTaskOwn = hasProjectPermission(membership, "project:task_manage_own")
          && task.createdById === session.user.id;
        const canCreateResource = hasProjectPermission(membership, "project:resource_create");

        if (!isAssigned && !canManageTaskAny && !canManageTaskOwn && !canCreateResource) {
          return { success: false as const, error: "No tienes permisos para adjuntar recursos a esta tarea." };
        }
      } else {
        if (!hasProjectPermission(membership, "project:resource_create")) {
          return { success: false as const, error: "No tienes permisos para crear recursos." };
        }

        if (projectAreaId && membership.projectAreaId !== projectAreaId && !canViewCrossArea(membership)) {
          return { success: false as const, error: "No puedes crear recursos en un área que no es la tuya." };
        }
      }
    }

    const processedLinks: Array<{ url: string; previewUrl: string | null; label: string | null; domain: string }> = [];

    for (const link of links) {
      const validation = validateResourceUrl(link.url);
      if (!validation.valid) {
        return { success: false as const, error: `Link inválido: ${validation.error}` };
      }

      const domain = validation.domain!;
      const previewUrl = isWhitelistedDomain(domain)
        ? generatePreviewUrl(validation.url!, domain)
        : null;

      processedLinks.push({
        url: validation.url!,
        previewUrl,
        label: link.label || null,
        domain,
      });
    }

    const inserted = await db.transaction(async (tx) => {
      const [newResource] = await tx.insert(projectResources).values({
        projectId,
        projectAreaId: projectAreaId || null,
        taskId: taskId || null,
        categoryId: categoryId || null,
        name,
        description: description || null,
        createdById: session.user.id,
      }).returning();

      for (const link of processedLinks) {
        await tx.insert(projectResourceLinks).values({
          resourceId: newResource.id,
          url: link.url,
          previewUrl: link.previewUrl,
          label: link.label,
          domain: link.domain,
          linkStatus: "UNKNOWN",
          addedById: session.user.id,
        });
      }

      return newResource;
    });

    revalidateResources(projectId);
    return { success: true as const, message: "Recurso creado.", resourceId: inserted.id };
  } catch (error) {
    console.error("Error creating resource:", error);
    return { success: false as const, error: "Error al crear recurso." };
  }
}

export async function getProjectResourcesAction(params: {
  projectId: string;
  categoryId?: string | null;
  projectAreaId?: string | null;
  taskId?: string | null;
  search?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const { projectId, categoryId, projectAreaId, taskId, search } = params;
    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);

    let membership = null;
    if (!iiseBypass) {
      membership = await getProjectMembershipWithPerms(session.user.id, projectId);
      if (!membership) return { success: false as const, error: "No eres miembro del proyecto." };
    }

    const membershipCtx: MembershipContext | null = membership
      ? {
        projectAreaId: membership.projectAreaId,
        projectPermissions: membership.projectRole.permissions.map((permission) => permission.permission),
      }
      : null;

    let visibleTaskIds: Set<string> | undefined;
    if (!iiseBypass && membershipCtx) {
      const projectTasksForVisibility = await db.query.projectTasks.findMany({
        where: eq(projectTasks.projectId, projectId),
        with: {
          assignments: {
            with: { user: { columns: { id: true } } },
          },
        },
      });

      const visibleTasks = filterVisibleTasks(
        projectTasksForVisibility,
        session.user.id,
        membershipCtx,
        false,
      );
      visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
    }

    const conditions = [eq(projectResources.projectId, projectId)];
    if (categoryId) conditions.push(eq(projectResources.categoryId, categoryId));
    if (projectAreaId) conditions.push(eq(projectResources.projectAreaId, projectAreaId));
    if (taskId !== undefined) {
      if (taskId === null) conditions.push(isNull(projectResources.taskId));
      else conditions.push(eq(projectResources.taskId, taskId));
    }

    const resources = await db.query.projectResources.findMany({
      where: and(...conditions),
      with: {
        links: {
          with: {
            addedBy: { columns: { id: true, name: true, image: true } },
          },
          orderBy: [projectResourceLinks.createdAt],
        },
        category: { columns: { id: true, name: true, icon: true, color: true } },
        projectArea: { columns: { id: true, name: true, color: true } },
        createdBy: { columns: { id: true, name: true, image: true } },
        task: { columns: { id: true, title: true, createdById: true } },
      },
      orderBy: [desc(projectResources.createdAt)],
    });

    let filtered = filterVisibleResources(
      resources,
      session.user.id,
      membershipCtx,
      iiseBypass,
      visibleTaskIds,
    );

    const isAuditAdmin = hasPermission(session.user.role, "admin:audit", session.user.customPermissions);
    if (!isAuditAdmin) {
      filtered = filtered.map(({ _visibilityRule, ...resource }) => resource as any);
    }

    if (search && search.trim()) {
      const lower = search.toLowerCase();
      filtered = filtered.filter((resource) =>
        resource.name.toLowerCase().includes(lower)
          || (resource.description || "").toLowerCase().includes(lower),
      );
    }

    return { success: true as const, data: filtered };
  } catch (error) {
    console.error("Error fetching resources:", error);
    return { success: false as const, error: "Error al obtener recursos." };
  }
}

export async function updateResourceAction(input: UpdateResourceDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = UpdateResourceSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const resource = await db.query.projectResources.findFirst({
      where: eq(projectResources.id, validated.data.id),
      with: { task: { columns: { id: true, createdById: true } } },
    });
    if (!resource) return { success: false as const, error: "Recurso no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, resource.projectId);
      const isOwner = resource.createdById === session.user.id;

      if (isOwner) {
        if (!hasProjectPermission(membership, "project:resource_edit_own")) {
          return { success: false as const, error: "Sin permisos." };
        }
      } else if (!hasProjectPermission(membership, "project:resource_edit_any")) {
        return { success: false as const, error: "Sin permisos para editar recursos de otros." };
      }
    }

    await db.update(projectResources)
      .set({
        name: validated.data.name,
        description: validated.data.description || null,
        categoryId: validated.data.categoryId || null,
        projectAreaId: validated.data.projectAreaId || null,
        updatedAt: new Date(),
      })
      .where(eq(projectResources.id, validated.data.id));

    revalidateResources(resource.projectId);
    return { success: true as const, message: "Recurso actualizado." };
  } catch (error) {
    console.error("Error updating resource:", error);
    return { success: false as const, error: "Error al actualizar recurso." };
  }
}

export async function deleteResourceAction(resourceId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const resource = await db.query.projectResources.findFirst({
      where: eq(projectResources.id, resourceId),
    });
    if (!resource) return { success: false as const, error: "Recurso no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, resource.projectId);
      const isOwner = resource.createdById === session.user.id;

      if (isOwner) {
        if (!hasProjectPermission(membership, "project:resource_delete_own")) {
          return { success: false as const, error: "Sin permisos." };
        }
      } else if (!hasProjectPermission(membership, "project:resource_delete_any")) {
        return { success: false as const, error: "Sin permisos para eliminar recursos de otros." };
      }
    }

    await db.delete(projectResources).where(eq(projectResources.id, resourceId));

    revalidateResources(resource.projectId);
    return { success: true as const, message: "Recurso eliminado." };
  } catch (error) {
    console.error("Error deleting resource:", error);
    return { success: false as const, error: "Error al eliminar recurso." };
  }
}

// =============================================================================
// Resource links
// =============================================================================

export async function addResourceLinkAction(input: AddResourceLinkDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = AddResourceLinkSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const resource = await db.query.projectResources.findFirst({
      where: eq(projectResources.id, validated.data.resourceId),
      with: {
        task: { columns: { id: true, createdById: true } },
      },
    });
    if (!resource) return { success: false as const, error: "Recurso no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, resource.projectId);
      if (!membership) return { success: false as const, error: "No eres miembro del proyecto." };

      if (resource.taskId) {
        const isAssigned = await isUserAssignedToTask(session.user.id, resource.taskId);
        const canManageTaskAny = hasProjectPermission(membership, "project:task_manage_any");
        const canManageTaskOwn = hasProjectPermission(membership, "project:task_manage_own")
          && resource.task?.createdById === session.user.id;
        const isOwnerWithEdit = resource.createdById === session.user.id
          && hasProjectPermission(membership, "project:resource_edit_own");
        const canEditAny = hasProjectPermission(membership, "project:resource_edit_any");

        if (!isAssigned && !canManageTaskAny && !canManageTaskOwn && !isOwnerWithEdit && !canEditAny) {
          return { success: false as const, error: "No tienes permisos para agregar links a este adjunto." };
        }
      } else {
        const isOwner = resource.createdById === session.user.id;
        if (isOwner) {
          if (!hasProjectPermission(membership, "project:resource_edit_own")) {
            return { success: false as const, error: "Sin permisos." };
          }
        } else if (!hasProjectPermission(membership, "project:resource_edit_any")) {
          return { success: false as const, error: "Sin permisos para editar recursos de otros." };
        }
      }
    }

    const urlResult = validateResourceUrl(validated.data.url);
    if (!urlResult.valid) return { success: false as const, error: urlResult.error || "URL inválida." };

    const domain = urlResult.domain!;
    const previewUrl = isWhitelistedDomain(domain)
      ? generatePreviewUrl(urlResult.url!, domain)
      : null;

    await db.insert(projectResourceLinks).values({
      resourceId: resource.id,
      url: urlResult.url!,
      previewUrl,
      label: validated.data.label || null,
      domain,
      linkStatus: "UNKNOWN",
      addedById: session.user.id,
    });

    await db.update(projectResources)
      .set({ updatedAt: new Date() })
      .where(eq(projectResources.id, resource.id));

    revalidateResources(resource.projectId);
    return { success: true as const, message: "Link agregado." };
  } catch (error) {
    console.error("Error adding resource link:", error);
    return { success: false as const, error: "Error al agregar link." };
  }
}

export async function updateResourceLinkAction(input: UpdateResourceLinkDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = UpdateResourceLinkSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const link = await db.query.projectResourceLinks.findFirst({
      where: eq(projectResourceLinks.id, validated.data.linkId),
      with: {
        resource: {
          with: {
            task: { columns: { createdById: true } },
          },
        },
      },
    });
    if (!link) return { success: false as const, error: "Link no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, link.resource.projectId);
      if (!membership) return { success: false as const, error: "No eres miembro del proyecto." };

      const isLinkOwner = link.addedById === session.user.id;
      const isResourceOwnerWithEditOwn = link.resource.createdById === session.user.id
        && hasProjectPermission(membership, "project:resource_edit_own");
      const canEditAny = hasProjectPermission(membership, "project:resource_edit_any");
      const canManageTaskAny = hasProjectPermission(membership, "project:task_manage_any");
      const canManageTaskOwn = hasProjectPermission(membership, "project:task_manage_own")
        && link.resource.task?.createdById === session.user.id;

      if (!isLinkOwner && !isResourceOwnerWithEditOwn && !canEditAny && !canManageTaskAny && !canManageTaskOwn) {
        return { success: false as const, error: "Sin permisos para editar este link." };
      }
    }

    let normalizedUrl = link.url;
    let normalizedPreviewUrl = link.previewUrl;
    let normalizedDomain = link.domain;
    let status = link.linkStatus;

    if (validated.data.url) {
      const urlResult = validateResourceUrl(validated.data.url);
      if (!urlResult.valid) return { success: false as const, error: urlResult.error || "URL inválida." };
      normalizedUrl = urlResult.url!;
      normalizedDomain = urlResult.domain || null;
      normalizedPreviewUrl = normalizedDomain && isWhitelistedDomain(normalizedDomain)
        ? generatePreviewUrl(normalizedUrl, normalizedDomain)
        : null;
      status = "UNKNOWN";
    }

    await db.update(projectResourceLinks)
      .set({
        url: normalizedUrl,
        previewUrl: normalizedPreviewUrl,
        domain: normalizedDomain,
        label: validated.data.label === undefined ? link.label : (validated.data.label || null),
        linkStatus: status,
      })
      .where(eq(projectResourceLinks.id, validated.data.linkId));

    await db.update(projectResources)
      .set({ updatedAt: new Date() })
      .where(eq(projectResources.id, link.resource.id));

    revalidateResources(link.resource.projectId);
    return { success: true as const, message: "Link actualizado." };
  } catch (error) {
    console.error("Error updating resource link:", error);
    return { success: false as const, error: "Error al actualizar link." };
  }
}

export async function deleteResourceLinkAction(input: DeleteResourceLinkDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = DeleteResourceLinkSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const link = await db.query.projectResourceLinks.findFirst({
      where: eq(projectResourceLinks.id, validated.data.linkId),
      with: {
        resource: {
          with: {
            task: { columns: { createdById: true } },
          },
        },
      },
    });
    if (!link) return { success: false as const, error: "Link no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const isLinkOwner = link.addedById === session.user.id;
      if (!isLinkOwner) {
        const membership = await getProjectMembershipWithPerms(session.user.id, link.resource.projectId);
        const canDeleteAny = hasProjectPermission(membership, "project:resource_delete_any");
        const canManageTaskAny = hasProjectPermission(membership, "project:task_manage_any");
        const canManageTaskOwn = hasProjectPermission(membership, "project:task_manage_own")
          && link.resource.task?.createdById === session.user.id;

        if (!canDeleteAny && !canManageTaskAny && !canManageTaskOwn) {
          return { success: false as const, error: "Solo puedes eliminar links que tú añadiste." };
        }
      }
    }

    await db.delete(projectResourceLinks)
      .where(eq(projectResourceLinks.id, validated.data.linkId));

    await db.update(projectResources)
      .set({ updatedAt: new Date() })
      .where(eq(projectResources.id, link.resource.id));

    revalidateResources(link.resource.projectId);
    return { success: true as const, message: "Link eliminado." };
  } catch (error) {
    console.error("Error deleting resource link:", error);
    return { success: false as const, error: "Error al eliminar link." };
  }
}

export async function verifyResourceLinksAction(resourceId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const resource = await db.query.projectResources.findFirst({
      where: eq(projectResources.id, resourceId),
    });
    if (!resource) return { success: false as const, error: "Recurso no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, resource.projectId);
      const isOwner = resource.createdById === session.user.id;

      if (isOwner) {
        if (!hasProjectPermission(membership, "project:resource_edit_own")) {
          return { success: false as const, error: "Sin permisos para verificar links." };
        }
      } else if (!hasProjectPermission(membership, "project:resource_edit_any")) {
        return { success: false as const, error: "Sin permisos para verificar links." };
      }
    }

    const links = await db.query.projectResourceLinks.findMany({
      where: eq(projectResourceLinks.resourceId, resourceId),
    });

    const results: { linkId: string; status: string }[] = [];

    for (const link of links) {
      const status = await checkLinkHealth(link.url);
      await db.update(projectResourceLinks)
        .set({ linkStatus: status, lastCheckedAt: new Date() })
        .where(eq(projectResourceLinks.id, link.id));
      results.push({ linkId: link.id, status });
    }

    revalidateResources(resource.projectId);
    return { success: true as const, data: results };
  } catch (error) {
    console.error("Error verifying links:", error);
    return { success: false as const, error: "Error al verificar links." };
  }
}
