import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import { db } from "@/db";
import { events, semesters, areas, users } from "@/db/schema";
import { asc, eq, and, or, isNull, gte, sql } from "drizzle-orm";
import { getPendingJustificationsAction, getMyAttendanceHistoryAction } from "@/server/actions/attendance.actions";
import { getMyDashboardDataAction } from "@/server/actions/dashboard.actions";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Fetch Upcoming Events (Top 3)
    const currentAreaId = session.user.currentAreaId;
    const role = session.user.role;

    // Fetch current area name for the user
    let currentAreaName = "General";
    if (currentAreaId) {
        const areaData = await db.query.areas.findFirst({
            where: eq(areas.id, currentAreaId),
            columns: { name: true }
        });
        if (areaData) {
            currentAreaName = areaData.name;
        }
    }

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
                where: eq(areas.isLeadershipArea, true),
                columns: { id: true }
            });

            // Logic:
            // 1. General (All) -> Added by default (isNull)
            // 2. My Area (All) -> Added by default (currentAreaId)
            // 3. Mesa Directiva? -> Only for Leaders
            const isLeader = hasPermission(role, "dashboard:leadership_view");

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
                targetArea: true,
                project: {
                    columns: {
                        name: true
                    }
                }
            }
        });
    }

    // 2. Fetch Pending Justifications & History
    const { data: pendingJustifications } = await getPendingJustificationsAction();
    const { data: attendanceHistory } = await getMyAttendanceHistoryAction();

    // 3. Fetch Dashboard KPI & Grades Data
    const { data: dashboardData } = await getMyDashboardDataAction();

    // 4. Fetch pending approval users for admins
    let pendingApprovalUsers: { id: string; name: string | null; email: string; image: string | null; createdAt: Date | null }[] = [];
    if (role && hasPermission(role, "user:manage", session.user.customPermissions)) {
        pendingApprovalUsers = await db.query.users.findMany({
            where: or(
                eq(users.status, "PENDING_APPROVAL"),
                and(eq(users.role, "VOLUNTEER"), eq(users.status, "ACTIVE"))
            ),
            columns: { id: true, name: true, email: true, image: true, createdAt: true },
            orderBy: [asc(users.createdAt)],
        });
    }

    // Attach area name to user object so we don't change too many props
    const userWithArea = {
        ...session.user,
        areaName: currentAreaName
    };

    return <DashboardView
        user={userWithArea}
        upcomingEvents={upcomingEvents}
        pendingJustifications={pendingJustifications || []}
        attendanceHistory={attendanceHistory || []}
        currentSemester={activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null}
        dashboardData={dashboardData}
        pendingApprovalUsers={pendingApprovalUsers}
    />;
}

