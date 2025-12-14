"use server";

import { auth } from "@/server/auth";
import { getUsersListService, promoteUserService } from "@/server/services/user.service";
import { ActionResult } from "@/types";
import { UpdateUserSchema } from "@/lib/validators/user";
import { revalidatePath } from "next/cache";

export async function getUsersAction(): Promise<ActionResult<any[]>> {
    try {
        const session = await auth();
        if (!session?.user) {
            return { success: false, error: "No autorizado" };
        }

        const users = await getUsersListService();
        return { success: true, data: users };
    } catch (error) {
        console.error("Error in getUsersAction:", error);
        return { success: false, error: "Error al obtener usuarios" };
    }
}

export async function updateUserRoleAction(input: {
    userId: string;
    data: unknown;
}): Promise<ActionResult<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "No autorizado" };
        }

        // 1. Validar inputs
        const validatedData = UpdateUserSchema.safeParse(input.data);
        if (!validatedData.success) {
            return { success: false, error: "Datos inválidos: " + validatedData.error.message };
        }

        // 2. Llamar al servicio
        const updatedUser = await promoteUserService(
            session.user.id,
            input.userId,
            validatedData.data
        );

        revalidatePath("/dashboard/users"); // O donde listes los usuarios
        return { success: true, data: updatedUser };
    } catch (error: any) {
        console.error("Error in updateUserRoleAction:", error);
        return { success: false, error: error.message || "Error al actualizar usuario" };
    }
}
