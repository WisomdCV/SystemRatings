"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { projects, projectMembers, projectTasks, taskAssignments, semesters } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasPermission, isAdmin } from "@/lib/permissions";
import {
    CreateProjectSchema, UpdateProjectSchema,
    AddProjectMemberSchema, UpdateProjectMemberRoleSchema,
    CreateTaskSchema, UpdateTaskSchema, UpdateTaskStatusSchema, AssignTaskSchema,
} from "@/lib/validators/project";
import type {
    CreateProjectDTO, UpdateProjectDTO,
    AddProjectMemberDTO, UpdateProjectMemberRoleDTO,
    CreateTaskDTO, UpdateTaskDTO, UpdateTaskStatusDTO, AssignTaskDTO,
} from "@/lib/validators/project";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the user's project role and area in a project, or null if not a member */
async function getUserProjectMembership(userId: string, projectId: string) {
    const membership = await db.query.projectMembers.findFirst({
        where: and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
        ),
        with: {
            projectRole: true,
        }
    });
    return membership ?? null;
}

/** Check if user can manage a project (system admin OR project hierarchy level >= 80) */
async function canManageProject(userId: string, role: string, projectId: string, customPermissions?: string[]) {
    if (hasPermission(role, "project:manage", customPermissions)) return true;
    const membership = await getUserProjectMembership(userId, projectId);
    return (membership?.projectRole?.hierarchyLevel ?? 0) >= 80;
}

const revalidateProjects = () => {
    revalidatePath("/dashboard/projects");
};

// =============================================================================
// PROJECT CRUD
// =============================================================================

/** Get all projects for the active semester (any authenticated user can view) */
export async function getProjectsAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true),
        });
        if (!activeSemester) return { success: false as const, error: "No hay ciclo activo." };

        const allProjects = await db.query.projects.findMany({
            where: eq(projects.semesterId, activeSemester.id),
            orderBy: [desc(projects.createdAt)],
            with: {
                createdBy: { columns: { id: true, name: true, image: true } },
                members: {
                    with: {
                        user: { columns: { id: true, name: true, image: true, role: true } },
                        projectRole: true,
                        projectArea: true,
                    },
                },
                tasks: true,
            },
        });

        return { success: true as const, data: allProjects };
    } catch (error) {
        console.error("Error fetching projects:", error);
        return { success: false as const, error: "Error al cargar proyectos." };
    }
}

/** Get a single project with full details */
export async function getProjectByIdAction(projectId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            with: {
                createdBy: { columns: { id: true, name: true, image: true, email: true } },
                semester: { columns: { id: true, name: true } },
                members: {
                    with: {
                        user: { columns: { id: true, name: true, image: true, email: true, role: true } },
                        projectRole: true,
                        projectArea: true,
                    },
                },
                tasks: {
                    orderBy: [asc(projectTasks.position), desc(projectTasks.createdAt)],
                    with: {
                        createdBy: { columns: { id: true, name: true } },
                        assignments: {
                            with: { user: { columns: { id: true, name: true, image: true } } },
                        },
                    },
                },
            },
        });

        if (!project) return { success: false as const, error: "Proyecto no encontrado." };
        return { success: true as const, data: project };
    } catch (error) {
        console.error("Error fetching project:", error);
        return { success: false as const, error: "Error al cargar proyecto." };
    }
}

/** Create a new project */
export async function createProjectAction(input: CreateProjectDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!hasPermission(session.user.role, "project:create", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos para crear proyectos." };
        }

        const validated = CreateProjectSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true),
        });
        if (!activeSemester) return { success: false as const, error: "No hay ciclo activo." };

        const [newProject] = await db.insert(projects).values({
            semesterId: activeSemester.id,
            name: validated.data.name,
            description: validated.data.description || null,
            priority: validated.data.priority,
            startDate: validated.data.startDate || null,
            deadline: validated.data.deadline || null,
            createdById: session.user.id,
        }).returning();

        // Auto-add creator as Coordinador (hierarchy: 100) or find the highest available
        const { projectRoles } = await import("@/db/schema");
        const coordinatorRole = await db.query.projectRoles.findFirst({
            orderBy: [desc(projectRoles.hierarchyLevel)],
        });

        if (coordinatorRole) {
            await db.insert(projectMembers).values({
                projectId: newProject.id,
                userId: session.user.id,
                projectRoleId: coordinatorRole.id,
            });
        }

        revalidateProjects();
        return { success: true as const, data: newProject, message: "Proyecto creado exitosamente." };
    } catch (error) {
        console.error("Error creating project:", error);
        return { success: false as const, error: "Error al crear proyecto." };
    }
}

