"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { users, positionHistory, areaPermissions as areaPermissionsTable } from "@/db/schema";
import { getAllCustomRolesDAO } from "@/server/data-access/custom-roles";
import { desc, asc, eq } from "drizzle-orm";
import { PERMISSIONS, hasPermission, type Permission } from "@/lib/permissions";
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
    eventCapabilities: AuditEventCapabilities;
}

// =============================================================================
// EVENT CAPABILITIES TYPES
// =============================================================================

export interface IISEEventCapability {
    userId: string;
    canGeneral: boolean;
    canArea: boolean;
    canIndividual: boolean;
    canManage: boolean;
    /** "any" = admin can target all areas, "own" = director locked to own area, null = cannot create area events */
    areaTarget: "any" | "own" | null;
    sourceGeneral: "role" | "custom" | "area_flag" | null;
    sourceArea: "role" | "custom" | "area_flag" | null;
    sourceIndividual: "role" | "custom" | "area_flag" | null;
}

export interface ProjectEventCapability {
    userId: string;
    projectId: string;
    projectName: string;
    projectRoleName: string | null;
    projectAreaName: string | null;
    canGeneral: boolean;
    canArea: boolean;
    canIndividual: boolean;
    /** "any" = role grants all areas, "own" = area flag grants own area only, null = can't */
    areaTarget: "any" | "own" | null;
    source: "project_role" | "project_area" | "both" | null;
}

export interface AuditEventCapabilities {
    iise: IISEEventCapability[];
    project: ProjectEventCapability[];
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

/**
 * Compute IISE event capabilities for a single user.
 * Uses the 3-layer permission system:
 *   Layer 1: System role (PERMISSIONS map)
 *   Layer 2: Custom role perms (in customPerms)
 *   Layer 3: Area perms (in areaPerms, merged for display)
 */
function computeIISECapability(
    userId: string,
    systemRole: string | null,
    customPerms: string[],
    areaPerms: string[],
): IISEEventCapability {
    // Merge custom + area perms for hasPermission checks
    const allExtra = [...new Set([...customPerms, ...areaPerms])];

    // --- Helper to determine source ---
    function getSource(perm: string): "role" | "custom" | "area_flag" | null {
        const roleDefault = systemRole && (PERMISSIONS[perm as keyof typeof PERMISSIONS] as readonly string[] | undefined)?.includes(systemRole);
        const fromCustom = customPerms.includes(perm);
        const fromArea = areaPerms.includes(perm);
        if (roleDefault) return "role";
        if (fromCustom) return "custom";
        if (fromArea) return "area_flag";
        return null;
    }

    // --- GENERAL ---
    const canGeneral = hasPermission(systemRole, "event:create_general", allExtra);
    const sourceGeneral = getSource("event:create_general");

    // --- AREA ---
    const canAreaOwn = hasPermission(systemRole, "event:create_area_own", allExtra);
    const canAreaAny = hasPermission(systemRole, "event:create_area_any", allExtra);
    const canArea = canAreaOwn || canAreaAny;
    const sourceArea = getSource("event:create_area_any") ?? getSource("event:create_area_own");

    let areaTarget: IISEEventCapability["areaTarget"] = null;
    if (canAreaAny) areaTarget = "any";
    else if (canAreaOwn) areaTarget = "own";

    // --- INDIVIDUAL_GROUP ---
    const canIndividual = hasPermission(systemRole, "event:create_meeting", allExtra);
    const sourceIndiv = getSource("event:create_meeting");

    // --- MANAGE ---
    const canManage = hasPermission(systemRole, "event:manage_all", allExtra) ||
        hasPermission(systemRole, "event:manage_own", allExtra);

    return {
        userId,
        canGeneral,
        canArea,
        canIndividual,
        canManage,
        areaTarget,
        sourceGeneral,
        sourceArea,
        sourceIndividual: sourceIndiv,
    };
}

/**
 * Compute PROJECT event capabilities for a single project membership.
 */
function computeProjectCapability(
    userId: string,
    projectId: string,
    projectName: string,
    roleName: string | null,
    areaName: string | null,
    roleCanCreate: boolean,
    areaMembersCanCreate: boolean,
): ProjectEventCapability {
    const canGeneral = roleCanCreate;
    const canArea = roleCanCreate || areaMembersCanCreate;
    const canIndividual = roleCanCreate || areaMembersCanCreate;

    let areaTarget: ProjectEventCapability["areaTarget"] = null;
    if (canArea) {
        if (roleCanCreate) {
            areaTarget = areaMembersCanCreate ? "any" : "any"; // role-level = any area
        } else {
            areaTarget = "own"; // area flag = own area only
        }
    }

    const source: ProjectEventCapability["source"] = roleCanCreate && areaMembersCanCreate
        ? "both"
        : roleCanCreate
            ? "project_role"
            : areaMembersCanCreate
                ? "project_area"
                : null;

    return {
        userId,
        projectId,
        projectName,
        projectRoleName: roleName,
        projectAreaName: areaName,
        canGeneral,
        canArea,
        canIndividual,
        areaTarget,
        source,
    };
}

// =============================================================================
// MAIN ACTION
// =============================================================================

export async function getAuditDataAction(): Promise<ActionResult<AuditData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const role = session.user.role || "";
        if (!hasPermission(role, "admin:audit", session.user.customPermissions)) {
            return { success: false, error: "Sin permisos para acceder a la auditoría" };
        }

