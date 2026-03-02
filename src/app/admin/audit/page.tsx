import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getAuditDataAction } from "@/server/actions/audit.actions";
import AuditView from "@/components/admin/audit/AuditView";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default async function AuditPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role;
    if (!role || !["DEV", "PRESIDENT"].includes(role)) {
        redirect("/dashboard?error=AccessDenied");
    }

    const result = await getAuditDataAction();

    if (!result.success) {
        return (
            <div className="min-h-screen bg-meteorite-50 flex items-center justify-center p-10">
                <div className="text-center text-red-500 bg-white rounded-2xl shadow p-8">
                    <h3 className="font-bold text-lg">Error al cargar auditoría</h3>
                    <p>{result.error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
                            title="Volver a Administración"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-800 flex items-center justify-center shadow-lg shadow-rose-900/20">
                                <ShieldCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-meteorite-950">
                                    Auditoría de Permisos
                                </h2>
                                <p className="text-meteorite-500 text-sm font-medium">
                                    Visualiza los accesos efectivos de cada usuario en el sistema.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block">
                        <Link
                            href="/admin"
                            className="flex items-center gap-2 px-4 py-2 bg-white text-meteorite-700 text-sm font-bold rounded-xl border border-meteorite-200 shadow-sm hover:shadow-md hover:border-meteorite-300 transition-all group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Regresar a Admin
                        </Link>
                    </div>
                </div>

                <AuditView
                    users={result.data.users}
                    customRoles={result.data.customRoles}
                    history={result.data.history}
                    allPermissions={result.data.allPermissions}
                    eventCapabilities={result.data.eventCapabilities}
                />
            </div>
        </div>
    );
}
