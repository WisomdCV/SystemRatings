/**
 * Centralized Event Permission Engine v2
 *
 * ZERO hardcoded role checks. All capabilities resolve through hasPermission()
 * which evaluates 3 layers:
 *   Layer 1: System role defaults (PERMISSIONS map in permissions.ts)
 *   Layer 2: Custom role permissions (custom_role_permissions table)
 *   Layer 3: Area permissions (area_permissions table)
 *
 * Layers 2+3 are merged into `customPermissions` at JWT load time,
 * so hasPermission() handles all three transparently.
 */

import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { projectMembers } from "@/db/schema";
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
// IISE Event Creation Permissions
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
        case "GENERAL":
            return hasPermission(userRole, "event:create_general", customPermissions);

        case "AREA": {
            // Can create for ANY area?
            if (hasPermission(userRole, "event:create_area_any", customPermissions)) return true;

            // Can create for OWN area only?
            if (hasPermission(userRole, "event:create_area_own", customPermissions)) {
                // If no target specified or target is user's own area → allow
                if (!targetAreaId || targetAreaId === userAreaId) return true;
            }
            return false;
        }

        case "INDIVIDUAL_GROUP":
            return hasPermission(userRole, "event:create_meeting", customPermissions);

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

/**
 * Check if a user can target any area or only their own for AREA events.
 */
export function canTargetAnyArea(
    context: IISEContext,
): boolean {
    return hasPermission(context.userRole, "event:create_area_any", context.customPermissions);
}

// =============================================================================
// PROJECT Event Permissions (unchanged logic — project roles are already dynamic)
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

    if (!membership) return false;

    const role = membership.projectRole;
    const area = membership.projectArea;

    switch (eventType) {
        case "GENERAL":
            return !!role?.canCreateEvents;

        case "AREA": {
            if (role?.canCreateEvents) return true;
            if (area?.membersCanCreateEvents) {
                if (!targetProjectAreaId || targetProjectAreaId === membership.projectAreaId) return true;
            }
            return false;
        }

        case "INDIVIDUAL_GROUP": {
            if (role?.canCreateEvents) return true;
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
    const { userRole, userId, userAreaId, customPermissions } = context;

    // manage_all → can edit/delete ANY event
    if (hasPermission(userRole, "event:manage_all", customPermissions)) return true;

    // manage_own → can edit/delete events they created OR events targeting their area
    if (hasPermission(userRole, "event:manage_own", customPermissions)) {
        // Creator can always manage their own event
        if (event.createdById === userId) return true;

        // For IISE AREA events: user belongs to the target area
        if (event.eventScope === "IISE" && event.targetAreaId && event.targetAreaId === userAreaId) {
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
