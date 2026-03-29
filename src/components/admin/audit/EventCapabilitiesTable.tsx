"use client";

import { useState, useMemo } from "react";
import type {
    AuditUser,
    IISEEventCapability,
    ProjectEventCapability,
    AuditEventCapabilities,
} from "@/server/actions/audit.actions";
import { RoleBadge } from "./AuditView";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ROLES } from "@/lib/permissions";
import {
    Search,
    Filter,
    Globe,
    FolderKanban,
    Check,
    X,
    Shield,
    Paintbrush,
    Flag,
    ChevronDown,
    ChevronRight,
    MapPin,
    Settings,
    CalendarPlus,
    Users as UsersIcon,
    Calendar,
} from "lucide-react";

// =============================================================================
// Props
// =============================================================================

interface EventCapabilitiesTableProps {
    users: AuditUser[];
    eventCapabilities: AuditEventCapabilities;
}

// =============================================================================
// Source Badge
// =============================================================================

function SourceBadge({ source }: { source: string | null }) {
    if (!source) return null;
    const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
        role: {
            label: "Rol",
            icon: <Shield className="w-3 h-3" />,
            className: "bg-blue-50 text-blue-600 border-blue-200",
        },
        custom: {
            label: "Custom",
            icon: <Paintbrush className="w-3 h-3" />,
            className: "bg-amber-50 text-amber-600 border-amber-200",
        },
        area_flag: {
            label: "Capa 3",
            icon: <Flag className="w-3 h-3" />,
            className: "bg-emerald-50 text-emerald-600 border-emerald-200",
        },
        project_role: {
            label: "Rol Proy.",
            icon: <Shield className="w-3 h-3" />,
            className: "bg-indigo-50 text-indigo-600 border-indigo-200",
        },
        project_area: {
            label: "Área Proy.",
            icon: <Flag className="w-3 h-3" />,
            className: "bg-teal-50 text-teal-600 border-teal-200",
        },
        both: {
            label: "Ambos",
            icon: <Shield className="w-3 h-3" />,
            className: "bg-purple-50 text-purple-600 border-purple-200",
        },
    };
    const c = config[source] || { label: source, icon: null, className: "bg-gray-50 text-gray-600 border-gray-200" };

    return (
        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${c.className}`}>
            {c.icon}
            {c.label}
        </span>
    );
}

// =============================================================================
// Capability Cell
// =============================================================================

function CapCell({ granted, source }: { granted: boolean; source: string | null }) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            {granted ? (
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
            ) : (
                <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-red-300" />
                </div>
            )}
            {granted && <SourceBadge source={source} />}
        </div>
    );
}

// =============================================================================
// Area Target Badge
// =============================================================================

function AreaTargetBadge({ target, areaName }: { target: "any" | "own" | null; areaName: string | null }) {
    if (!target) return <span className="text-xs text-meteorite-300">—</span>;
    if (target === "any") {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                <Globe className="w-3 h-3" />
                Todas las áreas
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            <MapPin className="w-3 h-3" />
            {areaName || "Su área"}
        </span>
    );
}

// =============================================================================
// Scope Tabs
// =============================================================================

type ScopeTab = "iise" | "projects";

// =============================================================================
// Main Component
// =============================================================================

export default function EventCapabilitiesTable({ users, eventCapabilities }: EventCapabilitiesTableProps) {
    const [scopeTab, setScopeTab] = useState<ScopeTab>("iise");
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [onlyWithCapabilities, setOnlyWithCapabilities] = useState(false);
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

    // Map capabilities by userId for fast lookup
    const iiseMap = useMemo(() => {
        const map = new Map<string, IISEEventCapability>();
        for (const cap of eventCapabilities.iise) map.set(cap.userId, cap);
        return map;
    }, [eventCapabilities.iise]);

    const projectMap = useMemo(() => {
        const map = new Map<string, ProjectEventCapability[]>();
        for (const cap of eventCapabilities.project) {
            const list = map.get(cap.userId) || [];
            list.push(cap);
            map.set(cap.userId, list);
        }
        return map;
    }, [eventCapabilities.project]);

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
        if (onlyWithCapabilities) {
            if (scopeTab === "iise") {
                result = result.filter((u) => {
                    const cap = iiseMap.get(u.id);
                    return cap && (cap.canGeneral || cap.canArea || cap.canIndividual || cap.canManage);
                });
            } else {
                result = result.filter((u) => {
                    const caps = projectMap.get(u.id);
                    return caps && caps.some((c) => c.canGeneral || c.canArea || c.canIndividual);
                });
            }
        }
        return result;
    }, [users, searchTerm, roleFilter, onlyWithCapabilities, scopeTab, iiseMap, projectMap]);

    // Stats
    const stats = useMemo(() => {
        const iiseCreators = eventCapabilities.iise.filter(
            (c) => c.canGeneral || c.canArea || c.canIndividual
        ).length;
        const iiseManagers = eventCapabilities.iise.filter((c) => c.canManage).length;
        const projectCreators = new Set(
            eventCapabilities.project.filter((c) => c.canGeneral || c.canArea || c.canIndividual).map((c) => c.userId)
        ).size;
        const totalProjects = new Set(eventCapabilities.project.map((c) => c.projectId)).size;
        return { iiseCreators, iiseManagers, projectCreators, totalProjects };
    }, [eventCapabilities]);

    const toggleExpand = (userId: string) => {
        setExpandedUsers((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat icon={<CalendarPlus className="w-4 h-4" />} label="Creadores IISE" value={stats.iiseCreators} color="blue" />
                <MiniStat icon={<Settings className="w-4 h-4" />} label="Gestores IISE" value={stats.iiseManagers} color="rose" />
                <MiniStat icon={<FolderKanban className="w-4 h-4" />} label="Creadores en Proy." value={stats.projectCreators} color="indigo" />
                <MiniStat icon={<Calendar className="w-4 h-4" />} label="Proyectos con Eventos" value={stats.totalProjects} color="emerald" />
            </div>

            {/* Scope Tabs */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setScopeTab("iise")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        scopeTab === "iise"
                            ? "bg-meteorite-900 text-white shadow-lg shadow-meteorite-900/20"
                            : "bg-meteorite-100 text-meteorite-500 hover:bg-meteorite-200"
                    }`}
                >
                    <Globe className="w-4 h-4" />
                    Nivel IISE
                </button>
                <button
                    onClick={() => setScopeTab("projects")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        scopeTab === "projects"
                            ? "bg-meteorite-900 text-white shadow-lg shadow-meteorite-900/20"
                            : "bg-meteorite-100 text-meteorite-500 hover:bg-meteorite-200"
                    }`}
                >
                    <FolderKanban className="w-4 h-4" />
                    Nivel Proyectos
                </button>
            </div>

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
                <label className="flex items-center gap-2 px-3 py-2 bg-meteorite-50 border border-meteorite-200 rounded-xl cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={onlyWithCapabilities}
                        onChange={(e) => setOnlyWithCapabilities(e.target.checked)}
                        className="w-4 h-4 rounded border-meteorite-300 accent-meteorite-600"
                    />
                    <span className="text-sm text-meteorite-600 font-medium whitespace-nowrap">Solo con capacidades</span>
                </label>
            </div>

            {/* Table */}
            {scopeTab === "iise" ? (
                <IISETable users={filteredUsers} iiseMap={iiseMap} />
            ) : (
                <ProjectTable users={filteredUsers} projectMap={projectMap} expandedUsers={expandedUsers} toggleExpand={toggleExpand} />
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 p-3 bg-meteorite-50 rounded-xl border border-meteorite-100">
                <span className="text-xs font-bold text-meteorite-500 uppercase tracking-wide mr-1">Fuentes:</span>
                <SourceBadge source="role" />
                <span className="text-[10px] text-meteorite-400">= Rol del sistema</span>
                <SourceBadge source="custom" />
                <span className="text-[10px] text-meteorite-400">= Rol personalizado</span>
                <SourceBadge source="area_flag" />
                <span className="text-[10px] text-meteorite-400">= Flag de área (BD)</span>
                <SourceBadge source="project_role" />
                <span className="text-[10px] text-meteorite-400">= Permisos de rol de proyecto</span>
            </div>
        </div>
    );
}

// =============================================================================
// IISE TABLE
// =============================================================================

function IISETable({ users, iiseMap }: { users: AuditUser[]; iiseMap: Map<string, IISEEventCapability> }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-meteorite-200">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-meteorite-50">
                        <th className="text-left px-4 py-3 font-bold text-meteorite-700 sticky left-0 bg-meteorite-50 z-10 min-w-[220px]">
                            Usuario
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-meteorite-700">
                            <div className="flex flex-col items-center gap-0.5">
                                <Globe className="w-4 h-4 text-blue-500" />
                                <span className="text-[10px]">General</span>
                            </div>
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-meteorite-700">
                            <div className="flex flex-col items-center gap-0.5">
                                <MapPin className="w-4 h-4 text-violet-500" />
                                <span className="text-[10px]">Área</span>
                            </div>
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-meteorite-700">
                            <div className="flex flex-col items-center gap-0.5">
                                <UsersIcon className="w-4 h-4 text-amber-500" />
                                <span className="text-[10px]">Individual</span>
                            </div>
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-meteorite-700">
                            <div className="flex flex-col items-center gap-0.5">
                                <Settings className="w-4 h-4 text-rose-500" />
                                <span className="text-[10px]">Gestión</span>
                            </div>
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-meteorite-700 min-w-[140px]">
                            Alcance Área
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center py-8 text-meteorite-400 text-sm">
                                No se encontraron usuarios.
                            </td>
                        </tr>
                    )}
                    {users.map((u) => {
                        const cap = iiseMap.get(u.id);
                        if (!cap) return null;

                        return (
                            <tr key={u.id} className="border-t border-meteorite-100 hover:bg-meteorite-50/50 transition-colors">
                                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-meteorite-200 to-meteorite-300">
                                            <UserAvatar
                                                src={u.image}
                                                name={u.name}
                                                className="w-full h-full"
                                                fallbackClassName="bg-transparent text-meteorite-700 text-[10px]"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-meteorite-900 truncate">{u.name || "Sin nombre"}</p>
                                            <div className="flex items-center gap-2">
                                                <RoleBadge role={u.role} />
                                                {u.currentAreaName && (
                                                    <span
                                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                                                        style={{
                                                            backgroundColor: u.currentAreaColor ? `${u.currentAreaColor}15` : undefined,
                                                            color: u.currentAreaColor || undefined,
                                                            borderColor: u.currentAreaColor ? `${u.currentAreaColor}40` : undefined,
                                                        }}
                                                    >
                                                        {u.currentAreaName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <CapCell granted={cap.canGeneral} source={cap.sourceGeneral} />
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <CapCell granted={cap.canArea} source={cap.sourceArea} />
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <CapCell granted={cap.canIndividual} source={cap.sourceIndividual} />
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <CapCell granted={cap.canManage} source={cap.canManage ? "role" : null} />
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <AreaTargetBadge target={cap.areaTarget} areaName={u.currentAreaName} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// =============================================================================
// PROJECT TABLE
// =============================================================================

function ProjectTable({
    users,
    projectMap,
    expandedUsers,
    toggleExpand,
}: {
    users: AuditUser[];
    projectMap: Map<string, ProjectEventCapability[]>;
    expandedUsers: Set<string>;
    toggleExpand: (userId: string) => void;
}) {
    // Only show users with at least one project membership
    const usersWithProjects = useMemo(
        () => users.filter((u) => projectMap.has(u.id) && (projectMap.get(u.id)?.length ?? 0) > 0),
        [users, projectMap]
    );

    if (usersWithProjects.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 bg-meteorite-50/50 rounded-2xl border border-dashed border-meteorite-200">
                <div className="text-center">
                    <FolderKanban className="w-8 h-8 text-meteorite-300 mx-auto mb-2" />
                    <p className="text-meteorite-400 text-sm font-medium">No hay miembros de proyecto que coincidan con el filtro.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {usersWithProjects.map((u) => {
                const caps = projectMap.get(u.id) ?? [];
                const isExpanded = expandedUsers.has(u.id);
                const hasAnyCap = caps.some((c) => c.canGeneral || c.canArea || c.canIndividual);

                return (
                    <div
                        key={u.id}
                        className={`rounded-xl border transition-all ${
                            hasAnyCap
                                ? "border-meteorite-200 bg-white"
                                : "border-meteorite-100 bg-meteorite-50/50"
                        }`}
                    >
                        {/* User Header Row */}
                        <button
                            onClick={() => toggleExpand(u.id)}
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-meteorite-50/50 transition-colors rounded-xl"
                        >
                            <div className="flex-shrink-0 text-meteorite-400">
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </div>
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-meteorite-200 to-meteorite-300">
                                <UserAvatar
                                    src={u.image}
                                    name={u.name}
                                    className="w-full h-full"
                                    fallbackClassName="bg-transparent text-meteorite-700 text-[10px]"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-meteorite-900 truncate">{u.name || "Sin nombre"}</p>
                            </div>
                            <RoleBadge role={u.role} />
                            <span className="text-xs text-meteorite-400 font-semibold">
                                {caps.length} proyecto{caps.length !== 1 ? "s" : ""}
                            </span>
                            {hasAnyCap && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    Puede crear
                                </span>
                            )}
                        </button>

                        {/* Expanded: Project Details */}
                        {isExpanded && (
                            <div className="px-4 pb-3">
                                <div className="overflow-x-auto rounded-lg border border-meteorite-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-meteorite-50/80">
                                                <th className="text-left px-3 py-2 font-bold text-meteorite-600 text-xs">Proyecto</th>
                                                <th className="text-left px-3 py-2 font-bold text-meteorite-600 text-xs">Rol</th>
                                                <th className="text-left px-3 py-2 font-bold text-meteorite-600 text-xs">Área</th>
                                                <th className="text-center px-2 py-2 font-bold text-meteorite-600 text-xs">General</th>
                                                <th className="text-center px-2 py-2 font-bold text-meteorite-600 text-xs">Área</th>
                                                <th className="text-center px-2 py-2 font-bold text-meteorite-600 text-xs">Individual</th>
                                                <th className="text-center px-2 py-2 font-bold text-meteorite-600 text-xs">Alcance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {caps.map((c, idx) => (
                                                <tr key={`${c.projectId}-${idx}`} className="border-t border-meteorite-50 hover:bg-meteorite-50/30">
                                                    <td className="px-3 py-2">
                                                        <span className="font-semibold text-meteorite-800">{c.projectName}</span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="text-xs text-indigo-600 font-semibold">{c.projectRoleName || "—"}</span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="text-xs text-violet-600 font-semibold">{c.projectAreaName || "Sin área"}</span>
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        {c.canGeneral ? (
                                                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                                        ) : (
                                                            <X className="w-4 h-4 text-red-300 mx-auto" />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        {c.canArea ? (
                                                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                                        ) : (
                                                            <X className="w-4 h-4 text-red-300 mx-auto" />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        {c.canIndividual ? (
                                                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                                        ) : (
                                                            <X className="w-4 h-4 text-red-300 mx-auto" />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        <AreaTargetBadge target={c.areaTarget} areaName={c.projectAreaName} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// =============================================================================
// Mini Stat
// =============================================================================

function MiniStat({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
}) {
    const colorMap: Record<string, string> = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        rose: "text-rose-600 bg-rose-50 border-rose-100",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    };
    const c = colorMap[color] || "text-meteorite-600 bg-meteorite-50 border-meteorite-100";

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${c}`}>
            <div className="flex-shrink-0">{icon}</div>
            <div>
                <p className="text-xl font-black">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
            </div>
        </div>
    );
}