/** Update project details */
export async function updateProjectAction(input: UpdateProjectDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = UpdateProjectSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const canManage = await canManageProject(session.user.id, session.user.role || "", validated.data.id, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos para editar este proyecto." };

        await db.update(projects).set({
            name: validated.data.name,
            description: validated.data.description || null,
            status: validated.data.status,
            priority: validated.data.priority,
            startDate: validated.data.startDate || null,
            deadline: validated.data.deadline || null,
            completedAt: validated.data.status === "COMPLETED" ? new Date() : null,
            updatedAt: new Date(),
        }).where(eq(projects.id, validated.data.id));

        revalidateProjects();
        return { success: true as const, message: "Proyecto actualizado." };
    } catch (error) {
        console.error("Error updating project:", error);
        return { success: false as const, error: "Error al actualizar proyecto." };
    }
}

/** Delete a project */
export async function deleteProjectAction(projectId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const canManage = await canManageProject(session.user.id, session.user.role || "", projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos." };

        await db.delete(projects).where(eq(projects.id, projectId));
        revalidateProjects();
        return { success: true as const, message: "Proyecto eliminado." };
    } catch (error) {
        console.error("Error deleting project:", error);
        return { success: false as const, error: "Error al eliminar proyecto." };
    }
}

// =============================================================================
// PROJECT MEMBERS
// =============================================================================

/** Add a member to a project */
export async function addProjectMemberAction(input: AddProjectMemberDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = AddProjectMemberSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const canManage = await canManageProject(session.user.id, session.user.role || "", validated.data.projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos para gestionar miembros." };

        // Check if already a member
        const existing = await db.query.projectMembers.findFirst({
            where: and(
                eq(projectMembers.projectId, validated.data.projectId),
                eq(projectMembers.userId, validated.data.userId),
            ),
        });
        if (existing) return { success: false as const, error: "El usuario ya es miembro de este proyecto." };

        await db.insert(projectMembers).values({
            projectId: validated.data.projectId,
            userId: validated.data.userId,
            projectRoleId: validated.data.projectRoleId,
            projectAreaId: validated.data.projectAreaId || null,
        });

        revalidateProjects();
        return { success: true as const, message: "Miembro agregado." };
    } catch (error) {
        console.error("Error adding project member:", error);
        return { success: false as const, error: "Error al agregar miembro." };
    }
}

/** Update a member's project role */
export async function updateProjectMemberRoleAction(input: UpdateProjectMemberRoleDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = UpdateProjectMemberRoleSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        // Look up the member to get projectId
        const member = await db.query.projectMembers.findFirst({
            where: eq(projectMembers.id, validated.data.memberId),
        });
        if (!member) return { success: false as const, error: "Miembro no encontrado." };

        const canManage = await canManageProject(session.user.id, session.user.role || "", member.projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos." };

        await db.update(projectMembers).set({
            projectRoleId: validated.data.projectRoleId,
            projectAreaId: validated.data.projectAreaId || null,
        }).where(eq(projectMembers.id, validated.data.memberId));

        revalidateProjects();
        return { success: true as const, message: "Rol actualizado." };
    } catch (error) {
        console.error("Error updating member role:", error);
        return { success: false as const, error: "Error al actualizar rol." };
    }
}

/** Remove a member from a project */
export async function removeProjectMemberAction(memberId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const member = await db.query.projectMembers.findFirst({
            where: eq(projectMembers.id, memberId),
        });
        if (!member) return { success: false as const, error: "Miembro no encontrado." };

        const canManage = await canManageProject(session.user.id, session.user.role || "", member.projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos." };

        await db.delete(projectMembers).where(eq(projectMembers.id, memberId));
        revalidateProjects();
        return { success: true as const, message: "Miembro removido." };
    } catch (error) {
        console.error("Error removing member:", error);
        return { success: false as const, error: "Error al remover miembro." };
    }
}

// =============================================================================
// TASKS
// =============================================================================

/** Create a task in a project */
export async function createTaskAction(input: CreateTaskDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = CreateTaskSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        // Must be a member of the project (any role can create tasks, DIRECTOR/COORDINATOR for management)
        const membership = await getUserProjectMembership(session.user.id, validated.data.projectId);
        const isSystemAdmin = isAdmin(session.user.role);
        if (!membership && !isSystemAdmin) {
            return { success: false as const, error: "Debes ser miembro del proyecto para crear tareas." };
        }

        // Get max position for ordering
        const lastTask = await db.query.projectTasks.findFirst({
            where: eq(projectTasks.projectId, validated.data.projectId),
            orderBy: [desc(projectTasks.position)],
        });

        const [newTask] = await db.insert(projectTasks).values({
            projectId: validated.data.projectId,
            title: validated.data.title,
            description: validated.data.description || null,
            priority: validated.data.priority,
            dueDate: validated.data.dueDate || null,
            createdById: session.user.id,
            position: (lastTask?.position ?? 0) + 1,
        }).returning();

        revalidateProjects();
        return { success: true as const, data: newTask, message: "Tarea creada." };
    } catch (error) {
        console.error("Error creating task:", error);
        return { success: false as const, error: "Error al crear tarea." };
    }
}

