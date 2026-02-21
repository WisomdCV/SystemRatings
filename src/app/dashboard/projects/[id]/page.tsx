import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getProjectByIdAction } from "@/server/actions/project.actions";
import { hasPermission } from "@/lib/permissions";
import ProjectDetail from "@/components/projects/ProjectDetail";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, ne } from "drizzle-orm";

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

                <ProjectDetail
                    project={projectResult.data}
                    eligibleUsers={eligibleUsers}
                    currentUserId={session.user.id!}
                    isSystemAdmin={hasPermission(session.user.role, "project:manage")}
                />
            </div>
        </div>
    );
}
