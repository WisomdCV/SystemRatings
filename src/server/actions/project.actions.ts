"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { projects, projectMembers, projectTasks, taskAssignments, projectRoles, taskComments, projectCycles } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { createProjectInvitationAction } from "@/server/actions/project-invitations.actions";
import {
    hasProjectPermission, hasAnyProjectPermission, canBypassProjectPerms,
} from "@/lib/project-permissions";
import {
    canAccessProject,
    filterVisibleProjects,
    filterVisibleTasks,
    type MembershipContext,
    type ProjectVisibilityContext,
} from "@/server/services/project-visibility.service";
import {
    getActiveSemester,
    getProjectCycleInSemester,
    isProjectWritable,
    normalizeProjectCycleFilter,
} from "@/server/services/project-cycle.service";
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
import { EXTENDABLE_PROJECT_STATUSES } from "@/lib/constants";
import type { CycleStatus, ProjectStatus, TaskStatus } from "@/lib/constants";

const TASK_DONE: TaskStatus = "DONE";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Load membership with full permission set (projectRole.permissions + projectArea) */
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

const revalidateProjects = () => {
    revalidatePath("/dashboard/projects");
};

// =============================================================================
// PROJECT CRUD
// =============================================================================

/** Get all projects for the active semester (any authenticated user can view) */
export async function getProjectsAction(cycleFilterInput?: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const cycleFilter = normalizeProjectCycleFilter(cycleFilterInput);
        const activeSemester = await getActiveSemester();

        const allProjects = await db.query.projects.findMany({
            orderBy: [desc(projects.createdAt)],
            with: {
                createdBy: { columns: { id: true, name: true, image: true } },
                cycles: {
                    with: {
                        semester: { columns: { id: true, name: true } },
                    },
                    orderBy: [desc(projectCycles.startedAt)],
                },
                members: {
                    with: {
                        user: { columns: { id: true, name: true, image: true, role: true, currentAreaId: true } },
                        projectRole: true,
                        projectArea: true,
                    },
                },
                tasks: true,
            },
        });

        const ACTIVE: CycleStatus = "ACTIVE";
        const ARCHIVED: CycleStatus = "ARCHIVED";
        const EXTENDED: CycleStatus = "EXTENDED";

        let cycleFilteredProjects = allProjects;
        if (cycleFilter === "active") {
            if (!activeSemester) return { success: false as const, error: "No hay ciclo activo." };
            cycleFilteredProjects = allProjects.filter((project) =>
                project.cycles.some((cycle) => cycle.semesterId === activeSemester.id && cycle.status === ACTIVE),
            );
        } else if (cycleFilter === "history") {
            cycleFilteredProjects = allProjects.filter((project) =>
                project.cycles.some((cycle) => cycle.status === ARCHIVED || cycle.status === EXTENDED),
            );
        }

        const visCtx: ProjectVisibilityContext = {
            userId: session.user.id!,
            userRole: session.user.role || "",
            userAreaId: session.user.currentAreaId,
            customPermissions: session.user.customPermissions,
        };

        const visibleProjects = filterVisibleProjects(cycleFilteredProjects, visCtx);
        const isAuditAdmin = hasPermission(session.user.role, "admin:audit", session.user.customPermissions);
        const data = isAuditAdmin
            ? visibleProjects
            : visibleProjects.map(({ _visibilityRule, ...project }) => project);

        return {
            success: true as const,
            data,
            cycleFilter,
            activeSemester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null,
        };
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

        const visCtx: ProjectVisibilityContext = {
            userId: session.user.id!,
            userRole: session.user.role || "",
            userAreaId: session.user.currentAreaId,
            customPermissions: session.user.customPermissions,
        };
        const projectAccess = await canAccessProject(projectId, visCtx);
        if (!projectAccess.visible) {
            return { success: false as const, error: "Proyecto no encontrado." };
        }

        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            with: {
                createdBy: { columns: { id: true, name: true, image: true, email: true } },
                semester: { columns: { id: true, name: true } },
                cycles: {
                    with: {
                        semester: { columns: { id: true, name: true } },
                    },
                    orderBy: [desc(projectCycles.startedAt)],
                },
                members: {
                    with: {
                        user: { columns: { id: true, name: true, image: true, email: true, role: true } },
                        projectRole: { with: { permissions: true } },
                        projectArea: true,
                    },
                },
                tasks: {
                    orderBy: [asc(projectTasks.position), desc(projectTasks.createdAt)],
                    with: {
                        createdBy: { columns: { id: true, name: true, image: true } },
                        projectArea: true,
                        assignments: {
                            with: { user: { columns: { id: true, name: true, image: true } } },
                        },
                        comments: {
                            columns: { id: true },
                        },
                    },
                },
            },
        });

        if (!project) return { success: false as const, error: "Proyecto no encontrado." };

        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        const membership = project.members.find((member) => member.user.id === session.user.id) || null;

        const membershipCtx: MembershipContext | null = membership
            ? {
                projectAreaId: membership.projectArea?.id || null,
                projectPermissions: (membership.projectRole.permissions ?? []).map((permission) => permission.permission),
            }
            : null;

        const visibleTasks = iiseBypass
            ? project.tasks
            : filterVisibleTasks(
                project.tasks,
                session.user.id!,
                membershipCtx,
                iiseBypass,
            ).map(({ _visibilityRule, ...task }) => task);

        const projectWithCommentCount = {
            ...project,
            isWritable: project.cycles.some((cycle) => cycle.status === ("ACTIVE" satisfies CycleStatus)),
            tasks: visibleTasks.map((task) => ({
                ...task,
                _commentCount: task.comments?.length ?? 0,
            })),
        };

        return { success: true as const, data: projectWithCommentCount };
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

        const activeSemester = await getActiveSemester();
        if (!activeSemester) return { success: false as const, error: "No hay ciclo activo." };

        const newProject = await db.transaction(async (tx) => {
            const [created] = await tx.insert(projects).values({
                semesterId: activeSemester.id,
                name: validated.data.name,
                description: validated.data.description || null,
                color: validated.data.color || undefined,
                priority: validated.data.priority,
                startDate: validated.data.startDate || null,
                deadline: validated.data.deadline || null,
                createdById: session.user.id,
            }).returning();

            await tx.insert(projectCycles).values({
                projectId: created.id,
                semesterId: activeSemester.id,
                status: "ACTIVE" satisfies CycleStatus,
            });

            // Auto-add creator as Coordinador (highest hierarchy) or find the highest available
            const coordinatorRole = await tx.query.projectRoles.findFirst({
                orderBy: [desc(projectRoles.hierarchyLevel)],
            });

            if (coordinatorRole) {
                await tx.insert(projectMembers).values({
                    projectId: created.id,
                    userId: session.user.id,
                    projectRoleId: coordinatorRole.id,
                });
            }

            return created;
        });

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

        const currentProject = await db.query.projects.findFirst({
            where: eq(projects.id, validated.data.id),
            columns: { status: true },
        });
        if (!currentProject) return { success: false as const, error: "Proyecto no encontrado." };

        // IISE bypass OR project:manage_settings (+ project:manage_status if status changes)
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const writable = await isProjectWritable(validated.data.id);
            if (!writable) {
                return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
            }

            const membership = await getProjectMembershipWithPerms(session.user.id, validated.data.id);
            if (!hasProjectPermission(membership, "project:manage_settings")) {
                return { success: false as const, error: "No tienes permisos para editar este proyecto." };
            }

            if (validated.data.status !== currentProject.status) {
                if (!hasProjectPermission(membership, "project:manage_status")) {
                    return { success: false as const, error: "No tienes permisos para cambiar el estado del proyecto." };
                }
            }
        }

        const COMPLETED: ProjectStatus = "COMPLETED";
        await db.update(projects).set({
            name: validated.data.name,
            description: validated.data.description || null,
            color: validated.data.color,
            status: validated.data.status,
            priority: validated.data.priority,
            startDate: validated.data.startDate || null,
            deadline: validated.data.deadline || null,
            completedAt: validated.data.status === COMPLETED ? new Date() : null,
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

        // IISE bypass OR project:delete
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const writable = await isProjectWritable(projectId);
            if (!writable) {
                return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
            }

            const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
            if (!hasProjectPermission(membership, "project:delete")) {
                return { success: false as const, error: "No tienes permisos para eliminar este proyecto." };
            }
        }

        await db.delete(projects).where(eq(projects.id, projectId));
        revalidateProjects();
        return { success: true as const, message: "Proyecto eliminado." };
    } catch (error) {
        console.error("Error deleting project:", error);
        return { success: false as const, error: "Error al eliminar proyecto." };
    }
}

