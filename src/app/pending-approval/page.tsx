import { auth, signOut } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Clock, LogOut, Mail, Shield, RefreshCcw } from "lucide-react";
import Link from "next/link";

export default async function PendingApprovalPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    // Always check fresh status from DB (session might be cached)
    const dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { status: true, role: true, name: true, email: true, image: true }
    });

    // If user is approved (not pending AND not volunteer), send them to dashboard
    if (!dbUser || (dbUser.status !== "PENDING_APPROVAL" && dbUser.role !== "VOLUNTEER")) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-meteorite-50 to-white p-4">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-72 h-72 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-20"></div>
            </div>

            <div className="relative z-10 w-full max-w-lg">
                <div className="bg-white rounded-3xl shadow-xl border border-meteorite-100 overflow-hidden">
                    {/* Header gradient */}
                    <div className="bg-gradient-to-r from-meteorite-600 to-meteorite-800 px-8 py-6 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Solicitud en Revisión</h1>
                        <p className="text-meteorite-200 text-sm mt-1">Tu acceso está pendiente de aprobación</p>
                    </div>

                    {/* User info card */}
                    <div className="px-8 py-6 space-y-6">
                        <div className="flex items-center gap-4 bg-meteorite-50 rounded-2xl p-4">
                            {dbUser.image ? (
                                <img
                                    src={dbUser.image}
                                    alt={dbUser.name || "Usuario"}
                                    className="w-14 h-14 rounded-full border-2 border-meteorite-200"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-meteorite-200 flex items-center justify-center">
                                    <span className="text-xl font-bold text-meteorite-600">
                                        {dbUser.name?.charAt(0) || "?"}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-meteorite-900 truncate">
                                    {dbUser.name || "Usuario"}
                                </p>
                                <div className="flex items-center gap-1.5 text-meteorite-500 text-sm">
                                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{dbUser.email}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0">
                                <Shield className="w-3.5 h-3.5" />
                                Pendiente
                            </div>
                        </div>

                        {/* Info message */}
                        <div className="space-y-3">
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Tu cuenta ha sido registrada exitosamente. Un <strong>administrador del sistema IISE</strong> revisará 
                                tu solicitud y autorizará tu acceso.
                            </p>
                            <p className="text-gray-500 text-xs leading-relaxed">
                                Una vez aprobada, podrás acceder al dashboard completo con todas las funcionalidades
                                del sistema. Este proceso suele ser rápido.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 pt-2">
                            <Link
                                href="/pending-approval"
                                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-meteorite-600 text-white rounded-xl hover:bg-meteorite-700 transition-colors font-medium text-sm"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Verificar estado de solicitud
                            </Link>

                            <form
                                action={async () => {
                                    "use server";
                                    await signOut({ redirectTo: "/login" });
                                }}
                            >
                                <button
                                    type="submit"
                                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Cerrar sesión
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-meteorite-400 mt-6">
                    IISE Manager — Sistema de Control y Rendimiento
                </p>
            </div>
        </div>
    );
}
