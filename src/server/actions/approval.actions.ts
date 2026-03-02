"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

// ─── Get pending approval users ──────────────────────────────────────────────

export async function getPendingUsersAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "user:manage", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const pendingUsers = await db.query.users.findMany({
            where: eq(users.status, "PENDING_APPROVAL"),
            orderBy: [desc(users.createdAt)],
            columns: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                image: true,
                createdAt: true,
            },
        });

        return { success: true as const, data: pendingUsers };
    } catch (error) {
        console.error("Error fetching pending users:", error);
        return { success: false as const, error: "Error al cargar solicitudes." };
    }
}

// ─── Get pending count (for badge in admin hub) ─────────────────────────────

export async function getPendingCountAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "user:manage", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(eq(users.status, "PENDING_APPROVAL"));

        return { success: true as const, data: result.count };
    } catch (error) {
        console.error("Error fetching pending count:", error);
        return { success: false as const, error: "Error al contar solicitudes." };
    }
}

// ─── Approve user ───────────────────────────────────────────────────────────

export async function approveUserAction(userId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "user:manage", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos para aprobar usuarios." };
        }

        // Verify the user exists and is actually pending
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { id: true, status: true, email: true, name: true }
        });

        if (!targetUser) return { success: false as const, error: "Usuario no encontrado." };

        if (targetUser.status !== "PENDING_APPROVAL") {
            return { success: false as const, error: "Este usuario no tiene una solicitud pendiente." };
        }

        await db.update(users).set({
            status: "ACTIVE",
            role: "MEMBER",
            updatedAt: new Date(),
        }).where(eq(users.id, userId));

        revalidatePath("/admin/approvals");
        revalidatePath("/admin/users");
        revalidatePath("/admin");
        return {
            success: true as const,
            message: `${targetUser.name || targetUser.email} aprobado como Miembro.`
        };
    } catch (error) {
        console.error("Error approving user:", error);
        return { success: false as const, error: "Error al aprobar usuario." };
    }
}

// ─── Reject (Ban) user ──────────────────────────────────────────────────────

export async function rejectUserAction(userId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "user:manage", session.user.customPermissions)) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { id: true, status: true, email: true, name: true }
        });

        if (!targetUser) return { success: false as const, error: "Usuario no encontrado." };

        if (targetUser.status !== "PENDING_APPROVAL") {
            return { success: false as const, error: "Este usuario no tiene una solicitud pendiente." };
        }

        await db.update(users).set({
            status: "BANNED",
            moderationReason: "Solicitud de acceso rechazada por un administrador.",
            updatedAt: new Date(),
        }).where(eq(users.id, userId));

        revalidatePath("/admin/approvals");
        revalidatePath("/admin");
        return {
            success: true as const,
            message: `Solicitud de ${targetUser.name || targetUser.email} rechazada y cuenta baneada.`
        };
    } catch (error) {
        console.error("Error rejecting user:", error);
        return { success: false as const, error: "Error al rechazar usuario." };
    }
}