/** Extend a project to the current active semester */
export async function extendProjectCycleAction(projectId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            columns: { id: true, status: true },
        });
        if (!project) return { success: false as const, error: "Proyecto no encontrado." };

        if (!(EXTENDABLE_PROJECT_STATUSES as readonly string[]).includes(project.status)) {
            return { success: false as const, error: "Solo se pueden extender proyectos en estado ACTIVO, PAUSADO o PLANIFICACIÓN." };
        }

        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
            if (!hasProjectPermission(membership, "project:manage_status")) {
                return { success: false as const, error: "No tienes permisos para extender este proyecto." };
            }
        }

        const activeSemester = await getActiveSemester();
        if (!activeSemester) return { success: false as const, error: "No hay ciclo activo." };

        const existingCurrentCycle = await getProjectCycleInSemester(projectId, activeSemester.id);
        if (existingCurrentCycle) {
            return { success: false as const, error: "Este proyecto ya está vinculado al ciclo activo." };
        }

        const ACTIVE_C: CycleStatus = "ACTIVE";
        const EXTENDED_C: CycleStatus = "EXTENDED";

        await db.transaction(async (tx) => {
            const previousActive = await tx.query.projectCycles.findFirst({
                where: and(
                    eq(projectCycles.projectId, projectId),
                    eq(projectCycles.status, ACTIVE_C),
                ),
                orderBy: [desc(projectCycles.startedAt)],
            });

            if (previousActive) {
                await tx.update(projectCycles).set({
                    status: EXTENDED_C,
                    endedAt: new Date(),
                }).where(eq(projectCycles.id, previousActive.id));
            }

            await tx.insert(projectCycles).values({
                projectId,
                semesterId: activeSemester.id,
                status: ACTIVE_C,
                extendedFromCycleId: previousActive?.id ?? null,
                extendedById: session.user.id,
            });
        });

        revalidateProjects();
        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true as const, message: "Proyecto extendido al ciclo activo." };
    } catch (error) {
        console.error("Error extending project cycle:", error);
        return { success: false as const, error: "Error al extender proyecto de ciclo." };
    }
}

