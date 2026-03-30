import { z } from "zod";

// ─── Project Statuses ────────────────────────────────────────────────────────
export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"] as const;
export const INVITATION_EXPIRY_DAYS = 7;

// ─── Project Schemas ─────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(200),
    description: z.string().max(2000).optional().nullable(),
    priority: z.enum(PROJECT_PRIORITIES).default("MEDIUM"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").optional().nullable(),
    startDate: z.date().optional().nullable(),
    deadline: z.date().optional().nullable(),
});

export const UpdateProjectSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2, "Nombre muy corto").max(200),
    description: z.string().max(2000).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido"),
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(PROJECT_PRIORITIES),
    startDate: z.date().optional().nullable(),
    deadline: z.date().optional().nullable(),
});

// ─── Member Schemas ──────────────────────────────────────────────────────────

export const AddProjectMemberSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    projectRoleId: z.string().uuid(),
    projectAreaId: z.string().uuid().optional().nullable(),
});

export const UpdateProjectMemberRoleSchema = z.object({
    memberId: z.string().uuid(),
    projectRoleId: z.string().uuid(),
    projectAreaId: z.string().uuid().optional().nullable(),
});

// ─── Invitation Schemas ─────────────────────────────────────────────────────

export const CreateProjectInvitationSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    projectRoleId: z.string().uuid(),
    projectAreaId: z.string().uuid().optional().nullable(),
    message: z.string().max(500).optional().nullable(),
});

export const RespondInvitationSchema = z.object({
    invitationId: z.string().uuid(),
    action: z.enum(["ACCEPT", "REJECT"]),
    rejectionReason: z.string().max(500).optional().nullable(),
});

export const CancelInvitationSchema = z.object({
    invitationId: z.string().uuid(),
});

// ─── Resource Category Schemas ─────────────────────────────────────────────

export const CreateResourceCategorySchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(100),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
});

export const UpdateResourceCategorySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1, "Nombre requerido").max(100),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido").optional().nullable(),
});

// ─── Resource Schemas ──────────────────────────────────────────────────────

export const CreateResourceSchema = z.object({
    projectId: z.string().uuid(),
    projectAreaId: z.string().uuid().optional().nullable(),
    taskId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    name: z.string().min(1, "Nombre requerido").max(300),
    description: z.string().max(2000).optional().nullable(),
    links: z.array(z.object({
        url: z.string().url("URL inválida").max(2000),
        label: z.string().max(200).optional().nullable(),
    })).min(1, "Se requiere al menos un link"),
});

export const UpdateResourceSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1, "Nombre requerido").max(300),
    description: z.string().max(2000).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    projectAreaId: z.string().uuid().optional().nullable(),
});

// ─── Resource Link Schemas ─────────────────────────────────────────────────

export const AddResourceLinkSchema = z.object({
    resourceId: z.string().uuid(),
    url: z.string().url("URL inválida").max(2000),
    label: z.string().max(200).optional().nullable(),
});

export const UpdateResourceLinkSchema = z.object({
    linkId: z.string().uuid(),
    url: z.string().url("URL inválida").max(2000).optional(),
    label: z.string().max(200).optional().nullable(),
});

export const DeleteResourceLinkSchema = z.object({
    linkId: z.string().uuid(),
});

// ─── Task Schemas ────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
    projectId: z.string().uuid(),
    projectAreaId: z.string().uuid().optional().nullable(),
    title: z.string().min(1, "Título requerido").max(300),
    description: z.string().max(2000).optional().nullable(),
    priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
    startDate: z.date().optional().nullable(),
    dueDate: z.date().optional().nullable(),
}).refine(
    (data) => {
        if (data.startDate && data.dueDate) {
            return data.startDate <= data.dueDate;
        }
        return true;
    },
    { message: "La fecha de inicio no puede ser posterior a la fecha límite.", path: ["startDate"] }
);

export const UpdateTaskSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1, "Título requerido").max(300),
    description: z.string().max(2000).optional().nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    startDate: z.date().optional().nullable(),
    dueDate: z.date().optional().nullable(),
}).refine(
    (data) => {
        if (data.startDate && data.dueDate) {
            return data.startDate <= data.dueDate;
        }
        return true;
    },
    { message: "La fecha de inicio no puede ser posterior a la fecha límite.", path: ["startDate"] }
);

export const UpdateTaskStatusSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(TASK_STATUSES),
});

export const AssignTaskSchema = z.object({
    taskId: z.string().uuid(),
    userId: z.string().uuid(),
});

// ─── Task Comment Schemas ───────────────────────────────────────────────────

export const CreateTaskCommentSchema = z.object({
    taskId: z.string().uuid(),
    content: z.string().min(1, "Comentario vacío").max(2000),
    parentId: z.string().uuid().optional().nullable(),
});

export const UpdateTaskCommentSchema = z.object({
    commentId: z.string().uuid(),
    content: z.string().min(1, "Comentario vacío").max(2000),
});

export const DeleteTaskCommentSchema = z.object({
    commentId: z.string().uuid(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateProjectDTO = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDTO = z.infer<typeof UpdateProjectSchema>;
export type AddProjectMemberDTO = z.infer<typeof AddProjectMemberSchema>;
export type UpdateProjectMemberRoleDTO = z.infer<typeof UpdateProjectMemberRoleSchema>;
export type CreateProjectInvitationDTO = z.infer<typeof CreateProjectInvitationSchema>;
export type RespondInvitationDTO = z.infer<typeof RespondInvitationSchema>;
export type CancelInvitationDTO = z.infer<typeof CancelInvitationSchema>;
export type CreateResourceCategoryDTO = z.infer<typeof CreateResourceCategorySchema>;
export type UpdateResourceCategoryDTO = z.infer<typeof UpdateResourceCategorySchema>;
export type CreateResourceDTO = z.infer<typeof CreateResourceSchema>;
export type UpdateResourceDTO = z.infer<typeof UpdateResourceSchema>;
export type AddResourceLinkDTO = z.infer<typeof AddResourceLinkSchema>;
export type UpdateResourceLinkDTO = z.infer<typeof UpdateResourceLinkSchema>;
export type DeleteResourceLinkDTO = z.infer<typeof DeleteResourceLinkSchema>;
export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>;
export type UpdateTaskStatusDTO = z.infer<typeof UpdateTaskStatusSchema>;
export type AssignTaskDTO = z.infer<typeof AssignTaskSchema>;
export type CreateTaskCommentDTO = z.infer<typeof CreateTaskCommentSchema>;
export type UpdateTaskCommentDTO = z.infer<typeof UpdateTaskCommentSchema>;
export type DeleteTaskCommentDTO = z.infer<typeof DeleteTaskCommentSchema>;
