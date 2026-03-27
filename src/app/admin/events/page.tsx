import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, areas, semesters, attendanceRecords, projects, users, projectMembers, projectAreas } from "@/db/schema";
import { desc, eq, and, or, isNull, isNotNull, inArray, ne, asc } from "drizzle-orm";
import EventsView from "@/components/events/EventsView";
import { hasPermission } from "@/lib/permissions";
import { getCreatableIISEEventTypes } from "@/server/services/event-permissions.service";
import { prepareEventsForClient, type VisibilityContext, type ProjectMembershipContext } from "@/server/services/event-visibility.service";

export default async function EventsPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    const userId = session.user.id;
    const currentAreaId = session.user.currentAreaId;

    // 1. Role Protection
    if (!hasPermission(role, "admin:access")) {
        return redirect("/dashboard?error=AccessDenied");
    }

    // 2. Fetch Active Semester
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    // 3. Fetch Data based on Role
    let eventsData: any[] = [];
    let areasList: any[] = [];
    let userAreaName: string | null = null;
    let userProjectMemberships: ProjectMembershipContext[] = [];

    // Common `with` for all event queries (includes invitees for avatar display)
    const eventWith = {
        targetArea: true,
        project: { columns: { id: true, name: true } },
        targetProjectArea: { columns: { id: true, name: true } },
        createdBy: { columns: { name: true, role: true } },
        invitees: {
            with: {
                user: { columns: { id: true, name: true, image: true } }
            }
        }
    } as const;

    const canManageAll = hasPermission(role, "event:manage_all", session.user.customPermissions);
    const canManageOwn = hasPermission(role, "event:manage_own", session.user.customPermissions);
    const canCreateGeneral = hasPermission(role, "event:create_general", session.user.customPermissions);
    const canCreateAreaOwn = hasPermission(role, "event:create_area_own", session.user.customPermissions);
    const canCreateAreaAny = hasPermission(role, "event:create_area_any", session.user.customPermissions);

    if (activeSemester) {
        areasList = await db.select({ id: areas.id, name: areas.name }).from(areas);

        // Build project memberships for scoped project visibility
        if (userId) {
            const memberships = await db.query.projectMembers.findMany({
                where: eq(projectMembers.userId, userId),
                with: {
                    project: { columns: { id: true, semesterId: true } },
                    projectRole: { columns: { canViewAllAreaEvents: true, canCreateEvents: true } },
                }
            });
            const activeMemberships = memberships.filter(m => m.project?.semesterId === activeSemester.id);
            userProjectMemberships = activeMemberships.map(m => ({
                projectId: m.project!.id,
                projectAreaId: m.projectAreaId,
                canViewAllAreaEvents: m.projectRole?.canViewAllAreaEvents ?? false,
                canCreateEvents: m.projectRole?.canCreateEvents ?? false,
            }));
        }

        const projectIds = userProjectMemberships.map(m => m.projectId);

        // A. Global managers can see all events in active semester
        if (canManageAll) {
            eventsData = await db.query.events.findMany({
                where: eq(events.semesterId, activeSemester.id),
                orderBy: [desc(events.date)],
                with: eventWith
            });
        } else {
            // B. Scoped visibility for non-global managers (permission-based, no role hardcode)
            if (currentAreaId) {
                const areaObj = await db.query.areas.findFirst({
                    where: eq(areas.id, currentAreaId),
                    columns: { name: true }
                });
                if (areaObj) userAreaName = areaObj.name;
            }

            const visibilityConditions = [eq(events.createdById, userId)];

            // Baseline visibility for non-global managers:
            // - IISE general events
            // - IISE events targeting user's own area
            const generalIISEClause = and(
                eq(events.eventScope, "IISE"),
                isNull(events.targetAreaId)
            );
            if (generalIISEClause) visibilityConditions.push(generalIISEClause);

            if (currentAreaId) {
                const ownAreaClause = and(
                    eq(events.eventScope, "IISE"),
                    eq(events.targetAreaId, currentAreaId)
                );
                if (ownAreaClause) visibilityConditions.push(ownAreaClause);
            }

            // IISE general events
            if (canCreateGeneral) {
                const clause = and(
                    eq(events.eventScope, "IISE"),
                    isNull(events.targetAreaId)
                );
                if (clause) visibilityConditions.push(clause);
            }

            // IISE own-area events
            if (currentAreaId && (canManageOwn || canCreateAreaOwn)) {
                const clause = and(
                    eq(events.eventScope, "IISE"),
                    eq(events.targetAreaId, currentAreaId)
                );
                if (clause) visibilityConditions.push(clause);
            }

            // IISE any-area visibility
            if (canCreateAreaAny) {
                const clause = and(
                    eq(events.eventScope, "IISE"),
                    isNotNull(events.targetAreaId)
                );
                if (clause) visibilityConditions.push(clause);
            }

            // Project events in projects where user is member
            if (projectIds.length > 0) {
                const clause = and(
                    eq(events.eventScope, "PROJECT"),
                    inArray(events.projectId, projectIds)
                );
                if (clause) visibilityConditions.push(clause);
            }

            if (visibilityConditions.length > 0) {
                const visibilityClause = or(...visibilityConditions);
                if (!visibilityClause) {
                    eventsData = [];
                } else {
                    const whereClause = and(
                        eq(events.semesterId, activeSemester.id),
                        visibilityClause
                    );
                    if (!whereClause) {
                        eventsData = [];
                    } else {
                        eventsData = await db.query.events.findMany({
                            where: whereClause,
                            orderBy: [desc(events.date)],
                            with: eventWith
                        });
                    }
                }
            }
        }
    }

    // Centralized visibility filter + permission enrichment
    const visibilityCtx: VisibilityContext = {
        userId,
        userRole: role,
        userAreaId: currentAreaId,
        customPermissions: session.user.customPermissions,
        projectMemberships: userProjectMemberships,
        hasGlobalManage: canManageAll,
    };
    eventsData = await prepareEventsForClient(eventsData, visibilityCtx);

    // 4. Fetch Pending Justifications Count for visible events
    const eventIds = eventsData.map((e: any) => e.id);
    const pendingCounts: Record<string, number> = {};
    if (eventIds.length > 0) {
        const allAttendance = await db.query.attendanceRecords.findMany({
            where: and(
                inArray(attendanceRecords.eventId, eventIds),
                eq(attendanceRecords.status, "ABSENT")
            ),
            columns: {
                eventId: true,
                justificationStatus: true
            }
        });

        for (const att of allAttendance) {
            if (att.justificationStatus === "PENDING") {
                pendingCounts[att.eventId] = (pendingCounts[att.eventId] || 0) + 1;
            }
        }
    }

    const eventsWithCounts = eventsData.map((e: any) => ({
        ...e,
        pendingJustificationCount: pendingCounts[e.id] || 0
    }));

    // 5. Fetch active users for invitee picker
    const activeUsers = await db.query.users.findMany({
        where: and(eq(users.status, "ACTIVE"), ne(users.role, "DEV")),
        columns: { id: true, name: true, image: true },
        orderBy: [asc(users.name)],
    });

    // 6. Dynamic type filtering — ZERO hardcode
    const creatableTypes = await getCreatableIISEEventTypes({
        userRole: role,
        userAreaId: currentAreaId,
        customPermissions: session.user.customPermissions,
    });

    // 7. Fetch user's active projects for the scope selector
    let userProjects: { id: string; name: string }[] = [];
    let allProjectAreas: { id: string; name: string }[] = [];
    let availableScopes: string[] = ["IISE"];

    if (activeSemester) {
        if (hasPermission(role, "project:manage")) {
            userProjects = await db.query.projects.findMany({
                where: eq(projects.semesterId, activeSemester.id),
                columns: { id: true, name: true },
                orderBy: [asc(projects.name)],
            });
        } else if (userId) {
            const memberships = await db.query.projectMembers.findMany({
                where: eq(projectMembers.userId, userId),
                with: {
                    project: {
                        columns: { id: true, name: true, semesterId: true }
                    }
                }
            });
            userProjects = memberships
                .filter(m => m.project?.semesterId === activeSemester.id)
                .map(m => ({ id: m.project!.id, name: m.project!.name }));
        }

        if (userProjects.length > 0) {
            availableScopes = ["IISE", "PROJECT"];
            allProjectAreas = await db.query.projectAreas.findMany({
                columns: { id: true, name: true },
                orderBy: [asc(projectAreas.name)],
            });
        }
    }

    // Build projectMembersMap: projectId -> members (for invitee filtering)
    const projectMembersMap: Record<string, { id: string; name: string | null; image: string | null }[]> = {};
    if (userProjects.length > 0) {
        for (const proj of userProjects) {
            const members = await db.query.projectMembers.findMany({
                where: eq(projectMembers.projectId, proj.id),
                with: { user: { columns: { id: true, name: true, image: true } } }
            });
            projectMembersMap[proj.id] = members.map(m => ({
                id: m.user.id,
                name: m.user.name,
                image: m.user.image,
            }));
        }
    }

    return (
        <EventsView
            events={eventsWithCounts}
            activeSemesterName={activeSemester?.name || "Sin Semestre"}
            userRole={role}
            userId={userId}
            userAreaId={currentAreaId}
            userAreaName={userAreaName}
            areas={areasList}
            availableTypes={creatableTypes}
            users={activeUsers}
            availableScopes={availableScopes}
            projects={userProjects}
            projectAreas={allProjectAreas}
            projectMembersMap={projectMembersMap}
            canTargetAnyArea={canCreateAreaAny}
            attendanceRouteMode="admin"
        />
    );
}