/** Archive the currently active cycle for a project */
export async function archiveProjectCycleAction(projectId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, projectId);
            if (!hasProjectPermission(membership, "project:manage_status")) {
                return { success: false as const, error: "No tienes permisos para archivar este ciclo de proyecto." };
            }
        }

        const ACTIVE_ARCHIVE: CycleStatus = "ACTIVE";
        const ARCHIVED_STATUS: CycleStatus = "ARCHIVED";

        const activeCycle = await db.query.projectCycles.findFirst({
            where: and(
                eq(projectCycles.projectId, projectId),
                eq(projectCycles.status, ACTIVE_ARCHIVE),
            ),
            orderBy: [desc(projectCycles.startedAt)],
        });
        if (!activeCycle) {
            return { success: false as const, error: "El proyecto no tiene un ciclo activo para archivar." };
        }

        await db.update(projectCycles).set({
            status: ARCHIVED_STATUS,
            endedAt: new Date(),
        }).where(eq(projectCycles.id, activeCycle.id));

        revalidateProjects();
        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true as const, message: "Ciclo de proyecto archivado." };
    } catch (error) {
        console.error("Error archiving project cycle:", error);
        return { success: false as const, error: "Error al archivar ciclo de proyecto." };
    }
}

// =============================================================================
// PROJECT MEMBERS
// =============================================================================

/** Add a member to a project */
export async function addProjectMemberAction(input: AddProjectMemberDTO) {
    const validated = AddProjectMemberSchema.safeParse(input);
    if (!validated.success) {
        return { success: false as const, error: validated.error.issues[0].message };
    }

    return createProjectInvitationAction({
        projectId: validated.data.projectId,
        userId: validated.data.userId,
        projectRoleId: validated.data.projectRoleId,
        projectAreaId: validated.data.projectAreaId || null,
        message: null,
    });
}

