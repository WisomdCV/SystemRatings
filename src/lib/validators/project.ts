import { z } from "zod";

// ─── Project Statuses ────────────────────────────────────────────────────────
export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const PROJECT_ROLES = ["DIRECTOR", "COORDINATOR", "MEMBER"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

// ─── Project Schemas ─────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(200),
    description: z.string().max(2000).optional().nullable(),
    priority: z.enum(PROJECT_PRIORITIES).default("MEDIUM"),
    startDate: z.date().optional().nullable(),
    deadline: z.date().optional().nullable(),
});

export const UpdateProjectSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2, "Nombre muy corto").max(200),
    description: z.string().max(2000).optional().nullable(),
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(PROJECT_PRIORITIES),
    startDate: z.date().optional().nullable(),
    deadline: z.date().optional().nullable(),
});

// ─── Member Schemas ──────────────────────────────────────────────────────────

export const AddProjectMemberSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    projectRole: z.enum(PROJECT_ROLES).default("MEMBER"),
});

export const UpdateProjectMemberRoleSchema = z.object({
    memberId: z.string().uuid(),
    projectRole: z.enum(PROJECT_ROLES),
});

// ─── Task Schemas ────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
    projectId: z.string().uuid(),
    title: z.string().min(1, "Título requerido").max(300),
    description: z.string().max(2000).optional().nullable(),
    priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
    dueDate: z.date().optional().nullable(),
});

export const UpdateTaskSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1, "Título requerido").max(300),
    description: z.string().max(2000).optional().nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    dueDate: z.date().optional().nullable(),
});

export const UpdateTaskStatusSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(TASK_STATUSES),
});

export const AssignTaskSchema = z.object({
    taskId: z.string().uuid(),
    userId: z.string().uuid(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateProjectDTO = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDTO = z.infer<typeof UpdateProjectSchema>;
export type AddProjectMemberDTO = z.infer<typeof AddProjectMemberSchema>;
export type UpdateProjectMemberRoleDTO = z.infer<typeof UpdateProjectMemberRoleSchema>;
export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>;
export type UpdateTaskStatusDTO = z.infer<typeof UpdateTaskStatusSchema>;
export type AssignTaskDTO = z.infer<typeof AssignTaskSchema>;
