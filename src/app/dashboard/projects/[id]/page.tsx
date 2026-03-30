import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { getProjectByIdAction } from "@/server/actions/project.actions";
import { getProjectInvitationsAction } from "@/server/actions/project-invitations.actions";
import { hasPermission } from "@/lib/permissions";
import ProjectDetail from "@/components/projects/ProjectDetail";
import ProjectEventsTab from "@/components/projects/ProjectEventsTab";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { db } from "@/db";
import { users, projectRoles, projectAreas, events, projectMembers, projectResourceCategories, projectResources } from "@/db/schema";
import { eq, desc, asc, isNull, or } from "drizzle-orm";
import { getCreatableProjectEventTypes } from "@/server/services/event-permissions.service";
import { filterVisibleEvents, type VisibilityContext } from "@/server/services/event-visibility.service";

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await authFresh();
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
    const invitationsResult = await getProjectInvitationsAction(params.id);
    const projectInvitations = invitationsResult.success ? invitationsResult.data : [];
    const pendingInvitedUserIds = new Set(
        projectInvitations.filter((inv) => inv.status === "PENDING").map((inv) => inv.user.id)
    );
    const eligibleUsers = allUsers.filter(u => !projectMemberIds.includes(u.id) && !pendingInvitedUserIds.has(u.id));

    // Fetch dynamic project roles and areas to pass into the component
    const allRoles = await db.query.projectRoles.findMany({
        orderBy: [asc(projectRoles.displayOrder)],
    });

    const allAreas = await db.query.projectAreas.findMany({
        orderBy: [asc(projectAreas.position)],
    });

    // ── Project Events ───────────────────────────────────────────────────────
    // Fetch events for this project
    const allProjectEvents = await db.query.events.findMany({
        where: eq(events.projectId, params.id),
        orderBy: [desc(events.date)],
        with: {
            targetProjectArea: { columns: { id: true, name: true } },
            createdBy: { columns: { name: true, role: true } },
            invitees: {
                with: {
                    user: { columns: { id: true, name: true, image: true } }
                }
            }
        }
    });

    // Find current user's membership in this project (for area-based visibility)
    const currentUserMembership = projectResult.data.members.find(
        m => m.user.id === session.user!.id
    );
    const currentUserHierarchyLevel = currentUserMembership?.projectRole?.hierarchyLevel ?? 0;
    const currentUserProjectAreaId = currentUserMembership?.projectArea?.id || null;
    const currentUserPermissions = (currentUserMembership?.projectRole?.permissions ?? []).map((p: { permission: string }) => p.permission);
    const isSystemAdmin = hasPermission(session.user.role, "project:manage");

    // ── Project Resources ──────────────────────────────────────────────────
    const categories = await db.query.projectResourceCategories.findMany({
        where: or(
            isNull(projectResourceCategories.projectId),
            eq(projectResourceCategories.projectId, params.id),
        ),
        orderBy: [asc(projectResourceCategories.position)],
    });

    const allResources = await db.query.projectResources.findMany({
        where: eq(projectResources.projectId, params.id),
        with: {
            links: {
                with: {
                    addedBy: { columns: { id: true, name: true, image: true } },
                },
            },
            category: { columns: { id: true, name: true, color: true, icon: true } },
            projectArea: { columns: { id: true, name: true, color: true } },
            task: { columns: { id: true, title: true } },
            createdBy: { columns: { id: true, name: true, image: true } },
        },
        orderBy: [desc(projectResources.createdAt)],
    });

    const canViewAllResources = isSystemAdmin
        || currentUserPermissions.includes("project:resource_view_all")
        || currentUserPermissions.includes("project:view_all_areas");

    const resources = isSystemAdmin
        ? allResources
        : (!currentUserMembership
            ? []
            : (canViewAllResources
                ? allResources
                : allResources.filter((resource) => !resource.projectAreaId || resource.projectAreaId === currentUserProjectAreaId)));

    // Centralized visibility filter (uses project permission strings)
    const visibilityCtx: VisibilityContext = {
        userId: session.user.id,
        userRole: session.user.role || "",
        userAreaId: session.user.currentAreaId,
        customPermissions: session.user.customPermissions,
        projectMemberships: [{
            projectId: params.id,
            projectAreaId: currentUserProjectAreaId,
            projectPermissions: currentUserPermissions,
        }],
    };
    const projectEvents = filterVisibleEvents(allProjectEvents, visibilityCtx);

    // Determine creatable event types via centralized permission engine
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
                        currentUserHierarchyLevel={currentUserHierarchyLevel}
                        projectInvitations={projectInvitations}
                        resourceCategories={categories}
                        projectResources={resources}
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
                        userProjectAreaName={currentUserMembership?.projectArea?.name || null}
                    />
                </div>
            </div>
        </div>
    );
}
