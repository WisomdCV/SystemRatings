/**
 * Centralized Event Visibility & Permission Enrichment Service
 *
 * Single source of truth for:
 *   1. Which events a user can SEE (visibility filtering)
 *   2. What actions a user can PERFORM on each event (_permissions enrichment)
 *
 * Consumed by all event-displaying pages (agenda, admin/events, projects/[id]).
 * The client NEVER recalculates permissions — it reads pre-computed booleans.
 */

import { canManageEvent as serverCanManage } from "./event-permissions.service";

// =============================================================================
// Types
// =============================================================================

/** Pre-computed permissions attached to each event for the client */
export interface EventPermissions {
    canEdit: boolean;
    canDelete: boolean;
    canTakeAttendance: boolean;
}

/** User's membership in a project (pre-fetched by the page) */
export interface ProjectMembershipContext {
    projectId: string;
    projectAreaId: string | null;
    canViewAllAreaEvents: boolean;   // from projectRole flag
    canCreateEvents: boolean;        // from projectRole flag
}

/** Everything the visibility engine needs to know about the current user */
export interface VisibilityContext {
    userId: string;
    userRole: string;
    userAreaId: string | null;
    customPermissions?: string[];
    /** Pre-fetched project memberships for the active semester */
    projectMemberships: ProjectMembershipContext[];
    /** If true, user bypasses all visibility filters (event:manage_all) */
    hasGlobalManage?: boolean;
}

// =============================================================================
// 1. Visibility Filter — "Can this user SEE this event?"
// =============================================================================

/**
 * Filters an array of events to only those the user is allowed to see.
 *
 * Rules:
 * - GENERAL (IISE or PROJECT): visible to all relevant users
 * - AREA (IISE): handled at query level (only user's area + general fetched)
 * - AREA (PROJECT): visible to members of that project area OR roles with canViewAllAreaEvents
 * - INDIVIDUAL_GROUP: visible only to invitees + creator
 */
export function filterVisibleEvents<T extends {
    eventType?: string | null;
    eventScope?: string | null;
    createdById?: string | null;
    projectId?: string | null;
    targetProjectArea?: { id: string } | null;
    invitees?: { userId: string }[];
}>(events: T[], ctx: VisibilityContext): T[] {
    // Global manage bypass: users with event:manage_all see everything
    if (ctx.hasGlobalManage) return events;

    return events.filter(event => {
        // INDIVIDUAL_GROUP: only invitees + creator
        if (event.eventType === "INDIVIDUAL_GROUP") {
            if (event.createdById === ctx.userId) return true;
            return event.invitees?.some(inv => inv.userId === ctx.userId) ?? false;
        }

        // PROJECT scope AREA events: filter by project membership area
        if (event.eventScope === "PROJECT" && event.eventType === "AREA" && event.targetProjectArea?.id && event.projectId) {
            const membership = ctx.projectMemberships.find(m => m.projectId === event.projectId);
            if (!membership) return false;
            // Role flag: can see all area events
            if (membership.canViewAllAreaEvents) return true;
            // Otherwise: only own area
            return membership.projectAreaId === event.targetProjectArea.id;
        }

        // Everything else (GENERAL, IISE AREA already filtered at query level): visible
        return true;
    });
}

// =============================================================================
// 2. Permission Enrichment — "What can this user DO with each event?"
// =============================================================================

/**
 * Enriches each event with a `_permissions` object containing pre-computed
 * booleans for canEdit, canDelete, canTakeAttendance.
 *
 * The client reads these directly — ZERO permission logic on the frontend.
 */
export async function enrichEventsWithPermissions<T extends {
    id: string;
    createdById?: string | null;
    eventScope?: string | null;
    eventType?: string | null;
    targetAreaId?: string | null;
    projectId?: string | null;
    targetProjectAreaId?: string | null;
    tracksAttendance?: boolean | null;
}>(
    events: T[],
    ctx: VisibilityContext,
): Promise<(T & { _permissions: EventPermissions })[]> {
    const result: (T & { _permissions: EventPermissions })[] = [];

    for (const event of events) {
        const canManage = await serverCanManage(
            {
                userRole: ctx.userRole,
                userId: ctx.userId,
                userAreaId: ctx.userAreaId,
                customPermissions: ctx.customPermissions,
            },
            {
                createdById: event.createdById ?? null,
                eventScope: event.eventScope || "IISE",
                eventType: event.eventType || "GENERAL",
                targetAreaId: event.targetAreaId ?? null,
                projectId: event.projectId ?? null,
                targetProjectAreaId: event.targetProjectAreaId ?? null,
            }
        );

        const canTakeAtt = canManage && event.tracksAttendance !== false;

        result.push({
            ...event,
            _permissions: {
                canEdit: canManage,
                canDelete: canManage,
                canTakeAttendance: canTakeAtt,
            },
        });
    }

    return result;
}

// =============================================================================
// 3. Combined Pipeline — filter + enrich in one call
// =============================================================================

/**
 * Full pipeline: filter visible events, then enrich with permissions.
 * This is the main function pages should call.
 */
export async function prepareEventsForClient<T extends {
    id: string;
    createdById?: string | null;
    eventScope?: string | null;
    eventType?: string | null;
    targetAreaId?: string | null;
    projectId?: string | null;
    targetProjectAreaId?: string | null;
    tracksAttendance?: boolean | null;
    targetProjectArea?: { id: string } | null;
    invitees?: { userId: string }[];
}>(
    events: T[],
    ctx: VisibilityContext,
): Promise<(T & { _permissions: EventPermissions })[]> {
    const visible = filterVisibleEvents(events, ctx);
    return enrichEventsWithPermissions(visible, ctx);
}
