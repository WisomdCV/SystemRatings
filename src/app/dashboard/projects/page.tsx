import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getProjectsAction } from "@/server/actions/project.actions";
import { hasPermission } from "@/lib/permissions";
import ProjectsList from "@/components/projects/ProjectsList";
import Link from "next/link";
import { FolderKanban, ArrowLeft } from "lucide-react";

export default async function ProjectsPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const projectsResult = await getProjectsAction();

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-40 -left-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <FolderKanban className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-meteorite-950">Proyectos</h2>
                                <p className="text-meteorite-500 text-sm font-medium">
                                    Gestiona los proyectos del ciclo actual
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <ProjectsList
                    projects={projectsResult.success && projectsResult.data ? projectsResult.data : []}
                    canCreate={hasPermission(session.user.role, "project:create")}
                    currentUserId={session.user.id!}
                />
            </div>
        </div>
    );
}
