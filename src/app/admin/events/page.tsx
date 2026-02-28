import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, areas, semesters, attendanceRecords, projects, users, projectMembers, projectAreas } from "@/db/schema";
import { desc, eq, and, or, isNull, inArray, ne, asc } from "drizzle-orm";
import EventsList from "@/components/events/EventsList";
import CreateEventForm from "@/components/events/CreateEventForm";
import { CalendarCheck, Plus, Filter } from "lucide-react";
import Link from "next/link";
import EventsView from "@/components/events/EventsView";
import { hasPermission } from "@/lib/permissions";
import { getCreatableIISEEventTypes } from "@/server/services/event-permissions.service";

export default async function EventsPage() {
    const session = await auth();
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

    if (activeSemester) {
        const mdArea = await db.query.areas.findFirst({
            where: eq(areas.isLeadershipArea, true),
            columns: { id: true }
        });

        // A. Admin (DEV/PRESIDENT): Fetch ALL events and ALL areas
        if (role === "DEV" || role === "PRESIDENT") {
            eventsData = await db.query.events.findMany({
                where: eq(events.semesterId, activeSemester.id),
                orderBy: [desc(events.date)],
                with: {
                    targetArea: true,
                    project: { columns: { id: true, name: true } },
                    targetProjectArea: { columns: { id: true, name: true } },
                    createdBy: { columns: { name: true, role: true } }
                }
            });
            areasList = await db.select({ id: areas.id, name: areas.name }).from(areas);
        }

        // B. Treasurer: Fetch General + MD Only
        else if (role === "TREASURER") {
            const visibilityConditions = [isNull(events.targetAreaId)];
            if (mdArea) visibilityConditions.push(eq(events.targetAreaId, mdArea.id));

            eventsData = await db.query.events.findMany({
                where: and(
                    eq(events.semesterId, activeSemester.id),
                    or(...visibilityConditions)
                ),
                orderBy: [desc(events.date)],
                with: {
                    targetArea: true,
                    project: { columns: { id: true, name: true } },
                    targetProjectArea: { columns: { id: true, name: true } },
                    createdBy: { columns: { name: true, role: true } }
                }
            });
            if (mdArea) areasList = await db.select({ id: areas.id, name: areas.name }).from(areas).where(eq(areas.isLeadershipArea, true));
        }

        // C. Director/Subdirector: Fetch Own Events + General Events + BOARD (MD) Events
        else if (role === "DIRECTOR" || role === "SUBDIRECTOR") {
            if (currentAreaId) {
                const areaObj = await db.query.areas.findFirst({
                    where: eq(areas.id, currentAreaId),
                    columns: { name: true }
                });
                if (areaObj) userAreaName = areaObj.name;
            }

            const visibilityConditions = [
                isNull(events.targetAreaId),
                eq(events.targetAreaId, currentAreaId || "impossible_id")
            ];
            if (mdArea) {
                visibilityConditions.push(eq(events.targetAreaId, mdArea.id));
            }

            eventsData = await db.query.events.findMany({
                where: and(
                    eq(events.semesterId, activeSemester.id),
                    or(...visibilityConditions)
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
    }

    // 4. Fetch Pending Justifications Count Aggregation
    const eventIds = eventsData.map(e => e.id);
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

    const eventsWithCounts = eventsData.map(e => ({
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

    return (
        <EventsView
            events={eventsWithCounts}
            activeSemesterName={activeSemester?.name || "Sin Semestre"}
            userRole={role}
            userAreaId={currentAreaId}
            userAreaName={userAreaName}
            areas={areasList}
            availableTypes={creatableTypes}
            users={activeUsers}
            availableScopes={availableScopes}
            projects={userProjects}
            projectAreas={allProjectAreas}
        />
    );
}
