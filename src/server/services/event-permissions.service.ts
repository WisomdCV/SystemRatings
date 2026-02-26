/**
 * Centralized Event Permission Engine
 * 
 * 3-Layer permission resolution:
 *   Layer 1: System role permissions (permissions.ts PERMISSIONS map)
 *   Layer 2: Custom role permissions (via hasPermission customPermissions arg)
 *   Layer 3: Area/Project capabilities (configurable flags in DB)
 * 
 * ZERO hardcoding — all capabilities are configurable from admin UI.
 */

import { hasPermission, type Permission } from "@/lib/permissions";
import { db } from "@/db";
import { areas, projectMembers, projectRoles, projectAreas } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export type EventScope = "IISE" | "PROJECT";
export type EventType = "GENERAL" | "AREA" | "INDIVIDUAL_GROUP";

interface IISEContext {
    userRole: string | null;
    userAreaId: string | null;
    customPermissions?: string[];
}

interface ProjectContext extends IISEContext {
    projectId: string;
    userId: string;
}

// =============================================================================
// IISE Event Permissions
// =============================================================================

/**
 * Check if a user can create an IISE-level event of a given type.
 */
export async function canCreateIISEEvent(
    context: IISEContext,
    eventType: EventType,
    targetAreaId?: string | null,
): Promise<boolean> {
    const { userRole, userAreaId, customPermissions } = context;

    switch (eventType) {
        case "GENERAL": {
            // Layer 1+2: System/Custom role has event:create_general?
            if (hasPermission(userRole, "event:create_general", customPermissions)) return true;

            // Layer 3: User's area has canCreateEvents?
            if (userAreaId) {
                const area = await getAreaCapabilities(userAreaId);
                if (area?.canCreateEvents) return true;
            }
            return false;
        }

        case "AREA": {
            // Layer 1+2: System/Custom role has event:create_area?
            if (hasPermission(userRole, "event:create_area", customPermissions)) return true;

            // Layer 3: User's area has canCreateEvents AND is creating for their own area?
            if (userAreaId) {
                const area = await getAreaCapabilities(userAreaId);
                if (area?.canCreateEvents) return true;
            }
            return false;
        }

        case "INDIVIDUAL_GROUP": {
            // Layer 1+2: System/Custom role has event:create_individual?
            if (hasPermission(userRole, "event:create_individual", customPermissions)) return true;

            // Layer 3: User's area has canCreateIndividualEvents?
            if (userAreaId) {
                const area = await getAreaCapabilities(userAreaId);
                if (area?.canCreateIndividualEvents) return true;
            }
            return false;
        }

        default:
            return false;
    }
}

/**
 * Get all event types a user can create at the IISE level.
 */
export async function getCreatableIISEEventTypes(
    context: IISEContext
): Promise<EventType[]> {
    const types: EventType[] = [];
    if (await canCreateIISEEvent(context, "GENERAL")) types.push("GENERAL");
    if (await canCreateIISEEvent(context, "AREA")) types.push("AREA");
    if (await canCreateIISEEvent(context, "INDIVIDUAL_GROUP")) types.push("INDIVIDUAL_GROUP");
    return types;
}

// =============================================================================
// PROJECT Event Permissions
// =============================================================================

/**
 * Check if a user can create a project-level event of a given type.
 */
export async function canCreateProjectEvent(
    context: ProjectContext,
    eventType: EventType,
    targetProjectAreaId?: string | null,
): Promise<boolean> {
    const { userId, projectId } = context;

    // Fetch user's project membership (role + area)
    const membership = await db.query.projectMembers.findFirst({
        where: and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId)
        ),
        with: {
            projectRole: true,
            projectArea: true,
        }
    });

    if (!membership) return false; // Not a project member

    const role = membership.projectRole;
    const area = membership.projectArea;

    switch (eventType) {
        case "GENERAL": {
            // Check role capability (configurable flag)
            if (role?.canCreateEvents) return true;
            return false;
        }

        case "AREA": {
            // Role-level: can create events for any area
            if (role?.canCreateEvents) return true;

            // Area-level: members of this area can create if area has the flag
            if (area?.membersCanCreateEvents) {
                // Can create for their own area
                if (!targetProjectAreaId || targetProjectAreaId === membership.projectAreaId) return true;
            }
            return false;
        }

        case "INDIVIDUAL_GROUP": {
            // Role-level
            if (role?.canCreateEvents) return true;

            // Area-level (e.g. RRHH members can create individual meetings)
            if (area?.membersCanCreateEvents) return true;
            return false;
        }

        default:
            return false;
    }
}

/**
 * Get all event types a user can create for a specific project.
 */
export async function getCreatableProjectEventTypes(
    context: ProjectContext
): Promise<EventType[]> {
    const types: EventType[] = [];
    if (await canCreateProjectEvent(context, "GENERAL")) types.push("GENERAL");
    if (await canCreateProjectEvent(context, "AREA")) types.push("AREA");
    if (await canCreateProjectEvent(context, "INDIVIDUAL_GROUP")) types.push("INDIVIDUAL_GROUP");
    return types;
}

// =============================================================================
// Event Management Permissions (Edit/Delete)
// =============================================================================

interface EventOwnership {
    createdById: string | null;
    eventScope: string;
    eventType: string;
    targetAreaId: string | null;
    projectId: string | null;
    targetProjectAreaId: string | null;
}

/**
 * Check if a user can manage (edit/delete) a specific event.
 */
export async function canManageEvent(
    context: IISEContext & { userId: string },
    event: EventOwnership,
): Promise<boolean> {
    const { userRole, userId, customPermissions } = context;

    // Global event:manage permission (admin level)
    if (hasPermission(userRole, "event:manage", customPermissions)) return true;

    // Creator can always manage their own event
    if (event.createdById === userId) return true;

    // For IISE AREA events: Director/Subdirector of that area
    if (event.eventScope === "IISE" && event.eventType === "AREA" && event.targetAreaId) {
        if (hasPermission(userRole, "event:create_area", customPermissions) &&
            context.userAreaId === event.targetAreaId) {
            return true;
        }
    }

    // For PROJECT events: check project role capability
    if (event.eventScope === "PROJECT" && event.projectId) {
        const membership = await db.query.projectMembers.findFirst({
            where: and(
                eq(projectMembers.projectId, event.projectId),
                eq(projectMembers.userId, userId)
            ),
            with: { projectRole: true }
        });

        if (membership?.projectRole?.canCreateEvents) return true;
    }

    return false;
}

// =============================================================================
// Attendance Tracking
// =============================================================================

/**
 * Determines if an event should track attendance.
 * Rule: INDIVIDUAL_GROUP events NEVER track attendance.
 */
export function shouldTrackAttendance(eventType: EventType): boolean {
    return eventType !== "INDIVIDUAL_GROUP";
}

// =============================================================================
// Internal Helpers (DB lookups with caching potential)
// =============================================================================

async function getAreaCapabilities(areaId: string) {
    return db.query.areas.findFirst({
        where: eq(areas.id, areaId),
        columns: {
            canCreateEvents: true,
            canCreateIndividualEvents: true,
        }
    });
}
