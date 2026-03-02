"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { users, positionHistory, areas } from "@/db/schema";
import { getAllCustomRolesDAO, getCustomPermissionsForUser } from "@/server/data-access/custom-roles";
import { desc, asc } from "drizzle-orm";
import { PERMISSIONS, type Permission, type Role } from "@/lib/permissions";
import type { ActionResult } from "@/types";

// =============================================================================
// TYPES
// =============================================================================

export interface AuditUser {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string | null;
    status: string | null;
    currentAreaId: string | null;
    currentAreaName: string | null;
    currentAreaColor: string | null;
    customRoleNames: string[];
    customPermissions: string[];
    effectivePermissions: EffectivePermission[];
}

export interface EffectivePermission {
    permission: string;
    granted: boolean;
    source: "role" | "custom" | "both" | null;
}

export interface AuditCustomRole {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    position: number | null;
    isSystem: boolean | null;
    permissions: string[];
    assignedUserCount: number;
}

export interface AuditHistoryEntry {
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    role: string | null;
    areaId: string | null;
    areaName: string | null;
    reason: string | null;
    startDate: Date | null;
    endDate: Date | null;
}

export interface AuditData {
    users: AuditUser[];
    customRoles: AuditCustomRole[];
    history: AuditHistoryEntry[];
    allPermissions: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function computeEffectivePermissions(
    systemRole: string | null,
    customPerms: string[]
): EffectivePermission[] {
    const allPerms = Object.keys(PERMISSIONS) as Permission[];
    return allPerms.map((perm) => {
        const allowedRoles = PERMISSIONS[perm] as readonly string[];
        const fromRole = systemRole ? allowedRoles.includes(systemRole) : false;
        const fromCustom = customPerms.includes(perm);
        return {
            permission: perm,
            granted: fromRole || fromCustom,
            source: fromRole && fromCustom
                ? "both" as const
                : fromRole
                    ? "role" as const
                    : fromCustom
                        ? "custom" as const
                        : null,
        };
    });
}

// =============================================================================
// MAIN ACTION
// =============================================================================

export async function getAuditDataAction(): Promise<ActionResult<AuditData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const role = session.user.role;
        if (!role || !["DEV", "PRESIDENT"].includes(role)) {
            return { success: false, error: "Sin permisos para acceder a la auditoría" };
        }

        // Fetch all data in parallel
        const [allUsers, customRolesData, historyData] = await Promise.all([
            db.query.users.findMany({
                columns: {
                    id: true, name: true, email: true, image: true,
                    role: true, status: true, currentAreaId: true,
                },
                with: {
                    currentArea: { columns: { id: true, name: true, color: true } },
                    customRoles: {
                        with: {
                            customRole: {
                                with: { permissions: true },
                            },
                        },
                    },
                },
                orderBy: [asc(users.name)],
            }),
            getAllCustomRolesDAO(),
            db.query.positionHistory.findMany({
                with: {
                    user: { columns: { id: true, name: true, email: true } },
                    area: { columns: { id: true, name: true } },
                },
                orderBy: [desc(positionHistory.startDate)],
                limit: 200,
            }),
        ]);

        // Build audit users with effective permissions
        const auditUsers: AuditUser[] = allUsers.map((u) => {
            const customPerms: string[] = [];
            const customRoleNames: string[] = [];

            for (const ucr of (u as any).customRoles ?? []) {
                customRoleNames.push(ucr.customRole.name);
                for (const p of ucr.customRole.permissions) {
                    if (!customPerms.includes(p.permission)) {
                        customPerms.push(p.permission);
                    }
                }
            }

            return {
                id: u.id,
                name: u.name,
                email: u.email,
                image: u.image,
                role: u.role,
                status: u.status,
                currentAreaId: u.currentAreaId,
                currentAreaName: (u as any).currentArea?.name ?? null,
                currentAreaColor: (u as any).currentArea?.color ?? null,
                customRoleNames,
                customPermissions: customPerms,
                effectivePermissions: computeEffectivePermissions(u.role, customPerms),
            };
        });

        // Build custom roles summary
        const auditRoles: AuditCustomRole[] = customRolesData.map((cr) => ({
            id: cr.id,
            name: cr.name,
            description: cr.description,
            color: cr.color,
            position: cr.position,
            isSystem: cr.isSystem,
            permissions: cr.permissions.map((p: any) => p.permission),
            assignedUserCount: cr.userAssignments?.length ?? 0,
        }));

        // Build position history
        const auditHistory: AuditHistoryEntry[] = historyData.map((h) => ({
            id: h.id,
            userId: h.userId,
            userName: (h as any).user?.name ?? null,
            userEmail: (h as any).user?.email ?? null,
            role: h.role,
            areaId: h.areaId,
            areaName: (h as any).area?.name ?? null,
            reason: h.reason,
            startDate: h.startDate,
            endDate: h.endDate,
        }));

        return {
            success: true,
            data: {
                users: auditUsers,
                customRoles: auditRoles,
                history: auditHistory,
                allPermissions: Object.keys(PERMISSIONS),
            },
        };
    } catch (error) {
        console.error("Error getAuditDataAction:", error);
        return { success: false, error: "Error al obtener datos de auditoría" };
    }
}
