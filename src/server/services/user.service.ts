import * as userDAO from "../data-access/users";
import { db } from "@/db";
import { positionHistory, semesters, users } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
    UpdateUserRoleDTO,
    UpdateUserProfileDTO,
    ModerateUserDTO,
} from "@/lib/validators/user";
import { canAssignRoleByHierarchy, canManageUserByHierarchy } from "@/lib/permissions";
import type { UserStatus } from "@/lib/constants";

// --- Helpers ---
async function getActiveSemesterId() {
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true),
    });
    return activeSemester?.id || null;
}

// --- Services ---

export async function getUsersListService(
    filters?: userDAO.UserFilters,
    pagination?: userDAO.PaginationOptions
) {
    return await userDAO.getAllUsers(filters, pagination);
}

/**
 * Funcionalidad 2: Ascenso o Traslado de Área
 */
export async function promoteUserService(
    actorId: string,
    data: UpdateUserRoleDTO
) {
    // 1. Verificar actor y usuario objetivo
    const actor = await userDAO.getUserById(actorId);
    const targetUser = await userDAO.getUserById(data.userId);
    if (!actor || !targetUser) throw new Error("Usuario no encontrado.");

    if (!canManageUserByHierarchy(actor.role, targetUser.role)) {
        throw new Error("No autorizado: no puedes modificar usuarios de igual o mayor jerarquía.");
    }

    if (!canAssignRoleByHierarchy(actor.role, data.role)) {
        throw new Error("No autorizado: no puedes asignar un rol igual o superior al tuyo.");
    }

    // 2. Regla de Negocio: DIRECTOR/SUBDIRECTOR debe tener área
    if (["DIRECTOR", "SUBDIRECTOR"].includes(data.role) && !data.areaId) {
        throw new Error("Un Director o Subdirector debe pertenecer a un Área.");
    }

    // 3. Verificar si realmente hay cambios
    if (targetUser.role === data.role && targetUser.currentAreaId === data.areaId) {
        return targetUser; // No op
    }

    // 4. Transacción de Base de Datos
    return await db.transaction(async (tx) => {
        const currentSemesterId = await getActiveSemesterId();

        // A. Cerrar Historial Anterior (si existe uno abierto)
        await tx
            .update(positionHistory)
            .set({ endDate: new Date() })
            .where(
                and(
                    eq(positionHistory.userId, data.userId),
                    isNull(positionHistory.endDate)
                )
            );

        // B. Crear Nuevo Historial
        await tx.insert(positionHistory).values({
            userId: data.userId,
            role: data.role,
            areaId: data.areaId,
            semesterId: currentSemesterId, // Podría ser null si no hay semestre activo
            reason: data.reason, // Save the audit reason
            startDate: new Date(),
        });

        // C. Actualizar Usuario
        const [updatedUser] = await tx
            .update(users)
            .set({
                role: data.role,
                currentAreaId: data.areaId, // Puede ser null
                updatedAt: new Date(),
            })
            .where(eq(users.id, data.userId))
            .returning();

        return updatedUser;
    });
}

/**
 * Funcionalidad 3: Actualización de Datos Administrativos
 */
export async function updateUserDataService(
    actorId: string,
    data: UpdateUserProfileDTO
) {
    // 1. Verificar actor y target para regla jerárquica
    const actor = await userDAO.getUserById(actorId);
    const targetUser = await userDAO.getUserById(data.userId);
    if (!actor || !targetUser) throw new Error("Usuario no encontrado.");

    if (!canManageUserByHierarchy(actor.role, targetUser.role)) {
        throw new Error("No autorizado: no puedes editar datos de usuarios de igual o mayor jerarquía.");
    }

    // 2. Verificar duplicidad de CUI (si aplica)
    if (data.cui) {
        const existingCui = await db.query.users.findFirst({
            where: and(eq(users.cui, data.cui), sql`${users.id} != ${data.userId}`)
        });
        if (existingCui) throw new Error("El CUI ya está registrado por otro usuario.");
    }

    // 3. Actualizar
    return await userDAO.updateUser(data.userId, {
        cui: data.cui,
        phone: data.phone,
        category: data.category,
    });
}

/**
 * Funcionalidad 4: Moderación
 */
export async function moderateUserService(
    actorId: string,
    data: ModerateUserDTO
) {
    const actor = await userDAO.getUserById(actorId);
    const targetUser = await userDAO.getUserById(data.userId);

    if (!actor || !targetUser) throw new Error("Usuario no encontrado.");

    if (!canManageUserByHierarchy(actor.role, targetUser.role)) {
        throw new Error("No autorizado: no puedes moderar usuarios de igual o mayor jerarquía.");
    }

    // Logic: If status is not SUSPENDED, clear suspendedUntil
    const suspendedUntil = data.status === ("SUSPENDED" satisfies UserStatus) ? data.suspendedUntil : null;

    return await userDAO.updateUser(data.userId, {
        status: data.status,
        moderationReason: data.moderationReason,
        suspendedUntil: suspendedUntil,
    });
}
