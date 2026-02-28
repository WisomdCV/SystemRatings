import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getProjectByIdAction } from "@/server/actions/project.actions";
import { hasPermission } from "@/lib/permissions";
import ProjectDetail from "@/components/projects/ProjectDetail";
import ProjectEventsTab from "@/components/projects/ProjectEventsTab";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { db } from "@/db";
import { users, projectRoles, projectAreas, events, projectMembers } from "@/db/schema";
import { eq, desc, asc, and, ne } from "drizzle-orm";
import { getCreatableProjectEventTypes } from "@/server/services/event-permissions.service";

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) redirect("/login");

    const projectResult = await getProjectByIdAction(params.id);

    if (!projectResult.success || !projectResult.data) {
        return (
            <div className="min-h-screen bg-meteorite-50 flex items-center justify-center">
                <div className="text-center">
                    <FolderKanban className="w-16 h-16 text-meteorite-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-meteorite-950 mb-2">Proyecto no encontrado</h2>
                    <Link href="/dashboard/projects" className="text-meteorite-600 hover:text-meteorite-700 font-bold">
                        ← Volver a Proyectos
                    </Link>
                </div>
            </div>
        );
    }

    // Fetch eligible users for adding members (all active users not yet in project)
    const projectMemberIds = projectResult.data.members.map(m => m.user.id);
    const allUsers = await db.query.users.findMany({
        columns: { id: true, name: true, email: true, role: true, image: true },
        where: eq(users.status, "ACTIVE"),
    });
    const eligibleUsers = allUsers.filter(u => !projectMemberIds.includes(u.id));

    // Fetch dynamic project roles and areas to pass into the component
    const allRoles = await db.query.projectRoles.findMany({
        orderBy: [desc(projectRoles.hierarchyLevel)],
    });

    const allAreas = await db.query.projectAreas.findMany({
        orderBy: [asc(projectAreas.position)],
    });

    // ── Project Events ───────────────────────────────────────────────────────
    // Fetch events for this project
    const projectEvents = await db.query.events.findMany({
        where: eq(events.projectId, params.id),
        orderBy: [desc(events.date)],
        with: {
            targetProjectArea: { columns: { id: true, name: true } },
            createdBy: { columns: { name: true, role: true } }
        }
    });

    // Determine creatable event types via centralized permission engine
    const isSystemAdmin = hasPermission(session.user.role, "project:manage");

    const creatableProjectTypes = await getCreatableProjectEventTypes({
        userRole: session.user.role,
        userAreaId: session.user.currentAreaId,
        customPermissions: session.user.customPermissions,
        projectId: params.id,
        userId: session.user.id,
    });

    // System admins always get all types
    const finalCreatableTypes = isSystemAdmin
        ? ["GENERAL", "AREA", "INDIVIDUAL_GROUP"]
        : creatableProjectTypes;

    const canCreateProjectEvents = finalCreatableTypes.length > 0;

    // Users for invitee picker (project members)
    const projectUsersForPicker = projectResult.data.members.map(m => ({
        id: m.user.id,
        name: m.user.name,
        image: m.user.image,
    }));

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <Link
                        href="/dashboard/projects"
                        className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-black text-meteorite-950">{projectResult.data.name}</h2>
                        <p className="text-meteorite-500 text-xs font-medium">
                            Ciclo: {projectResult.data.semester.name}
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <ProjectDetail
                        project={projectResult.data}
                        eligibleUsers={eligibleUsers}
                        allProjectRoles={allRoles}
                        allProjectAreas={allAreas}
                        currentUserId={session.user.id!}
                        isSystemAdmin={isSystemAdmin}
                    />

                    <ProjectEventsTab
                        projectId={params.id}
                        projectName={projectResult.data.name}
                        events={projectEvents as any}
                        canCreateEvents={canCreateProjectEvents}
                        creatableEventTypes={finalCreatableTypes}
                        projectAreas={allAreas.map(a => ({ id: a.id, name: a.name }))}
                        users={projectUsersForPicker}
                        userRole={session.user.role || ""}
                        userAreaId={session.user.currentAreaId}
                        userAreaName={null}
                    />
                </div>
            </div>
        </div>
    );
}