/** Update a member's project role */
export async function updateProjectMemberRoleAction(input: UpdateProjectMemberRoleDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        const validated = UpdateProjectMemberRoleSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        // Look up the target member with their role
        const targetMember = await db.query.projectMembers.findFirst({
            where: eq(projectMembers.id, validated.data.memberId),
            with: { projectRole: true },
        });
        if (!targetMember) return { success: false as const, error: "Miembro no encontrado." };

        const writable = await isProjectWritable(targetMember.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        // IISE bypass OR project:manage_members + hierarchy guard
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const myMembership = await getProjectMembershipWithPerms(session.user.id, targetMember.projectId);
            if (!hasProjectPermission(myMembership, "project:manage_members")) {
                return { success: false as const, error: "No tienes permisos para gestionar miembros." };
            }

            if (!myMembership) {
                return { success: false as const, error: "No eres miembro del proyecto." };
            }

            // Hierarchy guard: can't modify someone at or above your level
            if (targetMember.projectRole.hierarchyLevel >= myMembership.projectRole.hierarchyLevel) {
                return { success: false as const, error: "No puedes modificar a un miembro de igual o mayor jerarquía." };
            }

            if (validated.data.projectRoleId !== targetMember.projectRoleId) {
                const newRole = await db.query.projectRoles.findFirst({
                    where: eq(projectRoles.id, validated.data.projectRoleId),
                    columns: { hierarchyLevel: true },
                });
                if (!newRole) {
                    return { success: false as const, error: "El rol seleccionado no existe." };
                }
                if (newRole.hierarchyLevel > myMembership.projectRole.hierarchyLevel) {
                    return { success: false as const, error: "No puedes asignar un rol de mayor jerarquía que el tuyo." };
                }
            }
        }

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
            with: { projectRole: true },
        });
        if (!member) return { success: false as const, error: "Miembro no encontrado." };

        const writable = await isProjectWritable(member.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        // IISE bypass OR project:manage_members + hierarchy guard
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const myMembership = await getProjectMembershipWithPerms(session.user.id, member.projectId);
            if (!hasProjectPermission(myMembership, "project:manage_members")) {
                return { success: false as const, error: "No tienes permisos para gestionar miembros." };
            }
            // Hierarchy guard
            if (myMembership && member.projectRole.hierarchyLevel >= myMembership.projectRole.hierarchyLevel) {
                return { success: false as const, error: "No puedes remover a un miembro de igual o mayor jerarquía." };
            }
        }

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

        const writable = await isProjectWritable(validated.data.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);

        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, validated.data.projectId);
            if (!membership) {
                return { success: false as const, error: "Debes ser miembro del proyecto para crear tareas." };
            }

            // Check task creation permission
            const canCreateAny = hasProjectPermission(membership, "project:task_create_any");
            const canCreateOwnArea = hasProjectPermission(membership, "project:task_create_own_area");

            if (!canCreateAny && !canCreateOwnArea) {
                return { success: false as const, error: "Tu rol no permite crear tareas." };
            }

            // If only own-area permission, validate area match
            if (!canCreateAny && canCreateOwnArea && validated.data.projectAreaId) {
                if (membership.projectAreaId !== validated.data.projectAreaId) {
                    return { success: false as const, error: "Solo puedes crear tareas para tu propia área o tareas generales." };
                }
            }
        }

        // Get max position for ordering
        const lastTask = await db.query.projectTasks.findFirst({
            where: eq(projectTasks.projectId, validated.data.projectId),
            orderBy: [desc(projectTasks.position)],
        });

        const [newTask] = await db.insert(projectTasks).values({
            projectId: validated.data.projectId,
            projectAreaId: validated.data.projectAreaId || null,
            title: validated.data.title,
            description: validated.data.description || null,
            priority: validated.data.priority,
            startDate: validated.data.startDate || null,
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

        const writable = await isProjectWritable(task.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        // IISE bypass OR task_manage_any OR (task_manage_own + ownership/area)
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
            const canManageAny = hasProjectPermission(membership, "project:task_manage_any");
            const canManageOwn = hasProjectPermission(membership, "project:task_manage_own");

            if (!canManageAny) {
                // Check own: creator OR same area
                const isOwner = task.createdById === session.user.id;
                const isSameArea = membership?.projectAreaId != null && membership.projectAreaId === task.projectAreaId;
                if (!canManageOwn || (!isOwner && !isSameArea)) {
                    return { success: false as const, error: "No tienes permisos para editar esta tarea." };
                }
            }
        }

        await db.update(projectTasks).set({
            title: validated.data.title,
            description: validated.data.description || null,
            status: validated.data.status,
            priority: validated.data.priority,
            startDate: validated.data.startDate || null,
            dueDate: validated.data.dueDate || null,
            completedAt: validated.data.status === TASK_DONE ? new Date() : null,
            updatedAt: new Date(),
        }).where(eq(projectTasks.id, validated.data.id));

        revalidateProjects();
        return { success: true as const, message: "Tarea actualizada." };
    } catch (error) {
        console.error("Error updating task:", error);
        return { success: false as const, error: "Error al actualizar tarea." };
    }
}

