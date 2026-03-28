"use client";

import { useState, useMemo } from "react";
import type { AuditUser } from "@/server/actions/audit.actions";
import { RoleBadge } from "./AuditView";
import { ROLES } from "@/lib/permissions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Search, Filter, Check, X, Minus } from "lucide-react";

function getPermissionDomain(permission: string): string {
    return permission.split(/[:.]/)[0] || permission;
}

function getPermissionAction(permission: string): string {
    return permission.split(/[:.]/)[1] || permission;
}

// Human-readable short labels for permissions
const SHORT_LABELS: Record<string, string> = {
    "event:create_general": "General",
    "event:create_area_own": "Área propia",
    "event:create_area_any": "Cualquier área",
    "event:create_meeting": "Reunión",
    "event:manage_own": "Gestionar propio",
    "event:manage_all": "Gestionar todo",
    "attendance:take_own_area": "Tomar propia",
    "attendance:take_all": "Tomar todo",
    "attendance:review_own_area": "Revisar propia",
    "attendance:review_all": "Revisar todo",
    "grade:assign_own_area": "Asignar propia",
    "grade:assign_all": "Asignar todo",
    "grade:view_own_area": "Ver propia",
    "grade:view_all": "Ver todo",
    "pillar:manage": "Gestionar",
    "semester:manage": "Gestionar",
    "user:approve": "Aprobar",
    "user:manage_role": "Rol/Área",
    "user:manage_data": "Datos",
    "user:moderate": "Moderar",
    "user:manage": "Legacy",
    "area:manage": "Gestionar",
    "project:create": "Crear",
    "project:manage": "Gestionar",
    "dashboard:analytics": "Analíticas",
    "dashboard:area_comparison": "Áreas KPI",
    "dashboard:leadership_view": "Liderazgo",
    "admin:access": "Acceso",
    "admin:audit": "Auditoría",
    "admin:roles": "Roles",
    "admin:full": "Completo (legacy)",
};

interface PermissionMatrixProps {
    users: AuditUser[];
    allPermissions: string[];
}

export default function PermissionMatrix({ users, allPermissions }: PermissionMatrixProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [permFilter, setPermFilter] = useState<string>("ALL");

    // Group permissions by category
    const permsByCategory = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const p of allPermissions) {
            const cat = getPermissionDomain(p);
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(p);
        }
        return map;
    }, [allPermissions]);

    const categories = useMemo(() => Array.from(permsByCategory.keys()), [permsByCategory]);

    // Filter
    const filteredUsers = useMemo(() => {
        let result = users;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(
                (u) =>
                    u.name?.toLowerCase().includes(lower) ||
                    u.email?.toLowerCase().includes(lower)
            );
        }
        if (roleFilter !== "ALL") {
            result = result.filter((u) => u.role === roleFilter);
        }
        return result;
    }, [users, searchTerm, roleFilter]);

    const filteredPermissions = useMemo(() => {
        if (permFilter === "ALL") return allPermissions;
        return allPermissions.filter((p) => getPermissionDomain(p) === permFilter);
    }, [allPermissions, permFilter]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-meteorite-400" />
                    <input
                        type="text"
                        placeholder="Buscar usuario..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-meteorite-50 border border-meteorite-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-meteorite-300"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2.5 bg-meteorite-50 border border-meteorite-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-meteorite-300 appearance-none cursor-pointer"
                >
                    <option value="ALL">Todos los roles</option>
                    {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
                <select
                    value={permFilter}
                    onChange={(e) => setPermFilter(e.target.value)}
                    className="px-4 py-2.5 bg-meteorite-50 border border-meteorite-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-meteorite-300 appearance-none cursor-pointer"
                >
                    <option value="ALL">Todas las categorías</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                </select>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-600" />
                    </span>
                    Vía Rol del Sistema
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center">
                        <Check className="w-3 h-3 text-amber-600" />
                    </span>
                    Vía permisos extra (custom/área)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-purple-100 border border-purple-200 flex items-center justify-center">
                        <Check className="w-3 h-3 text-purple-600" />
                    </span>
                    Ambas fuentes
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-meteorite-50 border border-meteorite-200 flex items-center justify-center">
                        <Minus className="w-3 h-3 text-meteorite-300" />
                    </span>
                    Denegado
                </span>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-meteorite-200">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="bg-meteorite-100">
                            <th className="sticky left-0 z-20 bg-meteorite-100 px-3 py-2.5 text-left font-bold text-meteorite-700 min-w-[180px] border-r border-meteorite-200">
                                Usuario
                            </th>
                            {filteredPermissions.map((perm) => (
                                <th
                                    key={perm}
                                    className="px-2 py-2.5 text-center font-semibold text-meteorite-600 min-w-[70px] border-l border-meteorite-200"
                                    title={perm}
                                >
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[9px] text-meteorite-400 uppercase">
                                            {getPermissionDomain(perm)}
                                        </span>
                                        <span className="truncate max-w-[64px]">
                                            {SHORT_LABELS[perm] || getPermissionAction(perm)}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user, idx) => (
                            <tr
                                key={user.id}
                                className={idx % 2 === 0 ? "bg-white" : "bg-meteorite-50/40"}
                            >
                                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-meteorite-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-meteorite-200 to-meteorite-300 flex items-center justify-center text-[9px] font-bold text-meteorite-700 flex-shrink-0 overflow-hidden">
                                            <UserAvatar
                                                src={user.image}
                                                name={user.name}
                                                className="w-full h-full"
                                                fallbackClassName="bg-transparent text-meteorite-700 text-[9px]"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-meteorite-800 truncate max-w-[120px]">
                                                {user.name || "Sin nombre"}
                                            </p>
                                        </div>
                                        <RoleBadge role={user.role} />
                                    </div>
                                </td>
                                {filteredPermissions.map((perm) => {
                                    const ep = user.effectivePermissions.find(
                                        (e) => e.permission === perm
                                    );
                                    return (
                                        <td key={perm} className="px-1 py-2 text-center border-l border-meteorite-100">
                                            <PermissionCell granted={ep?.granted ?? false} source={ep?.source ?? null} />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td
                                    colSpan={filteredPermissions.length + 1}
                                    className="text-center py-8 text-meteorite-400"
                                >
                                    No se encontraron usuarios.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-meteorite-400 text-right">
                {filteredUsers.length} usuarios × {filteredPermissions.length} permisos
            </p>
        </div>
    );
}

function PermissionCell({
    granted,
    source,
}: {
    granted: boolean;
    source: "role" | "custom" | "both" | null;
}) {
    if (!granted) {
        return (
            <span className="inline-flex w-5 h-5 mx-auto rounded-md bg-meteorite-50 border border-meteorite-100 items-center justify-center">
                <Minus className="w-3 h-3 text-meteorite-300" />
            </span>
        );
    }

    const styles = {
        role: "bg-emerald-100 border-emerald-200 text-emerald-600",
        custom: "bg-amber-100 border-amber-200 text-amber-600",
        both: "bg-purple-100 border-purple-200 text-purple-600",
    };

    const cellStyle = source ? styles[source] : "bg-emerald-100 border-emerald-200 text-emerald-600";

    return (
        <span className={`inline-flex w-5 h-5 mx-auto rounded-md border items-center justify-center ${cellStyle}`}>
            <Check className="w-3 h-3" />
        </span>
    );
}
