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

    // Pillars Ordering: 
    // We want RG, Staff, Proyectos, Area, CD
    // Usually specific order is best. Let's try to sort by standard names if possible or trust DB order.
    // For now, trusting DB order but "CD" usually lasts.

    // Sort logic: CD at end
    const sortedPillars = [...pillars].sort((a, b) => {
        if (a.isDirectorOnly) return 1;
        if (b.isDirectorOnly) return -1;
        return 0; // Keep others as is
    });

    const handleSave = async (userId: string, pillarId: string, value: string, maxScore: number) => {
        const key = `${userId}-${pillarId}`;

        // 1. Validation Clean-up
        let numValue = parseFloat(value);
        if (isNaN(numValue)) numValue = 0;

        // 2. Max Check (Visual feedback handled in Input styling too)
        if (numValue > maxScore) {
            toast.error(`La nota máxima para este pilar es ${maxScore}`);
            return;
        }
        if (numValue < 0) {
            toast.error("La nota no puede ser negativa");
            return;
        }

        // 3. Optimistic Update (Optional, but here we just update state after success/fail or immediately?)
        // Let's update state immediately for UI response
        // But we already input typed it.

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
                // Silent success or small indicator?
                // toast.success("Nota guardada");
            } else {
                toast.error(res.error);
                // Revert? Hard to revert input blur. 
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase text-xs tracking-wider">
                    <tr>
                        <th className="px-6 py-5 sticky left-0 bg-gray-50 z-10 min-w-[200px]">Miembro</th>
                        <th className="px-6 py-5 min-w-[150px]">Rol / Área</th>
                        {sortedPillars.map(p => (
                            <th key={p.id} className="px-4 py-5 text-center min-w-[120px]">
                                <div className="flex flex-col items-center gap-1">
                                    <span>{p.name}</span>
                                    <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                                        Max: {p.maxScore}
                                    </span>
                                </div>
                            </th>
                        ))}
                        <th className="px-6 py-5 text-center sticky right-0 bg-gray-50 z-10">KPI Final</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {users.length === 0 ? (
                        <tr>
                            <td colSpan={sortedPillars.length + 3} className="px-6 py-12 text-center text-gray-400">
                                No se encontraron miembros asignados a tu área.
                            </td>
                        </tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                {/* User Info */}
                                <td className="px-6 py-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-transparent group-hover:border-gray-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {user.image ? (
                                            <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full border border-gray-100" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-meteorite-100 text-meteorite-600 flex items-center justify-center font-bold text-xs">
                                                {user.name?.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span>{user.name}</span>
                                            <span className="text-[10px] text-gray-400 font-normal">{user.email}</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold text-gray-600">{user.role}</span>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md w-fit">
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

                                    // Director Only Logic Check
                                    // If pillar is director only, and target user is NOT Member/Sub (wait, usually CD evaluates everyone)
                                    // Logic: CD pillar is for EVERYONE, but only Director can WRITE to it.
                                    // But here the Viewer IS the Director. So they can write.
                                    // EXCEPTION: A member cannot receive a CD grade? 
                                    // Per implementation plan: "If Member: CD = 0%".
                                    // So we SHOULD allow inputting it, but it won't count.
                                    // OR we disable it to avoid confusion? 
                                    // "Is targetUser allowed to receive this grade? (e.g. Block CD for Members)"

                                    const isTargetDirector = ["DIRECTOR", "PRESIDENT", "TREASURER"].includes(user.role);
                                    const isDisabled = pillar.isDirectorOnly && !isTargetDirector;

                                    return (
                                        <td key={pillar.id} className="px-4 py-3 text-center">
                                            <div className="relative group/input flex justify-center">
                                                <Input
                                                    type="number"
                                                    disabled={isDisabled}
                                                    placeholder={isDisabled ? "-" : "0.000"}
                                                    defaultValue={currentScore}
                                                    step="0.001"
                                                    min={0}
                                                    max={pillar.maxScore}
                                                    className={cn(
                                                        "w-24 text-center font-semibold transition-all", // Increased width for 3 decimals
                                                        isDisabled && "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed",
                                                        !isDisabled && "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500",
                                                        "[&::-webkit-inner-spin-button]:appearance-none"
                                                    )}
                                                    onBlur={(e) => {
                                                        let val = e.target.value;
                                                        const numVal = parseFloat(val);

                                                        // Auto-format to 3 decimals if valid
                                                        if (!isNaN(numVal)) {
                                                            const formatted = numVal.toFixed(3);
                                                            if (val !== formatted) {
                                                                e.target.value = formatted;
                                                                val = formatted;
                                                            }
                                                        }

                                                        // Save if changed (compare numeric values to avoid string diffs like "5" vs "5.000")
                                                        // Actually, we want to save the precise value. 
                                                        // But currentScore might be just number 5.
                                                        if (val !== "" && numVal !== parseFloat(String(currentScore || 0))) {
                                                            handleSave(user.id, pillar.id, val, pillar.maxScore);
                                                        } else if (val === "" && currentScore !== "") {
                                                            // Handle clearing if needed, or ignore
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                />
                                                {/* Indicators */}
                                                <div className="absolute -right-3 top-1/2 -translate-y-1/2">
                                                    {isSaving && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />}
                                                    {!isSaving && currentScore !== "" && !isDisabled && (
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover/input:opacity-100 transition-opacity" />
                                                    )}
                                                </div>
                                            </div>
                                            {isDisabled && (
                                                <div className="text-[9px] text-gray-300 mt-1">No aplica</div>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* KPI Final Result (Placeholder until we fetch it properly) */}
                                <td className="px-6 py-4 text-center sticky right-0 bg-white group-hover:bg-gray-50/50 border-l border-transparent group-hover:border-gray-100 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)]">
                                    {(() => {
                                        const score = kpis[user.id] || 0;
                                        const status = getKpiStatus(score);
                                        return (
                                            <div className={cn(
                                                "font-black text-sm px-3 py-1.5 rounded-lg border flex flex-col items-center gap-0.5",
                                                status.color
                                            )}>
                                                <span>{score.toFixed(2)}</span>
                                                <span className="text-[9px] font-medium uppercase tracking-wider opacity-80">
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