        // Fetch all data in parallel
        const [allUsers, customRolesData, historyData, allProjectMemberships, allAreaPerms] = await Promise.all([
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
            db.query.projectMembers.findMany({
                with: {
                    project: { columns: { id: true, name: true, status: true } },
                    projectRole: { columns: { id: true, name: true, canCreateEvents: true, canViewAllAreaEvents: true } },
                    projectArea: { columns: { id: true, name: true, membersCanCreateEvents: true } },
                },
            }),
            // Fetch all area permissions for capability audit
            db.query.areaPermissions.findMany({
                columns: { areaId: true, permission: true },
            }),
        ]);

        // Build area permissions map: areaId -> string[]
        const areaPermsMap = new Map<string, string[]>();
        for (const ap of allAreaPerms) {
            if (!areaPermsMap.has(ap.areaId)) areaPermsMap.set(ap.areaId, []);
            areaPermsMap.get(ap.areaId)!.push(ap.permission);
        }

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

            const areaPerms = u.currentAreaId ? (areaPermsMap.get(u.currentAreaId) ?? []) : [];
            const allExtraPerms = Array.from(new Set([...customPerms, ...areaPerms]));

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
                customPermissions: allExtraPerms,
                effectivePermissions: computeEffectivePermissions(u.role, allExtraPerms),
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

        // Build IISE event capabilities per user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const iiseCapabilities: IISEEventCapability[] = allUsers.map((u: any) => {
            const customPerms: string[] = [];
            for (const ucr of u.customRoles ?? []) {
                for (const p of ucr.customRole.permissions) {
                    if (!customPerms.includes(p.permission)) customPerms.push(p.permission);
                }
            }

            const areaPerms = u.currentAreaId ? (areaPermsMap.get(u.currentAreaId) ?? []) : [];

            return computeIISECapability(u.id, u.role, customPerms, areaPerms);
        });

        // Build PROJECT event capabilities per membership
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectCapabilities: ProjectEventCapability[] = allProjectMemberships
            .filter((m: any) => m.project?.status !== "CANCELLED")
            .map((m: any) => {
                const roleCanCreate = !!m.projectRole?.canCreateEvents;
                const areaMembersCanCreate = !!m.projectArea?.membersCanCreateEvents;

                return computeProjectCapability(
                    m.userId,
                    m.project?.id ?? m.projectId,
                    m.project?.name ?? "Proyecto Desconocido",
                    m.projectRole?.name ?? null,
                    m.projectArea?.name ?? null,
                    roleCanCreate,
                    areaMembersCanCreate,
                );
            });

        return {
            success: true,
            data: {
                users: auditUsers,
                customRoles: auditRoles,
                history: auditHistory,
                allPermissions: Object.keys(PERMISSIONS),
                eventCapabilities: {
                    iise: iiseCapabilities,
                    project: projectCapabilities,
                },
            },
        };
    } catch (error) {
        console.error("Error getAuditDataAction:", error);
        return { success: false, error: "Error al obtener datos de auditoría" };
    }
}
