import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, semesters, areas, users, projectMembers, projectAreas, projects } from "@/db/schema";
import { desc, eq, and, or, isNull, ne, asc } from "drizzle-orm";
import EventsView from "@/components/events/EventsView";
import { getCreatableIISEEventTypes } from "@/server/services/event-permissions.service";

export default async function AgendaPage() {
    const session = await auth();
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

    if (activeSemester) {
        // Fetch Area Name if exists
        if (currentAreaId) {
            const areaObj = await db.query.areas.findFirst({
                where: eq(areas.id, currentAreaId),
                columns: { name: true }
            });
            if (areaObj) userAreaName = areaObj.name;
        }

        // IISE events: General + user's area
        const iiseConditions = [isNull(events.targetAreaId)];
        if (currentAreaId) {
            iiseConditions.push(eq(events.targetAreaId, currentAreaId));
        }

        // Also include PROJECT events for user's projects
        let projectIds: string[] = [];
        if (userId) {
            const memberships = await db.query.projectMembers.findMany({
                where: eq(projectMembers.userId, userId),
                with: {
                    project: { columns: { id: true, semesterId: true } }
                }
            });
            projectIds = memberships
                .filter(m => m.project?.semesterId === activeSemester.id)
                .map(m => m.project!.id);
        }

        // Build combined query conditions
        const allConditions = [...iiseConditions];
        // Add project events if user has projects
        if (projectIds.length > 0) {
            for (const pid of projectIds) {
                allConditions.push(eq(events.projectId, pid));
            }
        }

        eventsData = await db.query.events.findMany({
            where: and(
                eq(events.semesterId, activeSemester.id),
                or(...allConditions)
            ),
            orderBy: [desc(events.date)],
            with: {
                targetArea: true,
                project: { columns: { id: true, name: true } },
                targetProjectArea: { columns: { id: true, name: true } },
                createdBy: { columns: { name: true, role: true } }
            }
        });
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
            }
        }
    }

    return (
        <EventsView
            events={eventsData}
            activeSemesterName={activeSemester?.name || "Semestre Inactivo"}
            userRole={role}
            userAreaId={currentAreaId}
            userAreaName={userAreaName}
            areas={availableAreas}
            readOnly={!canCreate}
            availableTypes={creatableTypes}
            users={canCreate ? activeUsers : undefined}
            availableScopes={availableScopes}
            projects={userProjects}
            projectAreas={allProjectAreas}
        />
    );
}
