import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getProjectAreasAction, getProjectRolesAction } from "@/server/actions/project-settings.actions";
import ProjectSettings from "@/components/admin/ProjectSettings";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ProjectSettingsPage() {
    const session = await auth();
    if (session?.user?.role !== "DEV" && session?.user?.role !== "PRESIDENT") {
        redirect("/dashboard");
    }

    const [areasResult, rolesResult] = await Promise.all([
        getProjectAreasAction(),
        getProjectRolesAction()
    ]);

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <Settings className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-meteorite-950">Ajustes de Proyectos</h2>
                                <p className="text-meteorite-500 text-sm font-medium">
                                    Configura las áreas y jerarquías globales
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <ProjectSettings
                    initialAreas={areasResult.success && areasResult.data ? areasResult.data : []}
                    initialRoles={rolesResult.success && rolesResult.data ? rolesResult.data : []}
                />
            </div>
        </div>
    );
}
