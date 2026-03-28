"use client";

import type { AuditUser } from "@/server/actions/audit.actions";
import { RoleBadge } from "./AuditView";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Shield, ShieldCheck, ShieldX, KeyRound, MapPin, Tag } from "lucide-react";

function getPermissionDomain(permission: string): string {
    return permission.split(/[:.]/)[0] || permission;
}

// Permission category labels in Spanish
const PERMISSION_CATEGORIES: Record<string, { label: string; color: string }> = {
    event: { label: "Eventos", color: "blue" },
    attendance: { label: "Asistencia", color: "emerald" },
    grade: { label: "Calificaciones", color: "amber" },
    pillar: { label: "Pilares", color: "purple" },
    semester: { label: "Semestres", color: "indigo" },
    user: { label: "Usuarios", color: "rose" },
    area: { label: "Áreas", color: "teal" },
    project: { label: "Proyectos", color: "orange" },
    dashboard: { label: "Dashboard", color: "sky" },
    admin: { label: "Admin", color: "red" },
};

// Human-readable permission labels
const PERMISSION_LABELS: Record<string, string> = {
    "event:create_general": "Crear eventos IISE generales",
    "event:create_area_own": "Crear eventos de mi área",
    "event:create_area_any": "Crear eventos para cualquier área",
    "event:create_meeting": "Crear reuniones individuales o grupales",
    "event:manage_own": "Gestionar eventos permitidos",
    "event:manage_all": "Gestionar todos los eventos",
    "attendance:take_own_area": "Tomar asistencia de mi área",
    "attendance:take_all": "Tomar asistencia global",
    "attendance:review_own_area": "Revisar justificaciones de mi área",
    "attendance:review_all": "Revisar justificaciones globales",
    "grade:assign_own_area": "Asignar calificaciones en mi área",
    "grade:assign_all": "Asignar calificaciones globalmente",
    "grade:view_own_area": "Ver hoja de calificaciones de mi área",
    "grade:view_all": "Ver hoja de calificaciones global",
    "pillar:manage": "Gestionar pilares",
    "semester:manage": "Gestionar semestres o ciclos",
    "user:approve": "Aprobar/rechazar solicitudes de acceso",
    "user:manage_role": "Cambiar rol y área de usuarios",
    "user:manage_data": "Editar datos administrativos de usuarios",
    "user:moderate": "Banear/suspender/advertir usuarios",
    "user:manage": "Gestionar usuarios (legacy)",
    "area:manage": "Gestionar áreas",
    "project:create": "Crear proyectos",
    "project:manage": "Gestionar todos los proyectos",
    "dashboard:analytics": "Ver analíticas del dashboard",
    "dashboard:area_comparison": "Ver comparativa de áreas",
    "dashboard:leadership_view": "Vista de liderazgo",
    "admin:access": "Acceso al panel admin",
    "admin:audit": "Acceso a auditoría de permisos",
    "admin:roles": "Gestionar roles y ajustes admin",
    "admin:full": "Acceso admin completo (legacy)",
};

interface UserPermissionsCardProps {
    user: AuditUser;
    allPermissions: string[];
}

export default function UserPermissionsCard({ user, allPermissions }: UserPermissionsCardProps) {
    const granted = user.effectivePermissions.filter((p) => p.granted);
    const denied = user.effectivePermissions.filter((p) => !p.granted);

    // Group permissions by category
    const grouped = new Map<string, typeof user.effectivePermissions>();
    for (const ep of user.effectivePermissions) {
        const cat = getPermissionDomain(ep.permission);
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(ep);
    }

    return (
        <div className="bg-white rounded-2xl border border-meteorite-100 shadow-sm overflow-hidden">
            {/* User Header */}
            <div className="bg-gradient-to-r from-meteorite-900 to-meteorite-800 p-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 overflow-hidden">
                        <UserAvatar
                            src={user.image}
                            name={user.name}
                            className="w-full h-full"
                            fallbackClassName="bg-transparent text-white text-lg"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-white truncate">
                            {user.name || "Sin nombre"}
                        </h3>
                        <p className="text-meteorite-300 text-sm truncate">{user.email}</p>
                    </div>
                </div>

                {/* Quick Info */}
                <div className="flex flex-wrap gap-2 mt-4">
                    <RoleBadge role={user.role} />
                    {user.currentAreaName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/10 text-white border-white/20 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {user.currentAreaName}
                        </span>
                    )}
                    {user.customRoleNames.map((crn) => (
                        <span
                            key={crn}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-200 border-amber-400/30 flex items-center gap-1"
                        >
                            <Tag className="w-3 h-3" />
                            {crn}
                        </span>
                    ))}
                </div>
            </div>

            {/* Summary Bar */}
            <div className="flex border-b border-meteorite-100">
                <div className="flex-1 px-4 py-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-bold text-emerald-700">{granted.length}</span>
                    <span className="text-xs text-meteorite-400">concedidos</span>
                </div>
                <div className="flex-1 px-4 py-3 flex items-center gap-2 border-l border-meteorite-100">
                    <ShieldX className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-bold text-red-500">{denied.length}</span>
                    <span className="text-xs text-meteorite-400">denegados</span>
                </div>
                <div className="flex-1 px-4 py-3 flex items-center gap-2 border-l border-meteorite-100">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-600">{user.customPermissions.length}</span>
                    <span className="text-xs text-meteorite-400">vía extra</span>
                </div>
            </div>

            {/* Permissions by Category */}
            <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
                {Array.from(grouped.entries()).map(([cat, perms]) => {
                    const meta = PERMISSION_CATEGORIES[cat] || { label: cat, color: "gray" };
                    return (
                        <div key={cat}>
                            <h4 className="text-xs font-bold text-meteorite-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" />
                                {meta.label}
                            </h4>
                            <div className="space-y-1">
                                {perms.map((ep) => (
                                    <div
                                        key={ep.permission}
                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                            ep.granted
                                                ? "bg-emerald-50/80 border border-emerald-100"
                                                : "bg-meteorite-50/50 border border-meteorite-100"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {ep.granted ? (
                                                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            ) : (
                                                <ShieldX className="w-4 h-4 text-meteorite-300 flex-shrink-0" />
                                            )}
                                            <span
                                                className={`truncate ${
                                                    ep.granted
                                                        ? "text-meteorite-800 font-medium"
                                                        : "text-meteorite-400"
                                                }`}
                                            >
                                                {PERMISSION_LABELS[ep.permission] || ep.permission}
                                            </span>
                                        </div>
                                        {ep.granted && ep.source && (
                                            <SourceBadge source={ep.source} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SourceBadge({ source }: { source: "role" | "custom" | "both" }) {
    const styles = {
        role: "bg-blue-50 text-blue-600 border-blue-100",
        custom: "bg-amber-50 text-amber-600 border-amber-100",
        both: "bg-purple-50 text-purple-600 border-purple-100",
    };
    const labels = { role: "Rol", custom: "Extra", both: "Ambos" };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${styles[source]}`}>
            {labels[source]}
        </span>
    );
}