/** Update a task */
export async function updateTaskAction(input: UpdateTaskDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = UpdateTaskSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const task = await db.query.projectTasks.findFirst({
            where: eq(projectTasks.id, validated.data.id),
        });
        if (!task) return { success: false as const, error: "Tarea no encontrada." };

        const canManage = await canManageProject(session.user.id, session.user.role || "", task.projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos para editar esta tarea." };

        await db.update(projectTasks).set({
            title: validated.data.title,
            description: validated.data.description || null,
            status: validated.data.status,
            priority: validated.data.priority,
            dueDate: validated.data.dueDate || null,
            completedAt: validated.data.status === "DONE" ? new Date() : null,
            updatedAt: new Date(),
        }).where(eq(projectTasks.id, validated.data.id));

        revalidateProjects();
        return { success: true as const, message: "Tarea actualizada." };
    } catch (error) {
        console.error("Error updating task:", error);
        return { success: false as const, error: "Error al actualizar tarea." };
    }
}

/** Quick status update (any assigned member or project manager can do this) */
export async function updateTaskStatusAction(input: UpdateTaskStatusDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = UpdateTaskStatusSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const task = await db.query.projectTasks.findFirst({
            where: eq(projectTasks.id, validated.data.id),
            with: { assignments: true },
        });
        if (!task) return { success: false as const, error: "Tarea no encontrada." };

        // Allow: assigned user, project manager, or system admin
        const isAssigned = task.assignments.some(a => a.userId === session.user.id);
        const canManage = await canManageProject(session.user.id, session.user.role || "", task.projectId, session.user.customPermissions);

        if (!isAssigned && !canManage) {
            return { success: false as const, error: "Solo puedes actualizar tareas asignadas a ti." };
        }

        await db.update(projectTasks).set({
            status: validated.data.status,
            completedAt: validated.data.status === "DONE" ? new Date() : null,
            updatedAt: new Date(),
        }).where(eq(projectTasks.id, validated.data.id));

        revalidateProjects();
        return { success: true as const, message: "Estado actualizado." };
    } catch (error) {
        console.error("Error updating task status:", error);
        return { success: false as const, error: "Error al actualizar estado." };
    }
}

/** Delete a task */
export async function deleteTaskAction(taskId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const task = await db.query.projectTasks.findFirst({
            where: eq(projectTasks.id, taskId),
        });
        if (!task) return { success: false as const, error: "Tarea no encontrada." };

        const canManage = await canManageProject(session.user.id, session.user.role || "", task.projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos." };

        await db.delete(projectTasks).where(eq(projectTasks.id, taskId));
        revalidateProjects();
        return { success: true as const, message: "Tarea eliminada." };
    } catch (error) {
        console.error("Error deleting task:", error);
        return { success: false as const, error: "Error al eliminar tarea." };
    }
}

// =============================================================================
// TASK ASSIGNMENTS
// =============================================================================

/** Assign a user to a task */
export async function assignTaskAction(input: AssignTaskDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = AssignTaskSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const task = await db.query.projectTasks.findFirst({
            where: eq(projectTasks.id, validated.data.taskId),
        });
        if (!task) return { success: false as const, error: "Tarea no encontrada." };

        const canManage = await canManageProject(session.user.id, session.user.role || "", task.projectId);
        if (!canManage) return { success: false as const, error: "No tienes permisos para asignar tareas." };

        // Check not already assigned
        const existing = await db.query.taskAssignments.findFirst({
            where: and(
                eq(taskAssignments.taskId, validated.data.taskId),
                eq(taskAssignments.userId, validated.data.userId),
            ),
        });
        if (existing) return { success: false as const, error: "El usuario ya está asignado a esta tarea." };

        await db.insert(taskAssignments).values({
            taskId: validated.data.taskId,
            userId: validated.data.userId,
        });

        revalidateProjects();
        return { success: true as const, message: "Usuario asignado a la tarea." };
    } catch (error) {
        console.error("Error assigning task:", error);
        return { success: false as const, error: "Error al asignar tarea." };
    }
}

/** Remove a user assignment from a task */
export async function unassignTaskAction(assignmentId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const assignment = await db.query.taskAssignments.findFirst({
            where: eq(taskAssignments.id, assignmentId),
            with: { task: true },
        });
        if (!assignment) return { success: false as const, error: "Asignación no encontrada." };

        const canManage = await canManageProject(session.user.id, session.user.role || "", assignment.task.projectId, session.user.customPermissions);
        if (!canManage) return { success: false as const, error: "No tienes permisos." };

        await db.delete(taskAssignments).where(eq(taskAssignments.id, assignmentId));
        revalidateProjects();
        return { success: true as const, message: "Asignación removida." };
    } catch (error) {
        console.error("Error unassigning task:", error);
        return { success: false as const, error: "Error al remover asignación." };
    }
}
