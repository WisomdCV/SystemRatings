import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getAllAreasAction, getAreasWithSemesterStatusAction, getAreasWithLeadersAction, getMembersForAssignmentAction } from "@/server/actions/area.actions";
import { getAllSemestersAction } from "@/server/actions/semester.actions";
import { hasPermission } from "@/lib/permissions";
import AreasManager from "@/components/admin/areas/AreasManager";
import AreaLeadershipAssigner from "@/components/admin/areas/AreaLeadershipAssigner";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

export default async function AreasPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    if (!hasPermission(role, "area:manage", session.user.customPermissions)) {
        return redirect("/dashboard?error=AccessDenied");
    }

    const [areasResult, semestersResult, leadersResult, membersResult] = await Promise.all([
        getAllAreasAction(),
        getAllSemestersAction(),
        getAreasWithLeadersAction(),
        getMembersForAssignmentAction(),
    ]);

    if (!areasResult.success) {
        return (
            <div className="p-10 text-center text-red-500">
                Error al cargar áreas: {areasResult.error}
            </div>
        );
    }

    // Find active semester
    const activeSemester = semestersResult.success
        ? semestersResult.data?.find((s: any) => s.isActive)
        : null;

    // Get areas with semester activation status
    let areasWithStatus = areasResult.data || [];
    let semesterStatus: any[] = [];

    if (activeSemester) {
        const statusResult = await getAreasWithSemesterStatusAction(activeSemester.id);
        if (statusResult.success && statusResult.data) {
            semesterStatus = statusResult.data;
        }
    }

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-meteorite-500 to-meteorite-700 flex items-center justify-center shadow-lg">
                                <MapPin className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-meteorite-950">
                                    Gestión de Áreas
                                </h2>
                                {activeSemester && (
                                    <p className="text-meteorite-500 text-sm font-medium">
                                        Ciclo activo: <span className="text-emerald-600 font-bold">{activeSemester.name}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <AreasManager
                    initialAreas={areasResult.data || []}
                    semesterStatus={semesterStatus}
                    activeSemester={activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null}
                />

                {/* Leadership Assignment */}
                {leadersResult.success && membersResult.success && (
                    <div className="mt-8">
                        <AreaLeadershipAssigner
                            areasWithLeaders={leadersResult.data || []}
                            eligibleUsers={membersResult.data || []}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
