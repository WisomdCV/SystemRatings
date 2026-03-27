import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, semesters, areas, users, projectMembers, projectAreas, projects } from "@/db/schema";
import { desc, eq, and, or, isNull, isNotNull, inArray, ne, asc } from "drizzle-orm";
import EventsView from "@/components/events/EventsView";
import { hasPermission } from "@/lib/permissions";
import { getCreatableIISEEventTypes } from "@/server/services/event-permissions.service";
import { prepareEventsForClient, type VisibilityContext, type ProjectMembershipContext } from "@/server/services/event-visibility.service";

export default async function AgendaPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    const userId = session.user.id;
    const currentAreaId = session.user.currentAreaId;

    // 1. Fetch Active Semester
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    let eventsData: any[] = [];
    let userAreaName: string | null = null;
    let availableAreas: any[] = [];

    const canManageAll = hasPermission(role, "event:manage_all", session.user.customPermissions);
    const canManageOwn = hasPermission(role, "event:manage_own", session.user.customPermissions);
    const canCreateGeneral = hasPermission(role, "event:create_general", session.user.customPermissions);
    const canCreateAreaOwn = hasPermission(role, "event:create_area_own", session.user.customPermissions);
    const canCreateAreaAny = hasPermission(role, "event:create_area_any", session.user.customPermissions);

    if (activeSemester) {
        // Fetch Area Name if exists
        if (currentAreaId) {
            const areaObj = await db.query.areas.findFirst({
                where: eq(areas.id, currentAreaId),
                columns: { name: true }
            });
            if (areaObj) userAreaName = areaObj.name;
        }

        let projectIds: string[] = [];
        let userProjectMemberships: ProjectMembershipContext[] = [];
        if (userId) {
            const memberships = await db.query.projectMembers.findMany({
                where: eq(projectMembers.userId, userId),
                with: {
                    project: { columns: { id: true, semesterId: true } },
                    projectRole: { columns: { canViewAllAreaEvents: true, canCreateEvents: true } },
                }
            });
            const activeMemberships = memberships.filter(m => m.project?.semesterId === activeSemester.id);
            projectIds = activeMemberships.map(m => m.project!.id);
            userProjectMemberships = activeMemberships.map(m => ({
                projectId: m.project!.id,
                projectAreaId: m.projectAreaId,
                canViewAllAreaEvents: m.projectRole?.canViewAllAreaEvents ?? false,
                canCreateEvents: m.projectRole?.canCreateEvents ?? false,
            }));
        }

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

        if (canManageAll) {
            eventsData = await db.query.events.findMany({
                where: eq(events.semesterId, activeSemester.id),
                orderBy: [desc(events.date)],
                with: eventWith,
            });
        } else {
            const visibilityConditions = [eq(events.createdById, userId)];

            if (canCreateGeneral) {
                const clause = and(
                    eq(events.eventScope, "IISE"),
                    isNull(events.targetAreaId)
                );
                if (clause) visibilityConditions.push(clause);
            }

            if (currentAreaId && (canManageOwn || canCreateAreaOwn)) {
                const clause = and(
                    eq(events.eventScope, "IISE"),
                    eq(events.targetAreaId, currentAreaId)
                );
                if (clause) visibilityConditions.push(clause);
            }

            if (canCreateAreaAny) {
                const clause = and(
                    eq(events.eventScope, "IISE"),
                    isNotNull(events.targetAreaId)
                );
                if (clause) visibilityConditions.push(clause);
            }

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
                            with: eventWith,
                        });
                    }
                }
            }
        }

        // Centralized visibility + permission enrichment
        const visibilityCtx: VisibilityContext = {
            userId,
            userRole: role,
            userAreaId: currentAreaId,
            customPermissions: session.user.customPermissions,
            projectMemberships: userProjectMemberships,
            hasGlobalManage: canManageAll,
        };
        eventsData = await prepareEventsForClient(eventsData, visibilityCtx);
    }

    // 2. DYNAMIC permission check — ZERO hardcode
    const creatableTypes = await getCreatableIISEEventTypes({
        userRole: role,
        userAreaId: currentAreaId,
        customPermissions: session.user.customPermissions,
    });

    const canCreate = creatableTypes.length > 0;

    // 3. Only fetch extra data when user can actually create events
    let activeUsers: { id: string; name: string | null; image: string | null }[] = [];
    let userProjects: { id: string; name: string }[] = [];
    let allProjectAreas: { id: string; name: string }[] = [];
    let availableScopes: string[] = ["IISE"];
    const projectMembersMap: Record<string, { id: string; name: string | null; image: string | null }[]> = {};

    if (canCreate) {
        availableAreas = await db.query.areas.findMany({
            columns: { id: true, name: true, code: true },
            orderBy: [asc(areas.name)],
        });

        activeUsers = await db.query.users.findMany({
            where: and(eq(users.status, "ACTIVE"), ne(users.role, "DEV")),
            columns: { id: true, name: true, image: true },
            orderBy: [asc(users.name)],
        });

        // Fetch projects for scope selector
        if (activeSemester && userId) {
            const memberships = await db.query.projectMembers.findMany({
                where: eq(projectMembers.userId, userId),
                with: {
                    project: { columns: { id: true, name: true, semesterId: true } }
                }
            });
            userProjects = memberships
                .filter(m => m.project?.semesterId === activeSemester.id)
                .map(m => ({ id: m.project!.id, name: m.project!.name }));

            if (userProjects.length > 0) {
                availableScopes = ["IISE", "PROJECT"];
                allProjectAreas = await db.query.projectAreas.findMany({
                    columns: { id: true, name: true },
                    orderBy: [asc(projectAreas.name)],
                });

                // Build projectMembersMap for invitee filtering by project
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
        }
    }

    return (
        <EventsView
            events={eventsData}
            activeSemesterName={activeSemester?.name || "Semestre Inactivo"}
            userRole={role}
            userId={userId}
            userAreaId={currentAreaId}
            userAreaName={userAreaName}
            areas={availableAreas}
            readOnly={!canCreate}
            availableTypes={creatableTypes}
            users={canCreate ? activeUsers : undefined}
            availableScopes={availableScopes}
            projects={userProjects}
            projectAreas={allProjectAreas}
            projectMembersMap={projectMembersMap}
        />
    );
}
