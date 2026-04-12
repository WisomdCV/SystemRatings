"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { upsertGradeAction } from "@/server/actions/grading.actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Info, ArrowLeft, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { getKpiStatus } from "@/lib/utils/kpi-colors";
import { getAreaColorStyle } from "@/lib/utils/area-colors";
import { DIRECTOR_LEVEL_ROLES } from "@/lib/permissions";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// --- Types tailored for the Grid ---
type GradingScope = "ALL" | "OWN_AREA" | "NONE";

type GradingData = {
    semester: any;
    pillars: any[];
    users: any[];
    grades: Record<string, Record<string, any>>;
    kpis: Record<string, number>;
    graderAreaId?: string | null;
    permissions?: {
        canViewOwnArea?: boolean;
        canViewAll?: boolean;
        canGradeAny?: boolean;
        pillarPermissions?: Record<string, GradingScope>;
    };
};

interface GradingGridProps {
    initialData: GradingData;
    currentUserRole: string;
}

export default function GradingGrid({ initialData, currentUserRole }: GradingGridProps) {
    const { pillars, users, grades: initialGrades, kpis: initialKpis, permissions, graderAreaId } = initialData;
    const [grades, setGrades] = useState(initialGrades);
    const [kpis, setKpis] = useState(initialKpis);
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    // Per-pillar permissions from server (flexible, DB-driven)
    const pillarPermissions = permissions?.pillarPermissions ?? {};
    const canGradeAny = permissions?.canGradeAny ?? true; // backward compat

    // Filters State
    const hasFilters = ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"].includes(currentUserRole);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState("ALL");
    const [filterArea, setFilterArea] = useState("ALL");

    // Pillars Ordering
    const PILLAR_ORDER_MAP: Record<string, number> = {
        "Reunión General": 1,
        "Área": 2,
        "Proyectos": 3,
        "Staff": 4,
        "Liderazgo (CD)": 5
    };

    const sortedPillars = [...pillars].sort((a, b) => {
        const orderA = PILLAR_ORDER_MAP[a.name] || 99;
        const orderB = PILLAR_ORDER_MAP[b.name] || 99;
        return orderA - orderB;
    });

    // Filtering Logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const term = searchTerm.toLowerCase();
            const matchesText =
                (user.name?.toLowerCase() || "").includes(term) ||
                (user.email?.toLowerCase() || "").includes(term) ||
                (user.cui?.toLowerCase() || "").includes(term) ||
                (user.phoneNumber?.toLowerCase() || "").includes(term);

            const matchesRole = filterRole === "ALL" || user.role === filterRole;
            const matchesArea = filterArea === "ALL" || (user.currentArea?.name === filterArea);

            return matchesText && matchesRole && matchesArea;
        });
    }, [users, searchTerm, filterRole, filterArea]);

    // Unique Areas/Roles for Filter
    const uniqueAreas = Array.from(new Set(users.map((u: any) => u.currentArea?.name).filter(Boolean))) as string[];
    const uniqueRoles = Array.from(new Set(users.map((u: any) => u.role).filter(Boolean))) as string[];

    /**
     * Determines if the current grader can edit a specific cell (pillar × user).
     * Uses server-computed pillarPermissions (scope per pillar) combined with
     * isDirectorOnly check on the target user.
     */
    const canEditCell = (pillar: any, targetUser: any): boolean => {
        // 1. isDirectorOnly: target user must be director-level
        if (pillar.isDirectorOnly) {
            if (!DIRECTOR_LEVEL_ROLES.includes(targetUser.role)) return false;
        }

        // 2. Per-pillar grading scope from server
        const scope = pillarPermissions[pillar.id];

        // If no pillarPermissions data (legacy), fall back to "can grade" if canGradeAny
        if (scope === undefined) return canGradeAny;

        if (scope === "NONE") return false;
        if (scope === "ALL") return true;

        // OWN_AREA: validate target is in grader's area using server-provided graderAreaId
        if (scope === "OWN_AREA") {
            if (!graderAreaId) return false;
            return targetUser.currentAreaId === graderAreaId || targetUser.currentArea?.id === graderAreaId;
        }

        return false;
    };

    const handleSave = async (userId: string, pillarId: string, value: string, maxScore: number): Promise<boolean> => {
        const key = `${userId}-${pillarId}`;

        let numValue = parseFloat(value);
        if (isNaN(numValue)) numValue = 0;

        if (numValue > maxScore) {
            toast.error(`La nota máxima para este pilar es ${maxScore}`);
            return false;
        }
        if (numValue < 0) {
            toast.error("La nota no puede ser negativa");
            return false;
        }

        setSaving(prev => ({ ...prev, [key]: true }));

        try {
            const res = await upsertGradeAction({
                targetUserId: userId,
                definitionId: pillarId,
                score: numValue
            });

            if (res.success) {
                setGrades(prev => ({
                    ...prev,
                    [userId]: {
                        ...(prev[userId] || {}),
                        [pillarId]: { ...prev[userId]?.[pillarId], score: numValue }
                    }
                }));

                if (res.newKpi !== undefined) {
                    setKpis(prev => ({ ...prev, [userId]: res.newKpi }));
                }
                return true;
            } else {
                toast.error(res.error);
                return false;
            }
        } catch (error) {
            toast.error("Error de conexión");
            return false;
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    // Styling Helper for Pillar Headers
    const getPillarColor = (name: string) => {
        if (name.includes("General")) return "bg-blue-50 text-blue-700 border-blue-200";
        if (name.includes("Área")) return "bg-orange-50 text-orange-700 border-orange-200";
        if (name.includes("Proyectos")) return "bg-purple-50 text-purple-700 border-purple-200";
        if (name.includes("Staff")) return "bg-pink-50 text-pink-700 border-pink-200";
        if (name.includes("Liderazgo")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
        return "bg-gray-50 text-gray-700 border-gray-200";
    };

    const getAreaBadgeStyle = (areaColor: string | null | undefined) => {
        return getAreaColorStyle(areaColor);
    };

    // Scope indicator for pillar headers
    const getScopeLabel = (pillarId: string): string | null => {
        const scope = pillarPermissions[pillarId];
        if (!scope || scope === "ALL") return null;
        if (scope === "OWN_AREA") return "Solo tu área";
        if (scope === "NONE") return "Solo lectura";
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Read-only banner when user can't grade any pillar */}
            {!canGradeAny && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800 font-medium">
                        Solo tienes permisos de visualización. No puedes editar calificaciones.
                    </p>
                </div>
            )}

            {/* TOOLBAR: Back Button & Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <Link href="/dashboard" className="inline-flex items-center text-gray-500 hover:text-meteorite-600 transition-colors font-semibold group">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-2 shadow-sm group-hover:border-meteorite-300 group-hover:shadow-md transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    Volver al Dashboard
                </Link>

                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre, correo, CUI..."
                                className="pl-9 h-10 bg-gray-50 border-transparent focus:bg-white transition-all rounded-xl text-black placeholder:text-gray-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="h-8 w-[1px] bg-gray-200 hidden lg:block"></div>

                        <Select value={filterArea} onValueChange={setFilterArea}>
                            <SelectTrigger className="w-[140px] h-10 rounded-xl bg-gray-50 border-transparent hover:bg-gray-100 text-black">
                                <SelectValue placeholder="Área" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-sm border-gray-100 shadow-xl overflow-hidden rounded-xl z-[60]">
                                <SelectItem value="ALL" className="text-black font-medium hover:bg-gray-100 cursor-pointer">Todas las Áreas</SelectItem>
                                {uniqueAreas.map(area => (
                                    <SelectItem key={area} value={area} className="text-black hover:bg-gray-100 cursor-pointer">{area}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger className="w-[140px] h-10 rounded-xl bg-gray-50 border-transparent hover:bg-gray-100 text-black">
                                <SelectValue placeholder="Rol" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-sm border-gray-100 shadow-xl overflow-hidden rounded-xl z-[60]">
                                <SelectItem value="ALL" className="text-black font-medium hover:bg-gray-100 cursor-pointer">Todos los Roles</SelectItem>
                                {uniqueRoles.map(role => (
                                    <SelectItem key={role} value={role} className="text-black hover:bg-gray-100 cursor-pointer">{role}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {(searchTerm || filterArea !== "ALL" || filterRole !== "ALL") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSearchTerm(""); setFilterArea("ALL"); setFilterRole("ALL"); }}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-10 px-3 rounded-xl"
                            >
                                Limpiar
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 request-list-card overflow-hidden overflow-x-auto relative">
                <table className="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase text-xs tracking-wider">
                            <th className="px-6 py-5 md:sticky md:left-0 bg-gray-50 z-10 md:z-20 min-w-[200px] md:min-w-[250px] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-left whitespace-nowrap">Miembro</th>
                            <th className="px-6 py-5 min-w-[150px] text-left whitespace-nowrap">Rol / Área</th>
                            {sortedPillars.map(p => {
                                const scopeLabel = getScopeLabel(p.id);
                                return (
                                    <th key={p.id} className="px-4 py-5 text-center min-w-[140px]">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className={cn(
                                                "font-black px-2.5 py-1 rounded-lg border text-[10px] shadow-sm whitespace-nowrap tracking-wide",
                                                getPillarColor(p.name)
                                            )}>
                                                {p.name}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-semibold bg-white px-2 py-0.5 rounded-full border border-gray-100">
                                                Max: {p.maxScore}
                                            </span>
                                            {scopeLabel && (
                                                <span className="text-[8px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                                    {scopeLabel}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                            <th className="px-6 py-5 text-center md:sticky md:right-0 bg-gray-50 z-10 md:z-20 md:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">KPI Final</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={sortedPillars.length + 3} className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Info className="w-8 h-8 text-gray-300" />
                                        <p>No se encontraron miembros asignados a tu área.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={sortedPillars.length + 3} className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Search className="w-8 h-8 text-gray-300" />
                                        <p>No se encontraron resultados para tu búsqueda.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                    {/* User Info */}
                                    <td className="px-6 py-4 font-bold text-gray-900 md:sticky md:left-0 bg-white group-hover:bg-gray-50/50 z-0 md:z-10 border-r border-transparent md:border-gray-50 group-hover:border-gray-100 transition-colors md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-3 min-w-max">
                                            <UserAvatar
                                                src={user.image}
                                                name={user.name}
                                                alt={user.name}
                                                className="w-9 h-9 rounded-full border border-gray-100 shadow-sm flex-shrink-0"
                                                fallbackClassName="bg-gradient-to-br from-meteorite-100 to-meteorite-200 text-meteorite-700 text-xs ring-2 ring-white"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 group-hover:text-meteorite-800 transition-colors whitespace-nowrap">{user.name}</span>
                                                <span className="text-[10px] text-gray-400 font-normal truncate max-w-[150px]">{user.email}</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5 align-top min-w-max">
                                            <span className="text-xs font-bold text-gray-700">{user.role}</span>
                                            <span
                                            className="text-[10px] px-2 py-0.5 rounded-md w-fit font-medium border transition-colors"
                                            style={getAreaBadgeStyle(user.currentArea?.color)}
                                        >
                                                {user.currentArea?.name || "Sin Área"}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Grade Inputs */}
                                    {sortedPillars.map(pillar => {
                                        const grade = grades[user.id]?.[pillar.id];
                                        const currentScore = grade?.score ?? "";
                                        const key = `${user.id}-${pillar.id}`;
                                        const isSaving = saving[key];
                                        const isEditable = canEditCell(pillar, user);

                                        return (
                                            <td key={pillar.id} className="px-4 py-3 text-center align-middle">
                                                <div className="relative group/input flex justify-center">
                                                    {isEditable ? (
                                                        <Input
                                                            type="number"
                                                            placeholder="0.000"
                                                            defaultValue={currentScore}
                                                            step="0.001"
                                                            min={0}
                                                            max={pillar.maxScore}
                                                            className={cn(
                                                                "w-24 text-center font-bold transition-all bg-white text-gray-900 border-gray-200 shadow-sm",
                                                                "hover:border-meteorite-300 focus:border-meteorite-500 focus:ring-meteorite-500/20",
                                                                "[&::-webkit-inner-spin-button]:appearance-none",
                                                                currentScore !== "" && "border-emerald-200 bg-emerald-50/10 text-emerald-900"
                                                            )}
                                                            onBlur={async (e) => {
                                                                let val = e.target.value;
                                                                const numVal = parseFloat(val);
                                                                if (!isNaN(numVal)) {
                                                                    const formatted = numVal.toFixed(3);
                                                                    if (val !== formatted) {
                                                                        e.target.value = formatted;
                                                                        val = formatted;
                                                                    }
                                                                }

                                                                if (val !== "" && numVal !== parseFloat(String(currentScore || 0))) {
                                                                    const success = await handleSave(user.id, pillar.id, val, pillar.maxScore);
                                                                    if (!success) {
                                                                        e.target.value = typeof currentScore === 'number' ? currentScore.toFixed(3) : "";
                                                                    }
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') e.currentTarget.blur();
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className={cn(
                                                            "w-24 h-10 flex items-center justify-center mx-auto rounded-md text-xs font-medium select-none",
                                                            currentScore !== ""
                                                                ? "bg-gray-50 border border-gray-200 text-gray-600 font-bold"
                                                                : "bg-gray-50 border border-transparent text-gray-300 cursor-not-allowed"
                                                        )}>
                                                            {currentScore !== "" ? parseFloat(String(currentScore)).toFixed(3) : "-"}
                                                        </div>
                                                    )}

                                                    {/* Indicators */}
                                                    <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                                                        {isSaving && <Loader2 className="w-3 h-3 text-meteorite-500 animate-spin" />}
                                                        {!isSaving && currentScore !== "" && isEditable && (
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover/input:opacity-100 transition-opacity" />
                                                        )}
                                                    </div>
                                                </div>
                                                {!isEditable && pillar.isDirectorOnly && (
                                                    <div className="text-[9px] text-gray-300 mt-1 font-medium">No aplica</div>
                                                )}
                                            </td>
                                        );
                                    })}

                                    {/* KPI Final Result */}
                                    <td className="px-6 py-4 text-center md:sticky md:right-0 bg-white group-hover:bg-gray-50/50 border-l border-transparent md:border-gray-50 group-hover:border-gray-100 md:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        {(() => {
                                            const score = kpis[user.id] || 0;
                                            const status = getKpiStatus(score);
                                            return (
                                                <div className={cn(
                                                    "font-black text-sm px-3 py-1.5 rounded-xl border flex flex-col items-center gap-0.5 shadow-sm transform transition-transform hover:scale-105 mx-auto",
                                                    status.color
                                                )}>
                                                    <span>{score.toFixed(2)}</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">
                                                        {status.label}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
