import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getAreaComparisonAction } from "@/server/actions/area-comparison.actions";
import AreaComparison from "@/components/dashboard/AreaComparison";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default async function AreasPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = session.user.role || "";
    const canViewComparison = ["DEV", "PRESIDENT", "TREASURER", "DIRECTOR", "SUBDIRECTOR"].includes(role);

    if (!canViewComparison) {
        redirect("/dashboard");
    }

    const { success, data, error } = await getAreaComparisonAction();

    return (
        <div className="min-h-screen bg-meteorite-50">
            {/* Header */}
            <header className="bg-white border-b border-meteorite-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="p-2 hover:bg-meteorite-50 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-meteorite-600" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-meteorite-500 to-meteorite-700 flex items-center justify-center shadow-lg">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-meteorite-950">Comparación de Áreas</h1>
                                <p className="text-xs text-meteorite-500">Rendimiento mensual por área</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {success && data ? (
                    <AreaComparison data={data} />
                ) : (
                    <div className="card-glass p-8 rounded-2xl text-center">
                        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-600 mb-2">
                            {error || "No se pudieron cargar los datos"}
                        </h3>
                        <p className="text-sm text-gray-400">
                            Intenta nuevamente más tarde.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
