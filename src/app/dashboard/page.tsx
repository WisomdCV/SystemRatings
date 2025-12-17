import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import { db } from "@/db";
import { events, semesters, areas } from "@/db/schema";
import { asc, eq, and, or, isNull, gte } from "drizzle-orm";
import { getPendingJustificationsAction } from "@/server/actions/attendance.actions";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Fetch Upcoming Events (Top 3)
    const currentAreaId = session.user.currentAreaId;
    const role = session.user.role;

    // 1. Get Active Semester
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    let upcomingEvents: any[] = [];

    if (activeSemester) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        const conditions = [isNull(events.targetAreaId)]; // General

        if (currentAreaId) {
            conditions.push(eq(events.targetAreaId, currentAreaId));
        }

        if (role === "TREASURER" || role === "PRESIDENT" || role === "DIRECTOR" || role === "SUBDIRECTOR") {
            // Leaders might see MD events? 
            // For now, stick to General + Own Area to keep Dashboard clean.
            // If we really want MD events: check targetArea.code = 'MD'.
        }

        upcomingEvents = await db.query.events.findMany({
            where: and(
                eq(events.semesterId, activeSemester.id),
                gte(events.date, today), // Future or today
                or(...conditions)
            ),
            orderBy: [asc(events.date), asc(events.startTime)],
            limit: 3,
            with: {
                targetArea: true
            }
        });
    }

    // 2. Fetch Pending Justifications
    const { data: pendingJustifications } = await getPendingJustificationsAction();

    return <DashboardView user={session.user} upcomingEvents={upcomingEvents} pendingJustifications={pendingJustifications || []} />;
}
