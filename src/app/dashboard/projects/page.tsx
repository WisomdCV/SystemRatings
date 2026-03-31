import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { getProjectsAction } from "@/server/actions/project.actions";
import { hasPermission } from "@/lib/permissions";
import ProjectsList from "@/components/projects/ProjectsList";
import Link from "next/link";
import { FolderKanban, ArrowLeft } from "lucide-react";

const CYCLE_FILTERS = [
    { value: "active", label: "Ciclo actual" },
    { value: "history", label: "Historial" },
    { value: "all", label: "Todos" },
] as const;

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<{ cycle?: string }> }) {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const cycleParam = resolvedSearchParams?.cycle;
    const cycleFilter = cycleParam === "history" || cycleParam === "all"
        ? cycleParam
        : "active";
    const projectsResult = await getProjectsAction(cycleFilter);

    const subtitleByFilter: Record<string, string> = {
        active: "Gestiona los proyectos activos del ciclo actual",
        history: "Consulta proyectos extendidos o archivados",
        all: "Vista completa de todos los proyectos",
    };

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
                                    {subtitleByFilter[cycleFilter]}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-meteorite-200 bg-white/90 p-1">
                        {CYCLE_FILTERS.map((filter) => {
                            const active = filter.value === cycleFilter;
                            return (
                                <Link
                                    key={filter.value}
                                    href={filter.value === "active" ? "/dashboard/projects" : `/dashboard/projects?cycle=${filter.value}`}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${active
                                        ? "bg-meteorite-900 text-white"
                                        : "text-meteorite-600 hover:bg-meteorite-100"
                                        }`}
                                >
                                    {filter.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <ProjectsList
                    projects={projectsResult.success && projectsResult.data ? projectsResult.data : []}
                    canCreate={hasPermission(session.user.role, "project:create", session.user.customPermissions)}
                    currentUserId={session.user.id!}
                    canViewAny={hasPermission(session.user.role, "project:view_any", session.user.customPermissions)}
                />
            </div>
        </div>
    );
}
