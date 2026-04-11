import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import { db } from "@/db";
import { events, semesters, areas, users, projectMembers } from "@/db/schema";
import { asc, eq, and, or, isNull, isNotNull, gte, inArray } from "drizzle-orm";
import { getMyJustificationsAction, getMyAttendanceHistoryAction } from "@/server/actions/attendance.actions";
import { getMyDashboardDataAction } from "@/server/actions/dashboard.actions";
import { getPendingInvitationsForUserAction } from "@/server/actions/project-invitations.actions";
import { getProjectsAction } from "@/server/actions/project.actions";
import { hasPermission } from "@/lib/permissions";
import { prepareEventsForClient, type VisibilityContext, type ProjectMembershipContext } from "@/server/services/event-visibility.service";

export default async function DashboardPage() {
    const session = await authFresh();

    if (!session?.user) {
        redirect("/login");
    }

    // Fetch Upcoming Events (personalized using centralized visibility rules)
    const currentAreaId = session.user.currentAreaId;
    const role = session.user.role;
    const userId = session.user.id;

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

    const canManageAll = hasPermission(role, "event:manage_all", session.user.customPermissions);
    const canManageOwn = hasPermission(role, "event:manage_own", session.user.customPermissions);
    const canCreateGeneral = hasPermission(role, "event:create_general", session.user.customPermissions);
    const canCreateAreaOwn = hasPermission(role, "event:create_area_own", session.user.customPermissions);
    const canCreateAreaAny = hasPermission(role, "event:create_area_any", session.user.customPermissions);

    if (activeSemester) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        let projectIds: string[] = [];
        let userProjectMemberships: ProjectMembershipContext[] = [];

        const memberships = await db.query.projectMembers.findMany({
            where: eq(projectMembers.userId, userId),
            with: {
                project: {
                    columns: { id: true, semesterId: true },
                    with: {
                        cycles: { columns: { semesterId: true, status: true } },
                    },
                },
                projectRole: { with: { permissions: true } },
            }
        });

        const activeMemberships = memberships.filter((membership) => {
            const project = membership.project;
            if (!project) return false;

            if (project.cycles.length > 0) {
                return project.cycles.some((cycle) => cycle.semesterId === activeSemester.id && cycle.status === "ACTIVE");
            }

            // Backward-compatible fallback for legacy rows without project_cycle records.
            return project.semesterId === activeSemester.id;
        });
        projectIds = activeMemberships.map(m => m.project!.id);
        userProjectMemberships = activeMemberships.map(m => ({
            projectId: m.project!.id,
            projectAreaId: m.projectAreaId,
            projectPermissions: (m.projectRole?.permissions ?? []).map(p => p.permission),
        }));

        const eventWith = {
            targetArea: true,
            project: { columns: { id: true, name: true, color: true } },
            targetProjectArea: { columns: { id: true, name: true, color: true } },
            invitees: { columns: { userId: true } },
        } as const;

        let rawEvents: any[] = [];

        if (canManageAll) {
            rawEvents = await db.query.events.findMany({
                where: and(
                    eq(events.semesterId, activeSemester.id),
                    gte(events.date, today)
                ),
                orderBy: [asc(events.date), asc(events.startTime)],
                with: eventWith,
            });
        } else {
            const visibilityConditions = [eq(events.createdById, userId)];

            // Baseline visibility: IISE general + own area (same policy as agenda).
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

            const visibilityClause = or(...visibilityConditions);
            if (visibilityClause) {
                rawEvents = await db.query.events.findMany({
                    where: and(
                        eq(events.semesterId, activeSemester.id),
                        gte(events.date, today),
                        visibilityClause
                    ),
                    orderBy: [asc(events.date), asc(events.startTime)],
                    with: eventWith,
                });
            }
        }

        const visibilityCtx: VisibilityContext = {
            userId,
            userRole: role || "",
            userAreaId: currentAreaId,
            customPermissions: session.user.customPermissions,
            projectMemberships: userProjectMemberships,
            hasGlobalManage: canManageAll,
        };

        // Keep dashboard concise: show top upcoming visible events.
        upcomingEvents = (await prepareEventsForClient(rawEvents, visibilityCtx)).slice(0, 6);
    }

    // 2. Fetch Pending Justifications & History
    const { data: pendingJustifications } = await getMyJustificationsAction();
    const { data: attendanceHistory } = await getMyAttendanceHistoryAction();
    const { data: pendingProjectInvitations } = await getPendingInvitationsForUserAction();
    const projectsResult = await getProjectsAction();
    const allVisibleProjects = projectsResult.success && projectsResult.data ? projectsResult.data : [];
    const myProjects = allVisibleProjects.filter((project: any) =>
        project.members?.some((member: any) => member.user.id === session.user.id),
    );
    const canViewAnyProjects = hasPermission(role, "project:view_any", session.user.customPermissions);

    // 3. Fetch Dashboard KPI & Grades Data
    const { data: dashboardData } = await getMyDashboardDataAction();

    // 4. Fetch pending approval users for admins
    let pendingApprovalUsers: { id: string; name: string | null; email: string; image: string | null; createdAt: Date | null }[] = [];
    if (role && hasPermission(role, "user:approve", session.user.customPermissions)) {
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
        pendingProjectInvitations={pendingProjectInvitations || []}
        roleChanged={session.user.roleChanged === true}
        myProjects={myProjects}
        allVisibleProjects={allVisibleProjects}
        canViewAnyProjects={canViewAnyProjects}
    />;
}

