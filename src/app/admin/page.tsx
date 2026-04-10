import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Users, MapPin, Shield, RefreshCcw, Settings, ShieldCheck, UserCheck, Eye } from "lucide-react";

export default async function AdminHubPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    const customPermissions = session.user.customPermissions;
    const canManageSemesters = hasPermission(role, "semester:manage", customPermissions);
    const canManagePillars = hasPermission(role, "pillar:manage", customPermissions);
    const canApproveUsers = hasPermission(role, "user:approve", customPermissions);
    const canManageUserRoles = hasPermission(role, "user:manage_role", customPermissions);
    const canManageUserData = hasPermission(role, "user:manage_data", customPermissions);
    const canModerateUsers = hasPermission(role, "user:moderate", customPermissions);
    const canManageUsers = canManageUserRoles || canManageUserData || canModerateUsers;
    const canManageAdminRoles = hasPermission(role, "admin:roles", customPermissions);
    const canViewAdminAudit = hasPermission(role, "admin:audit", customPermissions);
    const canViewAccessPreview = canViewAdminAudit || canManageAdminRoles;

    // El usuario debe tener al menos permiso básico de acceso al panel admin
    if (!hasPermission(role, "admin:access", session.user.customPermissions)) {
        return redirect("/dashboard?error=AccessDenied");
    }

    // Fetch pending approval count for badge
    let pendingCount = 0;
    if (canApproveUsers) {
        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(sql`${users.status} = 'PENDING_APPROVAL' OR (${users.role} = 'VOLUNTEER' AND ${users.status} = 'ACTIVE')`);
        pendingCount = result.count;
    }

    // Definición de las tarjetas y verificación de permisos por cada una
    const adminCards = [
        {
            title: "Solicitudes de Acceso",
            description: "Revisa y aprueba o rechaza a los usuarios que desean ingresar al sistema.",
            href: "/admin/approvals",
            icon: <UserCheck className="w-8 h-8 text-white" />,
            colorClass: "from-orange-500 to-orange-700",
            shadowClass: "shadow-orange-500/30",
            hasAccess: canApproveUsers,
            badge: pendingCount > 0 ? pendingCount : undefined,
        },
        {
            title: "Equipo IISE",
            description: "Gestiona a los miembros, asigna roles, áreas y actualiza estados de cuenta.",
            href: "/admin/users",
            icon: <Users className="w-8 h-8 text-white" />,
            colorClass: "from-blue-500 to-blue-700",
            shadowClass: "shadow-blue-500/30",
            hasAccess: canManageUsers
        },
        {
            title: "Estructura de Áreas",
            description: "Administra las áreas operativas, asigna directores y miembros, y gestiona el ciclo actual.",
            href: "/admin/areas",
            icon: <MapPin className="w-8 h-8 text-white" />,
            colorClass: "from-emerald-500 to-emerald-700",
            shadowClass: "shadow-emerald-500/30",
            hasAccess: hasPermission(role, "area:manage", session.user.customPermissions)
        },
        {
            title: "Permisos y Roles",
            description: "Crea roles personalizados y ajusta los accesos del sistema para delegar funciones.",
            href: "/admin/roles",
            icon: <Shield className="w-8 h-8 text-white" />,
            colorClass: "from-amber-500 to-amber-700",
            shadowClass: "shadow-amber-500/30",
            hasAccess: canManageAdminRoles
        },
        {
            title: "Ciclos Académicos",
            description: "Configura semestres y accede al gestor de pilares por ciclo.",
            href: "/admin/cycles",
            icon: <RefreshCcw className="w-8 h-8 text-white" />,
            colorClass: "from-purple-500 to-purple-700",
            shadowClass: "shadow-purple-500/30",
            hasAccess: canManageSemesters || canManagePillars
        },
        {
            title: "Ajustes de Proyectos",
            description: "Configura dinámicamente las áreas y la jerarquía de poder de los roles en los proyectos.",
            href: "/admin/project-settings",
            icon: <Settings className="w-8 h-8 text-white" />,
            colorClass: "from-indigo-500 to-indigo-700",
            shadowClass: "shadow-indigo-500/30",
            hasAccess: canManageAdminRoles
        },
        {
            title: "Auditoría de Permisos",
            description: "Visualiza la matriz completa de accesos, permisos efectivos por usuario y el historial de cambios de rol.",
            href: "/admin/audit",
            icon: <ShieldCheck className="w-8 h-8 text-white" />,
            colorClass: "from-rose-500 to-rose-700",
            shadowClass: "shadow-rose-500/30",
            hasAccess: canViewAdminAudit
        },
        {
            title: "Vista Previa de Accesos",
            description: "Simula por usuario o rol qué verá y qué acciones podrá ejecutar en módulos como Events y Projects.",
            href: "/admin/access-preview",
            icon: <Eye className="w-8 h-8 text-white" />,
            colorClass: "from-indigo-500 to-violet-700",
            shadowClass: "shadow-indigo-500/30",
            hasAccess: canViewAccessPreview
        }
    ];

    const accessibleCards = adminCards.filter(card => card.hasAccess);

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="bg-white p-3 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100 flex-shrink-0"
                        title="Volver al Dashboard"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-meteorite-700 to-meteorite-900 flex items-center justify-center shadow-lg shadow-meteorite-900/20">
                            <Settings className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black text-meteorite-950">
                                Panel de Administración
                            </h2>
                            <p className="text-meteorite-500 font-medium mt-1">
                                Gestiona la configuración central y accesos del sistema.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Cards Grid */}
                {accessibleCards.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                        {accessibleCards.map((card, index) => (
                            <Link
                                key={index}
                                href={card.href}
                                className="group relative bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-meteorite-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                            >
                                {/* Hover background effect */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-meteorite-50 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-start gap-5">
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${card.colorClass} flex items-center justify-center shadow-lg ${card.shadowClass} flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                                            {card.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-meteorite-900 mb-2 group-hover:text-meteorite-700 transition-colors flex items-center gap-2">
                                                {card.title}
                                                {"badge" in card && card.badge ? (
                                                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                                                        {card.badge}
                                                    </span>
                                                ) : null}
                                            </h3>
                                            <p className="text-meteorite-600 text-sm leading-relaxed">
                                                {card.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-4 group-hover:translate-x-0">
                                        <span className="text-sm font-bold text-meteorite-600 bg-meteorite-50 px-4 py-2 rounded-xl border border-meteorite-100">
                                            Acceder al módulo &rarr;
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-meteorite-100">
                        <Shield className="w-16 h-16 text-meteorite-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-meteorite-800">Acceso Restringido</h3>
                        <p className="text-meteorite-500 mt-2">No tienes permisos para visualizar ningún módulo administrativo.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
