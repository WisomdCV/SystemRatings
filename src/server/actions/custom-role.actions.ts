"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import {
    getAllCustomRolesDAO,
    getCustomRoleByIdDAO,
    createCustomRoleDAO,
    updateCustomRoleDAO,
    deleteCustomRoleDAO,
    assignRoleToUserDAO,
    removeRoleFromUserDAO,
    getUserCustomRolesDAO,
} from "@/server/data-access/custom-roles";
import {
    CreateCustomRoleSchema,
    UpdateCustomRoleSchema,
    AssignCustomRoleSchema,
    type CreateCustomRoleDTO,
    type UpdateCustomRoleDTO,
    type AssignCustomRoleDTO,
} from "@/lib/validators/custom-role";

const revalidateRoles = () => {
    revalidatePath("/admin/roles");
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard");
};

// =============================================================================
// CUSTOM ROLE CRUD
// =============================================================================

/** List all custom roles with permissions and assigned users */
export async function getCustomRolesAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        // Anyone authenticated can see custom roles (for display purposes)
        const roles = await getAllCustomRolesDAO();
        return { success: true as const, data: roles };
    } catch (error) {
        console.error("Error fetching custom roles:", error);
        return { success: false as const, error: "Error al cargar roles." };
    }
}

/** Get a single custom role with full details */
export async function getCustomRoleByIdAction(roleId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const role = await getCustomRoleByIdDAO(roleId);
        if (!role) return { success: false as const, error: "Rol no encontrado." };

        return { success: true as const, data: role };
    } catch (error) {
        console.error("Error fetching custom role:", error);
        return { success: false as const, error: "Error al cargar rol." };
    }
}

/** Create a new custom role (admin only) */
export async function createCustomRoleAction(input: CreateCustomRoleDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!hasPermission(session.user.role, "admin:roles", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos para gestionar roles." };
        }

        const validated = CreateCustomRoleSchema.safeParse(input);
        if (!validated.success) {
            return { success: false as const, error: validated.error.issues[0].message };
        }

        const newRole = await createCustomRoleDAO(validated.data);
        revalidateRoles();
        return { success: true as const, data: newRole, message: "Rol creado exitosamente." };
    } catch (error: any) {
        if (error.message?.includes("UNIQUE")) {
            return { success: false as const, error: "Ya existe un rol con ese nombre." };
        }
        console.error("Error creating custom role:", error);
        return { success: false as const, error: "Error al crear rol." };
    }
}

/** Update an existing custom role (admin only) */
export async function updateCustomRoleAction(input: UpdateCustomRoleDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!hasPermission(session.user.role, "admin:roles", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const validated = UpdateCustomRoleSchema.safeParse(input);
        if (!validated.success) {
            return { success: false as const, error: validated.error.issues[0].message };
        }

        // Check role exists and is not a system role being renamed
        const existing = await getCustomRoleByIdDAO(validated.data.id);
        if (!existing) return { success: false as const, error: "Rol no encontrado." };

        await updateCustomRoleDAO(validated.data.id, validated.data);
        revalidateRoles();
        return { success: true as const, message: "Rol actualizado." };
    } catch (error: any) {
        if (error.message?.includes("UNIQUE")) {
            return { success: false as const, error: "Ya existe un rol con ese nombre." };
        }
        console.error("Error updating custom role:", error);
        return { success: false as const, error: "Error al actualizar rol." };
    }
}

/** Delete a custom role (admin only, non-system roles only) */
export async function deleteCustomRoleAction(roleId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!hasPermission(session.user.role, "admin:roles", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const existing = await getCustomRoleByIdDAO(roleId);
        if (!existing) return { success: false as const, error: "Rol no encontrado." };

        if (existing.isSystem) {
            return { success: false as const, error: "No se puede eliminar un rol del sistema." };
        }

        await deleteCustomRoleDAO(roleId);
        revalidateRoles();
        return { success: true as const, message: "Rol eliminado." };
    } catch (error) {
        console.error("Error deleting custom role:", error);
        return { success: false as const, error: "Error al eliminar rol." };
    }
}

// =============================================================================
// USER ↔ CUSTOM ROLE ASSIGNMENTS
// =============================================================================

/** Assign a custom role to a user (admin only) */
export async function assignCustomRoleAction(input: AssignCustomRoleDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!hasPermission(session.user.role, "admin:roles", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const validated = AssignCustomRoleSchema.safeParse(input);
        if (!validated.success) {
            return { success: false as const, error: validated.error.issues[0].message };
        }

        await assignRoleToUserDAO(validated.data.userId, validated.data.customRoleId, session.user.id);
        revalidateRoles();
        return { success: true as const, message: "Rol asignado al usuario." };
    } catch (error) {
        console.error("Error assigning role:", error);
        return { success: false as const, error: "Error al asignar rol." };
    }
}

/** Remove a custom role from a user (admin only) */
export async function removeCustomRoleAction(input: AssignCustomRoleDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false as const, error: "No autorizado" };

        if (!hasPermission(session.user.role, "admin:roles", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const validated = AssignCustomRoleSchema.safeParse(input);
        if (!validated.success) {
            return { success: false as const, error: validated.error.issues[0].message };
        }

        await removeRoleFromUserDAO(validated.data.userId, validated.data.customRoleId);
        revalidateRoles();
        return { success: true as const, message: "Rol removido del usuario." };
    } catch (error) {
        console.error("Error removing role:", error);
        return { success: false as const, error: "Error al remover rol." };
    }
}

/** Get all custom roles assigned to a specific user */
export async function getUserCustomRolesAction(userId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const roles = await getUserCustomRolesDAO(userId);
        return { success: true as const, data: roles };
    } catch (error) {
        console.error("Error fetching user roles:", error);
        return { success: false as const, error: "Error al cargar roles del usuario." };
    }
}
