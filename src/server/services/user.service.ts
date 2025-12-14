import * as userDAO from "../data-access/users";
import { UpdateUserDTO } from "@/lib/validators/user";

export async function getUsersListService() {
    return await userDAO.getAllUsers();
}

/**
 * Promueve o actualiza un usuario.
 * Solo puede ser ejecutado por usuarios con rol DEV o PRESIDENT.
 */
export async function promoteUserService(
    actorId: string,
    targetUserId: string,
    data: UpdateUserDTO
) {
    // 1. Verificar quien ejecuta la acción
    const actor = await userDAO.getUserById(actorId);

    if (!actor) {
        throw new Error("Usuario 'actor' no encontrado.");
    }

    const allowedRoles = ["DEV", "PRESIDENT"];
    if (!actor.role || !allowedRoles.includes(actor.role)) {
        throw new Error("No tienes permisos para realizar esta acción.");
    }

    // 2. Ejecutar la actualización
    const updatedUser = await userDAO.updateUser(targetUserId, data);
    return updatedUser;
}
