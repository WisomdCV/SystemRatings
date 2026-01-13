import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import { db } from "@/db";
import { events, semesters, areas } from "@/db/schema";
import { asc, eq, and, or, isNull, gte } from "drizzle-orm";
import { getPendingJustificationsAction, getMyAttendanceHistoryAction } from "@/server/actions/attendance.actions";

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

        if (role) {
            // Find MD Area ID helper
            const mdArea = await db.query.areas.findFirst({
                where: eq(areas.code, "MD"),
                columns: { id: true }
            });

            // Logic:
            // 1. General (All) -> Added by default (isNull)
            // 2. My Area (All) -> Added by default (currentAreaId)
            // 3. Mesa Directiva? -> Only for Leaders
            const isLeader = ["DIRECTOR", "SUBDIRECTOR", "TREASURER", "PRESIDENT", "DEV"].includes(role);

            if (isLeader && mdArea) {
                conditions.push(eq(events.targetAreaId, mdArea.id));
            }
        }

        upcomingEvents = await db.query.events.findMany({
            where: and(
                eq(events.semesterId, activeSemester.id),
                gte(events.date, today), // Future or today
                or(...conditions)
            ),
            orderBy: [asc(events.date), asc(events.startTime)],
            limit: 6,
            with: {
                targetArea: true
            }
        });
    }

    // 2. Fetch Pending Justifications & History
    const { data: pendingJustifications } = await getPendingJustificationsAction();
    const { data: attendanceHistory } = await getMyAttendanceHistoryAction();

    return <DashboardView
        user={session.user}
        upcomingEvents={upcomingEvents}
        pendingJustifications={pendingJustifications || []}
        attendanceHistory={attendanceHistory || []}
        currentSemester={activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null}
    />;
}
