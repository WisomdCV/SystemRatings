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
import { hasProjectPermission, hasAnyProjectPermission } from "@/lib/project-permissions";
import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// Types (re-exported from centralized constants)
// =============================================================================

export type { EventScope, EventType } from "@/lib/constants";
import type { EventScope, EventType } from "@/lib/constants";

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

        case "TREASURY_SPECIAL":
            // This type is project-only; never creatable at IISE scope.
            return false;

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
 * Uses project permission strings from projectRolePermissions table.
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
            projectRole: { with: { permissions: true } },
        }
    });

    if (!membership) return false;

    switch (eventType) {
        case "GENERAL":
            return hasProjectPermission(membership, "project:event_create_any");

        case "AREA": {
            // Can create for ANY area
            if (hasProjectPermission(membership, "project:event_create_any")) return true;
            // Can create for OWN area only
            if (hasProjectPermission(membership, "project:event_create_own_area")) {
                if (!targetProjectAreaId || targetProjectAreaId === membership.projectAreaId) return true;
            }
            return false;
        }

        case "INDIVIDUAL_GROUP":
            return hasAnyProjectPermission(membership, ["project:event_create_any", "project:event_create_own_area"]);

        case "TREASURY_SPECIAL":
            return hasProjectPermission(membership, "project:event_create_treasury_special");

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
    if (await canCreateProjectEvent(context, "TREASURY_SPECIAL")) types.push("TREASURY_SPECIAL");
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

    // For PROJECT events: check project permission strings
    if (event.eventScope === "PROJECT" && event.projectId) {
        const membership = await db.query.projectMembers.findFirst({
            where: and(
                eq(projectMembers.projectId, event.projectId),
                eq(projectMembers.userId, userId)
            ),
            with: { projectRole: { with: { permissions: true } } }
        });

        // event_manage_any → can manage any event in the project
        if (hasProjectPermission(membership, "project:event_manage_any")) return true;
        // event_manage_own → creator OR same area
        if (hasProjectPermission(membership, "project:event_manage_own")) {
            if (event.createdById === userId) return true;
            if (event.targetProjectAreaId && membership?.projectAreaId === event.targetProjectAreaId) return true;
        }
    }

    return false;
}

// =============================================================================
// Attendance Tracking
// =============================================================================

/**
 * Determines if an event should track attendance.
 * Rule: INDIVIDUAL_GROUP events NEVER track attendance.
 * TREASURY_SPECIAL keeps attendance enabled.
 */
export function shouldTrackAttendance(eventType: EventType): boolean {
    return eventType !== "INDIVIDUAL_GROUP";
}

// =============================================================================
// Attendance Permission — Single Source of Truth
// =============================================================================

interface AttendancePermContext {
    userRole: string | null;
    userId: string;
    userAreaId: string | null;
    customPermissions?: string[];
}

interface EventForAttendance {
    createdById: string | null;
    eventScope: string;
    eventType: string;
    targetAreaId: string | null;
    projectId: string | null;
    targetProjectAreaId: string | null;
}

/**
 * Canonical check: can this user take/view attendance for this event?
 *
 * Rules:
 * - TREASURY_SPECIAL: delegates to canManageEvent
 * - attendance:take_all → any event
 * - attendance:take_own_area → IISE: targetAreaId matches user's area
 *                             → PROJECT: targetProjectAreaId matches user's project area
 *
 * Consumed by attendance.actions.ts AND event-visibility.service.ts
 */
export async function canTakeAttendance(
    ctx: AttendancePermContext,
    event: EventForAttendance,
): Promise<boolean> {
    const { userRole, userId, userAreaId, customPermissions } = ctx;
    const eventOwnership = {
        createdById: event.createdById,
        eventScope: event.eventScope,
        eventType: event.eventType,
        targetAreaId: event.targetAreaId,
        projectId: event.projectId,
        targetProjectAreaId: event.targetProjectAreaId,
    };

    // TREASURY_SPECIAL: delegated entirely to canManageEvent
    if (event.eventScope === "PROJECT" && event.eventType === "TREASURY_SPECIAL") {
        return canManageEvent({ userRole, userId, userAreaId, customPermissions }, eventOwnership);
    }

    // take_all → can take attendance on any event
    if (hasPermission(userRole, "attendance:take_all", customPermissions)) return true;

    // take_own_area → events targeting user's area (IISE or PROJECT scope)
    if (hasPermission(userRole, "attendance:take_own_area", customPermissions)) {
        // PROJECT scope AREA events: check targetProjectAreaId via project membership
        if (event.eventScope === "PROJECT" && event.projectId && event.targetProjectAreaId) {
            const membership = await db.query.projectMembers.findFirst({
                where: and(
                    eq(projectMembers.projectId, event.projectId),
                    eq(projectMembers.userId, userId),
                ),
                columns: { projectAreaId: true },
            });
            if (!membership || membership.projectAreaId !== event.targetProjectAreaId) return false;

            return canManageEvent({ userRole, userId, userAreaId, customPermissions }, eventOwnership);
        }

        // IISE scope AREA events: check targetAreaId
        if (!event.targetAreaId) return false;
        if (event.targetAreaId !== userAreaId) return false;

        return canManageEvent({ userRole, userId, userAreaId, customPermissions }, eventOwnership);
    }

    return false;
}
