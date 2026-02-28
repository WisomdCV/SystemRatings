import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, semesters, areas, users } from "@/db/schema";
import { desc, eq, and, or, isNull, ne, asc } from "drizzle-orm";
import EventsView from "@/components/events/EventsView";
import { getCreatableIISEEventTypes } from "@/server/services/event-permissions.service";

export default async function AgendaPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
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

        // Logic for Members:
        // - General Events (targetAreaId is null)
        // - Specific Area Events (targetAreaId == currentAreaId)
        const conditions = [isNull(events.targetAreaId)]; // General

        if (currentAreaId) {
            conditions.push(eq(events.targetAreaId, currentAreaId));
        }

        eventsData = await db.query.events.findMany({
            where: and(
                eq(events.semesterId, activeSemester.id),
                or(...conditions)
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
    // Queries 3 layers: system role → custom role → area capabilities
    const creatableTypes = await getCreatableIISEEventTypes({
        userRole: role,
        userAreaId: currentAreaId,
        customPermissions: session.user.customPermissions,
    });

    const canCreate = creatableTypes.length > 0;

    // 3. Only fetch extra data when user can actually create events
    let activeUsers: { id: string; name: string | null; image: string | null }[] = [];
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
        />
    );
}
