import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { getCustomRolesAction } from "@/server/actions/custom-role.actions";
import CustomRoleManager from "@/components/admin/roles/CustomRoleManager";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";

export default async function RolesPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    if (!hasPermission(role, "admin:full", session.user.customPermissions)) {
        return redirect("/dashboard?error=AccessDenied");
    }

    const rolesResult = await getCustomRolesAction();

    // Build permission groups for the UI
    const permissionGroups: Record<string, string[]> = {};
    for (const key of Object.keys(PERMISSIONS)) {
        const [domain] = key.split(":");
        if (!permissionGroups[domain]) permissionGroups[domain] = [];
        permissionGroups[domain].push(key);
    }

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

            <div className="relative z-10">
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
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-meteorite-950">
                                    Roles Personalizables
                                </h2>
                                <p className="text-meteorite-500 text-sm font-medium">
                                    Crea y gestiona roles funcionales con permisos específicos
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <CustomRoleManager
                    initialRoles={rolesResult.success && rolesResult.data ? rolesResult.data : []}
                    permissionGroups={permissionGroups}
                />
            </div>
        </div>
    );
}
