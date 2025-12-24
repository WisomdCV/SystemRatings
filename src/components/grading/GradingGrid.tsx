"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { upsertGradeAction } from "@/server/actions/grading.actions";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getKpiStatus } from "@/lib/utils/kpi-colors";

// --- Types tailored for the Grid ---
type GradingData = {
    semester: any;
    pillars: any[];
    users: any[];
    grades: Record<string, Record<string, any>>;
    kpis: Record<string, number>;
};

interface GradingGridProps {
    initialData: GradingData;
    currentUserRole: string;
}

export default function GradingGrid({ initialData, currentUserRole }: GradingGridProps) {
    const { pillars, users, grades: initialGrades, kpis: initialKpis } = initialData;
    const [grades, setGrades] = useState(initialGrades);
    const [kpis, setKpis] = useState(initialKpis);
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    // Sort logic: CD at end
    const sortedPillars = [...pillars].sort((a, b) => {
        if (a.isDirectorOnly) return 1;
        if (b.isDirectorOnly) return -1;
        return 0; // Keep others as is
    });

    const handleSave = async (userId: string, pillarId: string, value: string, maxScore: number): Promise<boolean> => {
        const key = `${userId}-${pillarId}`;

        // 1. Validation Clean-up
        let numValue = parseFloat(value);
        if (isNaN(numValue)) numValue = 0;

        // 2. Max Check (Visual feedback handled in Input styling too)
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
                // Update local grade state to confirm persistence (maybe updated timestamp etc)
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

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 request-list-card overflow-hidden overflow-x-auto relative">
            <table className="w-full text-sm text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase text-xs tracking-wider">
                        <th className="px-6 py-5 md:sticky md:left-0 bg-gray-50 z-10 md:z-20 min-w-[200px] md:min-w-[250px] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-left whitespace-nowrap">Miembro</th>
                        <th className="px-6 py-5 min-w-[150px] text-left whitespace-nowrap">Rol / Área</th>
                        {sortedPillars.map(p => (
                            <th key={p.id} className="px-4 py-5 text-center min-w-[140px]">
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-gray-900 line-clamp-1">{p.name}</span>
                                    <span className="text-[9px] bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500 font-bold shadow-sm whitespace-nowrap">
                                        Max: {p.maxScore}
                                    </span>
                                </div>
                            </th>
                        ))}
                        <th className="px-6 py-5 text-center md:sticky md:right-0 bg-gray-50 z-10 md:z-20 md:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">KPI Final</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={sortedPillars.length + 3} className="px-6 py-12 text-center text-gray-400">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Info className="w-8 h-8 text-gray-300" />
                                    <p>No se encontraron miembros asignados a tu área para calificar.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                {/* User Info */}
                                <td className="px-6 py-4 font-bold text-gray-900 md:sticky md:left-0 bg-white group-hover:bg-gray-50/50 z-0 md:z-10 border-r border-transparent md:border-gray-50 group-hover:border-gray-100 transition-colors md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-3 min-w-max">
                                        {user.image ? (
                                            <img src={user.image} alt={user.name} className="w-9 h-9 rounded-full border border-gray-100 shadow-sm flex-shrink-0" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-meteorite-100 to-meteorite-200 text-meteorite-700 flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm flex-shrink-0">
                                                {user.name?.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-gray-900 group-hover:text-meteorite-800 transition-colors whitespace-nowrap">{user.name}</span>
                                            <span className="text-[10px] text-gray-400 font-normal truncate max-w-[150px]">{user.email}</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1.5 align-top min-w-max">
                                        <span className="text-xs font-bold text-gray-700">{user.role}</span>
                                        <span className="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md w-fit font-medium">
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
                                    const isTargetDirector = ["DIRECTOR", "PRESIDENT", "TREASURER"].includes(user.role);
                                    const isDisabled = pillar.isDirectorOnly && !isTargetDirector;

                                    return (
                                        <td key={pillar.id} className="px-4 py-3 text-center align-middle">
                                            <div className="relative group/input flex justify-center">
                                                {!isDisabled ? (
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
                                                                    // Revert if handleSave returned false (validation error or server error)
                                                                    e.target.value = typeof currentScore === 'number' ? currentScore.toFixed(3) : "";
                                                                }
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') e.currentTarget.blur();
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-24 h-10 flex items-center justify-center mx-auto bg-gray-50 border border-transparent rounded-md text-gray-300 text-xs font-medium cursor-not-allowed select-none">
                                                        -
                                                    </div>
                                                )}

                                                {/* Indicators */}
                                                <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                                                    {isSaving && <Loader2 className="w-3 h-3 text-meteorite-500 animate-spin" />}
                                                    {!isSaving && currentScore !== "" && !isDisabled && (
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover/input:opacity-100 transition-opacity" />
                                                    )}
                                                </div>
                                            </div>
                                            {isDisabled && (
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
    );
}
