"use server";

import { db } from "@/db";
import { customRoles, customRolePermissions, userCustomRoles } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

// =============================================================================
// CUSTOM PERMISSIONS RESOLVER (used by JWT callback)
// =============================================================================

/**
 * Returns a flat, deduplicated array of permission strings
 * for all custom roles assigned to a user.
 * Used by auth.ts JWT callback to enrich the session.
 */
export async function getCustomPermissionsForUser(userId: string): Promise<string[]> {
    const assignments = await db.query.userCustomRoles.findMany({
        where: eq(userCustomRoles.userId, userId),
        with: {
            customRole: {
                with: {
                    permissions: true,
                },
            },
        },
    });

    const permsSet = new Set<string>();
    for (const assignment of assignments) {
        for (const perm of assignment.customRole.permissions) {
            permsSet.add(perm.permission);
        }
    }

    return Array.from(permsSet);
}

// =============================================================================
// CRUD — Custom Roles
// =============================================================================

export async function getAllCustomRolesDAO() {
    return db.query.customRoles.findMany({
        orderBy: [asc(customRoles.position), asc(customRoles.name)],
        with: {
            permissions: true,
            userAssignments: {
                with: {
                    user: {
                        columns: { id: true, name: true, image: true, role: true },
                    },
                },
            },
        },
    });
}

export async function getCustomRoleByIdDAO(id: string) {
    return db.query.customRoles.findFirst({
        where: eq(customRoles.id, id),
        with: {
            permissions: true,
            userAssignments: {
                with: {
                    user: {
                        columns: { id: true, name: true, image: true, email: true, role: true },
                    },
                },
            },
        },
    });
}

export async function createCustomRoleDAO(data: {
    name: string;
    description?: string | null;
    color?: string;
    position?: number;
    isSystem?: boolean;
    permissions: string[];
}) {
    return db.transaction(async (tx) => {
        const [role] = await tx.insert(customRoles).values({
            name: data.name,
            description: data.description || null,
            color: data.color || "#6366f1",
            position: data.position ?? 0,
            isSystem: data.isSystem ?? false,
        }).returning();

        if (data.permissions.length > 0) {
            await tx.insert(customRolePermissions).values(
                data.permissions.map(p => ({
                    customRoleId: role.id,
                    permission: p,
                }))
            );
        }

        return role;
    });
}

export async function updateCustomRoleDAO(id: string, data: {
    name: string;
    description?: string | null;
    color?: string;
    position?: number;
    permissions: string[];
}) {
    return db.transaction(async (tx) => {
        // Update role metadata
        await tx.update(customRoles).set({
            name: data.name,
            description: data.description || null,
            color: data.color,
            position: data.position,
        }).where(eq(customRoles.id, id));

        // Replace permissions: delete all, then re-insert
        await tx.delete(customRolePermissions)
            .where(eq(customRolePermissions.customRoleId, id));

        if (data.permissions.length > 0) {
            await tx.insert(customRolePermissions).values(
                data.permissions.map(p => ({
                    customRoleId: id,
                    permission: p,
                }))
            );
        }
    });
}

export async function deleteCustomRoleDAO(id: string) {
    // cascade will handle customRolePermissions and userCustomRoles
    await db.delete(customRoles).where(eq(customRoles.id, id));
}

// =============================================================================
// CRUD — User ↔ Custom Role Assignments
// =============================================================================

export async function assignRoleToUserDAO(userId: string, customRoleId: string, assignedById: string) {
    // Check if already assigned
    const existing = await db.query.userCustomRoles.findFirst({
        where: and(
            eq(userCustomRoles.userId, userId),
            eq(userCustomRoles.customRoleId, customRoleId),
        ),
    });
    if (existing) return existing;

    const [assignment] = await db.insert(userCustomRoles).values({
        userId,
        customRoleId,
        assignedById,
    }).returning();

    return assignment;
}

export async function removeRoleFromUserDAO(userId: string, customRoleId: string) {
    await db.delete(userCustomRoles).where(
        and(
            eq(userCustomRoles.userId, userId),
            eq(userCustomRoles.customRoleId, customRoleId),
        )
    );
}

export async function getUserCustomRolesDAO(userId: string) {
    return db.query.userCustomRoles.findMany({
        where: eq(userCustomRoles.userId, userId),
        with: {
            customRole: {
                with: {
                    permissions: true,
                },
            },
        },
    });
}
