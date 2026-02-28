"use server";

import { auth } from "@/server/auth";
import {
    getUsersListService,
    promoteUserService,
    updateUserDataService,
    moderateUserService,
} from "@/server/services/user.service";
import { getFullUserProfile } from "@/server/data-access/users";
import { ActionResult } from "@/types";
import {
    UpdateUserRoleSchema,
    UpdateUserProfileSchema,
    ModerateUserSchema,
} from "@/lib/validators/user";
import { revalidatePath } from "next/cache";

// --- 1. Get Users with Filters ---
export async function getUsersAction(
    search?: string,
    role?: string,
    status?: string,
    areaId?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    page: number = 1
): Promise<ActionResult<any>> {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autenticado" };

        const result = await getUsersListService(
            { search, role, status, areaId, sortBy, sortOrder },
            { page, limit: 10 }
        );

        return { success: true, data: result };
    } catch (error) {
        console.error("Error getUsersAction:", error);
        return { success: false, error: "Error al obtener usuarios" };
    }
}

// --- 2. Update Role (Promote/Transfer) ---
export async function updateUserRoleAction(input: any): Promise<ActionResult<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        // Validar input
        const validated = UpdateUserRoleSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: "Datos inválidos: " + validated.error.message };
        }

        const updatedUser = await promoteUserService(session.user.id, validated.data);
        revalidatePath("/dashboard/users");
        return { success: true, data: updatedUser };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- 3. Update Profile Data ---
export async function updateUserDataAction(input: any): Promise<ActionResult<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const validated = UpdateUserProfileSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: "Datos inválidos" };
        }

        const updatedUser = await updateUserDataService(session.user.id, validated.data);
        revalidatePath("/dashboard/users");
        return { success: true, data: updatedUser };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- 4. Moderate User ---
export async function moderateUserAction(input: any): Promise<ActionResult<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const validated = ModerateUserSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: "Razón de moderación requerida" };
        }

        const result = await moderateUserService(session.user.id, validated.data);
        revalidatePath("/dashboard/users");
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- 5. Get Full User Profile (Read-Only) ---
export async function getMyProfileAction(): Promise<ActionResult<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const fullProfile = await getFullUserProfile(session.user.id);

        if (!fullProfile) {
            return { success: false, error: "Perfil no encontrado" };
        }

        return { success: true, data: fullProfile };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
