"use client";

import { useState, useMemo } from "react";
import type { AuditUser, AuditCustomRole, AuditHistoryEntry, AuditEventCapabilities } from "@/server/actions/audit.actions";
import UserPermissionsCard from "./UserPermissionsCard";
import PermissionMatrix from "./PermissionMatrix";
import PositionHistoryTable from "./PositionHistoryTable";
import EventCapabilitiesTable from "./EventCapabilitiesTable";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { User, Grid3X3, History, Search, Filter, CalendarCheck } from "lucide-react";

interface AuditViewProps {
    users: AuditUser[];
    customRoles: AuditCustomRole[];
    history: AuditHistoryEntry[];
    allPermissions: string[];
    eventCapabilities: AuditEventCapabilities;
}

type TabKey = "users" | "matrix" | "history" | "events";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "users", label: "Por Usuario", icon: <User className="w-4 h-4" /> },
    { key: "matrix", label: "Matriz de Permisos", icon: <Grid3X3 className="w-4 h-4" /> },
    { key: "events", label: "Capacidades de Eventos", icon: <CalendarCheck className="w-4 h-4" /> },
    { key: "history", label: "Historial de Cambios", icon: <History className="w-4 h-4" /> },
];

export default function AuditView({ users, customRoles, history, allPermissions, eventCapabilities }: AuditViewProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("users");
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // Filter users
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

    const selectedUser = useMemo(
        () => users.find((u) => u.id === selectedUserId) ?? null,
        [users, selectedUserId]
    );

    // Stats
    const stats = useMemo(() => {
        const roleCounts: Record<string, number> = {};
        for (const u of users) {
            const r = u.role || "SIN_ROL";
            roleCounts[r] = (roleCounts[r] || 0) + 1;
        }
        const withCustomRoles = users.filter((u) => u.customRoleNames.length > 0).length;
        return { total: users.length, roleCounts, withCustomRoles, customRolesCount: customRoles.length };
    }, [users, customRoles]);

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Usuarios Totales" value={stats.total} color="blue" />
                <StatCard label="Roles Custom" value={stats.customRolesCount} color="amber" />
                <StatCard label="Con Rol Custom" value={stats.withCustomRoles} color="emerald" />
                <StatCard label="Cambios Registrados" value={history.length} color="purple" />
            </div>

            {/* Tabs */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-meteorite-100 shadow-sm overflow-hidden">
                <div className="flex border-b border-meteorite-100">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
                                activeTab === tab.key
                                    ? "text-meteorite-900 bg-white"
                                    : "text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-50/50"
                            }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            {activeTab === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-meteorite-900"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-4 md:p-6">
                    {activeTab === "users" && (
                        <div className="space-y-4">
                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-meteorite-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre o correo..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-meteorite-50 border border-meteorite-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-meteorite-300 focus:border-meteorite-300"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-meteorite-400" />
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="pl-10 pr-8 py-2.5 bg-meteorite-50 border border-meteorite-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-meteorite-300 appearance-none cursor-pointer"
                                    >
                                        <option value="ALL">Todos los roles</option>
                                        {ROLES.map((r) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* User List + Detail Side-by-Side */}
                            <div className="flex flex-col lg:flex-row gap-4">
                                {/* User List */}
                                <div className="lg:w-[380px] flex-shrink-0 space-y-2 max-h-[600px] overflow-y-auto pr-1">
                                    {filteredUsers.length === 0 && (
                                        <p className="text-meteorite-400 text-sm text-center py-8">
                                            No se encontraron usuarios.
                                        </p>
                                    )}
                                    {filteredUsers.map((u) => (
                                        <button
                                            key={u.id}
                                            onClick={() => setSelectedUserId(u.id)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${
                                                selectedUserId === u.id
                                                    ? "bg-meteorite-100 border-meteorite-300 shadow-sm"
                                                    : "bg-white border-meteorite-100 hover:border-meteorite-200 hover:bg-meteorite-50/50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-meteorite-200 to-meteorite-300 flex items-center justify-center text-meteorite-700 text-xs font-bold flex-shrink-0 overflow-hidden">
                                                    <UserAvatar
                                                        src={u.image}
                                                        name={u.name}
                                                        className="w-full h-full"
                                                        fallbackClassName="bg-transparent text-meteorite-700 text-xs"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-meteorite-900 truncate">
                                                        {u.name || "Sin nombre"}
                                                    </p>
                                                    <p className="text-xs text-meteorite-400 truncate">{u.email}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <RoleBadge role={u.role} />
                                                    {u.customRoleNames.length > 0 && (
                                                        <span className="text-[10px] text-amber-600 font-semibold">
                                                            +{u.customRoleNames.length} custom
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Detail Panel */}
                                <div className="flex-1 min-w-0">
                                    {selectedUser ? (
                                        <UserPermissionsCard
                                            user={selectedUser}
                                            allPermissions={allPermissions}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-64 bg-meteorite-50/50 rounded-2xl border border-dashed border-meteorite-200">
                                            <div className="text-center">
                                                <User className="w-10 h-10 text-meteorite-300 mx-auto mb-2" />
                                                <p className="text-meteorite-400 text-sm font-medium">
                                                    Selecciona un usuario para ver sus permisos
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "matrix" && (
                        <PermissionMatrix
                            users={users}
                            allPermissions={allPermissions}
                        />
                    )}

                    {activeTab === "events" && (
                        <EventCapabilitiesTable
                            users={users}
                            eventCapabilities={eventCapabilities}
                        />
                    )}

                    {activeTab === "history" && (
                        <PositionHistoryTable history={history} />
                    )}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        blue: "from-blue-500 to-blue-600 shadow-blue-500/20",
        amber: "from-amber-500 to-amber-600 shadow-amber-500/20",
        emerald: "from-emerald-500 to-emerald-600 shadow-emerald-500/20",
        purple: "from-purple-500 to-purple-600 shadow-purple-500/20",
    };
    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-meteorite-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-meteorite-400 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-black text-meteorite-900 mt-1">{value}</p>
            <div className={`w-8 h-1 rounded-full bg-gradient-to-r ${colorMap[color]} mt-2`}></div>
        </div>
    );
}

const ROLE_COLORS: Record<string, string> = {
    DEV: "bg-red-100 text-red-700 border-red-200",
    PRESIDENT: "bg-amber-100 text-amber-700 border-amber-200",
    VICEPRESIDENT: "bg-orange-100 text-orange-700 border-orange-200",
    SECRETARY: "bg-sky-100 text-sky-700 border-sky-200",
    TREASURER: "bg-teal-100 text-teal-700 border-teal-200",
    DIRECTOR: "bg-indigo-100 text-indigo-700 border-indigo-200",
    SUBDIRECTOR: "bg-purple-100 text-purple-700 border-purple-200",
    MEMBER: "bg-emerald-100 text-emerald-700 border-emerald-200",
    VOLUNTEER: "bg-meteorite-100 text-meteorite-600 border-meteorite-200",
};

export function RoleBadge({ role }: { role: string | null }) {
    const display = role || "SIN_ROL";
    const colors = ROLE_COLORS[display] || "bg-gray-100 text-gray-600 border-gray-200";
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors}`}>
            {display}
        </span>
    );
}
