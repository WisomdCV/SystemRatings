"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { taskComments, projectTasks, taskAssignments, projectMembers } from "@/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  CreateTaskCommentSchema,
  UpdateTaskCommentSchema,
  type CreateTaskCommentDTO,
  type UpdateTaskCommentDTO,
} from "@/lib/validators/project";
import { hasProjectPermission, canBypassProjectPerms } from "@/lib/project-permissions";

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

export async function createTaskCommentAction(input: CreateTaskCommentDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = CreateTaskCommentSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const { taskId, content, parentId } = validated.data;

    const task = await db.query.projectTasks.findFirst({
      where: eq(projectTasks.id, taskId),
      columns: { id: true, projectId: true, createdById: true },
    });
    if (!task) return { success: false as const, error: "Tarea no encontrada." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const isCreator = task.createdById === session.user.id;
      const isAssigned = await db.query.taskAssignments.findFirst({
        where: and(
          eq(taskAssignments.taskId, taskId),
          eq(taskAssignments.userId, session.user.id),
        ),
        columns: { id: true },
      });

      if (!isCreator && !isAssigned) {
        const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
        const canManage = hasProjectPermission(membership, "project:task_manage_any")
          || hasProjectPermission(membership, "project:task_manage_own");
        if (!canManage) {
          return { success: false as const, error: "No tienes permisos para comentar en esta tarea." };
        }
      }
    }

    if (parentId) {
      const parent = await db.query.taskComments.findFirst({
        where: and(
          eq(taskComments.id, parentId),
          eq(taskComments.taskId, taskId),
        ),
        columns: { id: true, parentId: true },
      });
      if (!parent) return { success: false as const, error: "Comentario padre no encontrado." };
      if (parent.parentId) {
        return { success: false as const, error: "No se puede responder a una respuesta." };
      }
    }

    await db.insert(taskComments).values({
      taskId,
      userId: session.user.id,
      content,
      parentId: parentId || null,
    });

    revalidatePath(`/dashboard/projects/${task.projectId}`);
    return { success: true as const, message: "Comentario agregado." };
  } catch (error) {
    console.error("Error creating task comment:", error);
    return { success: false as const, error: "Error al crear comentario." };
  }
}

export async function getTaskCommentsAction(taskId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const task = await db.query.projectTasks.findFirst({
      where: eq(projectTasks.id, taskId),
      columns: { id: true, projectId: true },
    });
    if (!task) return { success: false as const, error: "Tarea no encontrada." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass) {
      const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
      if (!membership) {
        return { success: false as const, error: "No eres miembro del proyecto." };
      }
    }

    const comments = await db.query.taskComments.findMany({
      where: and(
        eq(taskComments.taskId, taskId),
        isNull(taskComments.parentId),
      ),
      with: {
        user: { columns: { id: true, name: true, image: true } },
        replies: {
          with: {
            user: { columns: { id: true, name: true, image: true } },
          },
          orderBy: [asc(taskComments.createdAt)],
        },
      },
      orderBy: [desc(taskComments.createdAt)],
    });

    return { success: true as const, data: comments };
  } catch (error) {
    console.error("Error fetching task comments:", error);
    return { success: false as const, error: "Error al obtener comentarios." };
  }
}

export async function updateTaskCommentAction(input: UpdateTaskCommentDTO) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const validated = UpdateTaskCommentSchema.safeParse(input);
    if (!validated.success) {
      return { success: false as const, error: validated.error.issues[0].message };
    }

    const comment = await db.query.taskComments.findFirst({
      where: eq(taskComments.id, validated.data.commentId),
      with: {
        task: { columns: { projectId: true } },
      },
    });
    if (!comment) return { success: false as const, error: "Comentario no encontrado." };

    if (comment.userId !== session.user.id) {
      return { success: false as const, error: "Solo puedes editar tus propios comentarios." };
    }

    await db.update(taskComments)
      .set({
        content: validated.data.content,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(taskComments.id, validated.data.commentId));

    revalidatePath(`/dashboard/projects/${comment.task.projectId}`);
    return { success: true as const, message: "Comentario actualizado." };
  } catch (error) {
    console.error("Error updating task comment:", error);
    return { success: false as const, error: "Error al actualizar comentario." };
  }
}

export async function deleteTaskCommentAction(commentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

    const comment = await db.query.taskComments.findFirst({
      where: eq(taskComments.id, commentId),
      with: {
        task: { columns: { projectId: true } },
      },
    });
    if (!comment) return { success: false as const, error: "Comentario no encontrado." };

    const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
    if (!iiseBypass && comment.userId !== session.user.id) {
      const membership = await getProjectMembershipWithPerms(session.user.id, comment.task.projectId);
      if (!hasProjectPermission(membership, "project:task_manage_any")) {
        return { success: false as const, error: "Solo puedes eliminar tus propios comentarios." };
      }
    }

    await db.delete(taskComments).where(eq(taskComments.parentId, commentId));
    await db.delete(taskComments).where(eq(taskComments.id, commentId));

    revalidatePath(`/dashboard/projects/${comment.task.projectId}`);
    return { success: true as const, message: "Comentario eliminado." };
  } catch (error) {
    console.error("Error deleting task comment:", error);
    return { success: false as const, error: "Error al eliminar comentario." };
  }
}
