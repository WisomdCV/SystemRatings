"use server";

import { db } from "@/db";
import { pillarGradingPermissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission, type Permission } from "@/lib/permissions";

// =============================================================================
// Grading Permissions Service
// =============================================================================
// Resolves WHO can grade WHICH pillar for WHOM using a layered approach:
//
//   1. Super-permission bypass: `grade:assign_all_pillars` → can grade ANY pillar for ANYONE
//   2. Per-pillar grants from `pillar_grading_permission` table:
//      - grantType "ROLE"       → matches against user's system role
//      - grantType "PERMISSION" → matches via hasPermission()
//      - scope "ALL"            → can grade anyone
//      - scope "OWN_AREA"       → can only grade users in same area
//   3. Legacy fallback: `grade:assign_all` / `grade:assign_own_area` apply to ALL pillars
//      (backward compatible — if no per-pillar grants exist, legacy still works)
// =============================================================================

export interface GraderContext {
    userId: string;
    userRole: string | null;
    userAreaId: string | null;
    customPermissions?: string[];
}

export type GradingScope = "ALL" | "OWN_AREA" | "NONE";

/**
 * Determines if a grader can grade a specific pillar, and with what scope.
 *
 * Returns the broadest scope the grader has for this pillar:
 *   - "ALL"      → can grade any user
 *   - "OWN_AREA" → can only grade users in grader's area
 *   - "NONE"     → cannot grade this pillar
 */
export async function canGradePillar(
    grader: GraderContext,
    definitionId: string,
): Promise<GradingScope> {
    // Layer 1: Super-permission bypass → ALL scope
    if (hasPermission(grader.userRole, "grade:assign_all_pillars", grader.customPermissions)) {
        return "ALL";
    }

    // Layer 2: Per-pillar grants from DB
    const grants = await db.query.pillarGradingPermissions.findMany({
        where: eq(pillarGradingPermissions.definitionId, definitionId),
    });

    if (grants.length > 0) {
        let bestScope: GradingScope = "NONE";

        for (const grant of grants) {
            let matches = false;

            if (grant.grantType === "ROLE") {
                matches = grader.userRole === grant.grantValue;
            } else if (grant.grantType === "PERMISSION") {
                matches = hasPermission(
                    grader.userRole,
                    grant.grantValue as Permission,
                    grader.customPermissions,
                );
            }

            if (matches) {
                if (grant.scope === "ALL") return "ALL"; // Can't get broader, short-circuit
                if (grant.scope === "OWN_AREA") bestScope = "OWN_AREA";
            }
        }

        // If there ARE per-pillar grants but none matched this grader, return NONE
        // (the pillar is explicitly configured — legacy fallback doesn't apply)
        if (bestScope !== "NONE") return bestScope;

        // Per-pillar grants exist but none matched → no access to this pillar
        return "NONE";
    }

    // Layer 3: No per-pillar grants configured → legacy fallback
    // This ensures backward compatibility: all existing pillars keep working
    if (hasPermission(grader.userRole, "grade:assign_all", grader.customPermissions)) {
        return "ALL";
    }
    if (hasPermission(grader.userRole, "grade:assign_own_area", grader.customPermissions)) {
        return "OWN_AREA";
    }

    return "NONE";
}

/**
 * Checks if a grader can grade a specific pillar for a specific target user.
 * Combines pillar-level permission with scope-based target validation.
 */
export async function canGradePillarForUser(
    grader: GraderContext,
    definitionId: string,
    targetUserAreaId: string | null,
): Promise<boolean> {
    const scope = await canGradePillar(grader, definitionId);

    if (scope === "NONE") return false;
    if (scope === "ALL") return true;

    // OWN_AREA: grader must have an area AND target must be in the same area
    if (!grader.userAreaId) return false;
    return grader.userAreaId === targetUserAreaId;
}

/**
 * Batch-resolves pillar permissions for a grader across multiple pillars.
 * Returns a map of definitionId → GradingScope.
 *
 * Optimized: fetches all grants in one query instead of N queries.
 */
export async function resolveAllPillarPermissions(
    grader: GraderContext,
    definitionIds: string[],
): Promise<Record<string, GradingScope>> {
    const result: Record<string, GradingScope> = {};

    if (definitionIds.length === 0) return result;

    // Super-permission bypass: all pillars get "ALL"
    if (hasPermission(grader.userRole, "grade:assign_all_pillars", grader.customPermissions)) {
        for (const id of definitionIds) result[id] = "ALL";
        return result;
    }

    // Fetch ALL grants for these pillars in one query
    const allGrants = await db.query.pillarGradingPermissions.findMany();
    const grantsByPillar = new Map<string, typeof allGrants>();
    for (const grant of allGrants) {
        if (!definitionIds.includes(grant.definitionId)) continue;
        const existing = grantsByPillar.get(grant.definitionId) || [];
        existing.push(grant);
        grantsByPillar.set(grant.definitionId, existing);
    }

    // Legacy permissions (checked once)
    const hasLegacyAll = hasPermission(grader.userRole, "grade:assign_all", grader.customPermissions);
    const hasLegacyOwnArea = hasPermission(grader.userRole, "grade:assign_own_area", grader.customPermissions);

    for (const defId of definitionIds) {
        const grants = grantsByPillar.get(defId);

        if (grants && grants.length > 0) {
            // Per-pillar grants exist → evaluate them
            let bestScope: GradingScope = "NONE";

            for (const grant of grants) {
                let matches = false;

                if (grant.grantType === "ROLE") {
                    matches = grader.userRole === grant.grantValue;
                } else if (grant.grantType === "PERMISSION") {
                    matches = hasPermission(
                        grader.userRole,
                        grant.grantValue as Permission,
                        grader.customPermissions,
                    );
                }

                if (matches) {
                    if (grant.scope === "ALL") { bestScope = "ALL"; break; }
                    if (grant.scope === "OWN_AREA") bestScope = "OWN_AREA";
                }
            }

            result[defId] = bestScope;
        } else {
            // No per-pillar grants → legacy fallback
            if (hasLegacyAll) result[defId] = "ALL";
            else if (hasLegacyOwnArea) result[defId] = "OWN_AREA";
            else result[defId] = "NONE";
        }
    }

    return result;
}
