import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { getAllAreasAction, getAreasWithLeadersAction, getMembersForAssignmentAction } from "@/server/actions/area.actions";
import { getAllSemestersAction } from "@/server/actions/semester.actions";
import { getPillarsBySemesterAction } from "@/server/actions/pillar.actions";
import { getProjectAreasAction, getProjectRolesAction } from "@/server/actions/project-settings.actions";
import { hasPermission } from "@/lib/permissions";
import SetupWizard from "@/components/admin/setup/SetupWizard";
import Link from "next/link";
import { ArrowLeft, Wand2 } from "lucide-react";

export default async function SetupWizardPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    if (!hasPermission(role, "semester:manage")) {
        return redirect("/dashboard?error=AccessDenied");
    }

    const [semestersResult, areasResult, leadersResult, membersResult, projectAreasResult, projectRolesResult] = await Promise.all([
        getAllSemestersAction(),
        getAllAreasAction(),
        getAreasWithLeadersAction(),
        getMembersForAssignmentAction(),
        getProjectAreasAction(),
        getProjectRolesAction(),
    ]);

    const semesters = semestersResult.success && semestersResult.data ? semestersResult.data : [];
    const areas = areasResult.success && areasResult.data ? areasResult.data : [];
    const leaders = leadersResult.success && leadersResult.data ? leadersResult.data : [];
    const members = membersResult.success && membersResult.data ? membersResult.data : [];
    const projectAreas = projectAreasResult.success && projectAreasResult.data ? projectAreasResult.data : [];
    const projectRoles = projectRolesResult.success && projectRolesResult.data ? projectRolesResult.data : [];

    // Fetch pillars for the first inactive semester (most likely to be the one being configured)
    // Also build the "other semesters" list for the clone feature
    const inactiveSemesters = semesters.filter(s => !s.isActive);
    const targetSemester = inactiveSemesters[0];
    let pillars: any[] = [];
    if (targetSemester) {
        const pillarsResult = await getPillarsBySemesterAction(targetSemester.id);
        if (pillarsResult.success && pillarsResult.data) {
            pillars = pillarsResult.data;
        }
    }
    const otherSemesters = semesters
        .filter(s => s.id !== targetSemester?.id)
        .map(s => ({ id: s.id, name: s.name }));

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/cycles"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                                <Wand2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-meteorite-950">
                                    Wizard Pre-Ciclo
                                </h2>
                                <p className="text-meteorite-500 text-sm font-medium">
                                    Configura todo lo necesario para iniciar un nuevo ciclo
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Wizard */}
                <SetupWizard
                    existingSemesters={semesters}
                    areas={areas}
                    areasWithLeaders={leaders}
                    eligibleUsers={members}
                    initialPillars={pillars}
                    otherSemesters={otherSemesters}
                    initialProjectAreas={projectAreas}
                    initialProjectRoles={projectRoles}
                />
            </div>
        </div>
    );
}