/** Quick status update (any assigned member or user with task_update_status) */
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

        const writable = await isProjectWritable(task.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
            const membershipCtx: MembershipContext | null = membership
                ? {
                    projectAreaId: membership.projectAreaId,
                    projectPermissions: membership.projectRole.permissions.map((permission) => permission.permission),
                }
                : null;

            const visibleTask = filterVisibleTasks(
                [{
                    id: task.id,
                    projectAreaId: task.projectAreaId,
                    createdById: task.createdById,
                    assignments: task.assignments.map((assignment) => ({ user: { id: assignment.userId } })),
                }],
                session.user.id,
                membershipCtx,
                false,
            );

            if (visibleTask.length === 0) {
                return { success: false as const, error: "No tienes acceso a esta tarea." };
            }
        }

        // Allow: assigned user, IISE bypass, or user with task_update_status
        const isAssigned = task.assignments.some(a => a.userId === session.user.id);
        if (!isAssigned) {
            if (!iiseBypass) {
                const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
                if (!hasProjectPermission(membership, "project:task_update_status")) {
                    return { success: false as const, error: "Solo puedes actualizar tareas asignadas a ti." };
                }
            }
        }

        await db.update(projectTasks).set({
            status: validated.data.status,
            completedAt: validated.data.status === TASK_DONE ? new Date() : null,
            updatedAt: new Date(),
        }).where(eq(projectTasks.id, validated.data.id));

        revalidateProjects();
        return { success: true as const, message: "Estado actualizado." };
    } catch (error) {
        console.error("Error updating task status:", error);
        return { success: false as const, error: "Error al actualizar estado." };
    }
}

/** Reorder tasks within/between columns (Kanban/list drag-and-drop) */
export async function reorderTasksAction(input: {
    projectId: string;
    updates: { taskId: string; position: number; status?: string }[];
}) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!input.projectId || !Array.isArray(input.updates) || input.updates.length === 0) {
            return { success: false as const, error: "Payload de reordenamiento inválido." };
        }

        const writable = await isProjectWritable(input.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, input.projectId);
            if (!hasProjectPermission(membership, "project:task_manage_any")
                && !hasProjectPermission(membership, "project:task_update_status")) {
                return { success: false as const, error: "Sin permisos para reordenar tareas." };
            }
        }

        for (const update of input.updates) {
            const setData: Record<string, any> = {
                position: update.position,
                updatedAt: new Date(),
            };
            if (update.status) {
                setData.status = update.status;
                setData.completedAt = update.status === TASK_DONE ? new Date() : null;
            }

            await db.update(projectTasks)
                .set(setData)
                .where(and(
                    eq(projectTasks.id, update.taskId),
                    eq(projectTasks.projectId, input.projectId),
                ));
        }

        revalidateProjects();
        revalidatePath(`/dashboard/projects/${input.projectId}`);
        return { success: true as const, message: "Tareas reordenadas." };
    } catch (error) {
        console.error("Error reordering tasks:", error);
        return { success: false as const, error: "Error al reordenar tareas." };
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

        const writable = await isProjectWritable(task.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        // IISE bypass OR task_manage_any OR (task_manage_own + ownership/area)
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
            const canManageAny = hasProjectPermission(membership, "project:task_manage_any");
            const canManageOwn = hasProjectPermission(membership, "project:task_manage_own");

            if (!canManageAny) {
                const isOwner = task.createdById === session.user.id;
                const isSameArea = membership?.projectAreaId != null && membership.projectAreaId === task.projectAreaId;
                if (!canManageOwn || (!isOwner && !isSameArea)) {
                    return { success: false as const, error: "No tienes permisos para eliminar esta tarea." };
                }
            }
        }

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

        const writable = await isProjectWritable(task.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        // IISE bypass OR project:task_assign
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, task.projectId);
            if (!hasProjectPermission(membership, "project:task_assign")) {
                return { success: false as const, error: "No tienes permisos para asignar tareas." };
            }
        }

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

        const writable = await isProjectWritable(assignment.task.projectId);
        if (!writable) {
            return { success: false as const, error: "Este proyecto está en modo solo lectura para este ciclo." };
        }

        // IISE bypass OR project:task_assign
        const iiseBypass = canBypassProjectPerms(session.user.role || "", session.user.customPermissions);
        if (!iiseBypass) {
            const membership = await getProjectMembershipWithPerms(session.user.id, assignment.task.projectId);
            if (!hasProjectPermission(membership, "project:task_assign")) {
                return { success: false as const, error: "No tienes permisos para desasignar tareas." };
            }
        }

        await db.delete(taskAssignments).where(eq(taskAssignments.id, assignmentId));
        revalidateProjects();
        return { success: true as const, message: "Asignación removida." };
    } catch (error) {
        console.error("Error unassigning task:", error);
        return { success: false as const, error: "Error al remover asignación." };
    }
}
