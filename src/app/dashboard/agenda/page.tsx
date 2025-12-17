import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, semesters, areas } from "@/db/schema";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import EventsView from "@/components/events/EventsView";

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
        // - Exclude Board (MD) events unless they are in MD (unlikely for normal member)

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
                createdBy: { columns: { name: true, role: true } }
            }
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
            readOnly={true}
        />
    );
}
