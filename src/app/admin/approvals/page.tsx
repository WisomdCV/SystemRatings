import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { getPendingUsersAction } from "@/server/actions/approval.actions";
import ApprovalsList from "@/components/admin/ApprovalsList";
import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";

export default async function AdminApprovalsPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    if (!hasPermission(role, "user:approve", session.user.customPermissions)) {
        return redirect("/admin?error=AccessDenied");
    }

    const result = await getPendingUsersAction();
    const pendingUsers = result.success ? result.data : [];

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0" />
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />

            <div className="relative z-10 max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center gap-4">
                    <Link
                        href="/admin"
                        className="bg-white p-3 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100 flex-shrink-0"
                        title="Volver al Panel de Administración"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-900/20">
                            <UserCheck className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black text-meteorite-950">
                                Solicitudes de Acceso
                            </h2>
                            <p className="text-meteorite-500 font-medium mt-1">
                                Aprueba o rechaza usuarios que desean ingresar al sistema.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-meteorite-100 shadow-sm p-6">
                    <ApprovalsList users={pendingUsers ?? []} />
                </div>
            </div>
        </div>
    );
}
