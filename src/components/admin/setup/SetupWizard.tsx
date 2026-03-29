"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSemesterAction, toggleSemesterStatusAction } from "@/server/actions/semester.actions";
import {
    activateAllAreasInSemesterAction,
    toggleAreaInSemesterAction,
    updateAreaAction,
} from "@/server/actions/area.actions";
import { updateUserRoleAction } from "@/server/actions/user.actions";
import {
    CalendarDays, MapPin, Crown, BookOpen, Rocket,
    ChevronRight, ChevronLeft, Check, Loader2,
    CheckCircle2, XCircle, ToggleLeft, ToggleRight, Zap,
    LayoutGrid, Shield, SkipForward, AlertTriangle, Info
} from "lucide-react";
import { PillarsManager } from "@/components/admin/PillarsManager";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Area {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    description: string | null;
    isLeadershipArea: boolean | null;
    permissions?: { id: string; areaId: string; permission: string }[];
}

interface Leader {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    currentAreaId: string | null;
}

interface AreaWithLeaders extends Area {
    director: Leader | null;
    subdirector: Leader | null;
}

interface EligibleUser {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
}

type Pillar = {
    id: string;
    semesterId: string;
    name: string;
    weight: number;
    directorWeight: number | null;
    maxScore: number;
    isDirectorOnly: boolean;
};

interface ProjectArea {
    id: string;
    name: string;
    color: string | null;
    position: number | null;
    isSystem: boolean | null;
}

interface ProjectRole {
    id: string;
    name: string;
    description: string | null;
    hierarchyLevel: number;
    color: string | null;
    isSystem: boolean | null;
    permissions?: { permission: string }[];
}

interface Props {
    existingSemesters: Array<{ id: string; name: string; isActive: boolean | null }>;
    areas: Area[];
    areasWithLeaders: AreaWithLeaders[];
    eligibleUsers: EligibleUser[];
    initialPillars: Pillar[];
    otherSemesters: { id: string; name: string }[];
    initialProjectAreas: ProjectArea[];
    initialProjectRoles: ProjectRole[];
}

// ─── Steps Config ────────────────────────────────────────────────────────────

const STEPS = [
    { key: "cycle", label: "Ciclo", icon: CalendarDays, mandatory: true },
    { key: "areas", label: "Áreas IISE", icon: MapPin, mandatory: true },
    { key: "capabilities", label: "Capacidades", icon: Zap, skippable: true },
    { key: "directors", label: "Directores", icon: Crown, skippable: true },
    { key: "pillars", label: "Pilares", icon: BookOpen, recommended: true },
    { key: "projectAreas", label: "Áreas Proy.", icon: LayoutGrid, skippable: true },
    { key: "projectRoles", label: "Roles Proy.", icon: Shield, skippable: true },
    { key: "activate", label: "Activar", icon: Rocket, mandatory: true },
] as const;

// ─── Capability metadata ─────────────────────────────────────────────────────

const CAPABILITY_INFO = {
    isLeadershipArea: {
        label: "Mesa Directiva",
        description: "Los miembros de esta área forman parte de la dirección ejecutiva de IISE.",
        accent: "amber" as const,
    },
} as const;

const ACCENT_CLASSES = {
    amber: { on: "bg-amber-500", ring: "bg-amber-50 border-amber-200" },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SetupWizard({
    existingSemesters, areas, areasWithLeaders, eligibleUsers,
    initialPillars, otherSemesters, initialProjectAreas, initialProjectRoles,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [currentStep, setCurrentStep] = useState(0);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Cycle step state
    const [cycleName, setCycleName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
    const [createdCycleId, setCreatedCycleId] = useState<string | null>(null);

    // Director assignment state
    const [assigningSlot, setAssigningSlot] = useState<{ areaId: string; role: "DIRECTOR" | "SUBDIRECTOR" } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const activeCycleId = createdCycleId || selectedCycleId;

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const goNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    // ── Step 1: Create Cycle ──────────────────────────────────────────────────
    const handleCreateCycle = () => {
        if (!cycleName.trim() || !startDate) {
            showFeedback("error", "Nombre y fecha de inicio son obligatorios.");
            return;
        }
        startTransition(async () => {
            const res = await createSemesterAction({
                name: cycleName,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : undefined,
                activateImmediately: false,
            });
            if (res.success) {
                showFeedback("success", res.message || "Ciclo creado.");
                router.refresh();
                setTimeout(() => goNext(), 500);
            } else {
                showFeedback("error", res.error || "Error al crear ciclo.");
            }
        });
    };

    // ── Step 2: Toggle Area ───────────────────────────────────────────────────
    const handleToggleArea = (areaId: string, activate: boolean) => {
        if (!activeCycleId) return;
        startTransition(async () => {
            const res = await toggleAreaInSemesterAction(areaId, activeCycleId, activate);
            if (res.success) {
                showFeedback("success", res.message || "Actualizado.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error.");
            }
        });
    };

    const handleActivateAllAreas = () => {
        if (!activeCycleId) return;
        startTransition(async () => {
            const res = await activateAllAreasInSemesterAction(activeCycleId);
            if (res.success) {
                showFeedback("success", res.message || "Todas activadas.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error.");
            }
        });
    };

    // ── Step 3: Toggle Capability ─────────────────────────────────────────────
    const handleToggleCapability = (area: Area, field: keyof typeof CAPABILITY_INFO, newValue: boolean) => {
        startTransition(async () => {
            const res = await updateAreaAction({
                id: area.id,
                name: area.name,
                code: area.code,
                description: area.description,
                color: area.color || "#6366f1",
                isLeadershipArea: field === "isLeadershipArea" ? newValue : (area.isLeadershipArea ?? false),
                permissions: (area.permissions ?? []).map(p => p.permission),
            });
            if (res.success) {
                showFeedback("success", "Capacidad actualizada.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error al actualizar.");
            }
        });
    };

    // ── Step 4: Assign Director ───────────────────────────────────────────────
    const handleAssignLeader = (userId: string, areaId: string, role: "DIRECTOR" | "SUBDIRECTOR") => {
        startTransition(async () => {
            const res = await updateUserRoleAction({
                userId,
                role,
                areaId,
                reason: `Asignado como ${role} desde wizard pre-ciclo`,
            });
            if (res.success) {
                showFeedback("success", `${role} asignado.`);
                setAssigningSlot(null);
                setSearchTerm("");
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error.");
            }
        });
    };

    // ── Step 8: Activate Cycle ────────────────────────────────────────────────
    const handleActivateCycle = () => {
        if (!activeCycleId) {
            showFeedback("error", "No hay ciclo seleccionado.");
            return;
        }
        startTransition(async () => {
            const res = await toggleSemesterStatusAction(activeCycleId, true);
            if (res.success) {
                showFeedback("success", "🎉 ¡Ciclo activado exitosamente!");
                setTimeout(() => router.push("/dashboard"), 1500);
            } else {
                showFeedback("error", res.error || "Error al activar.");
            }
        });
    };

    // Filtered users for director assignment
    const filteredUsers = eligibleUsers.filter(u => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    });

    // Validation checklist for step 8
    const directorsAssigned = areasWithLeaders.filter(a => a.director !== null).length;
    const validationChecks = [
        { label: "Ciclo creado/seleccionado", ok: !!activeCycleId },
        { label: "Áreas activadas", ok: areas.length > 0, info: `${areas.length} áreas disponibles` },
        { label: "Directores asignados", ok: directorsAssigned > 0, info: `${directorsAssigned} de ${areasWithLeaders.length}`, warn: directorsAssigned === 0 },
        { label: "Pilares configurados", ok: initialPillars.length > 0, info: `${initialPillars.length} pilares`, warn: initialPillars.length === 0 },
        { label: "Áreas de proyecto", ok: true, info: `${initialProjectAreas.length} configuradas` },
        { label: "Roles de proyecto", ok: true, info: `${initialProjectRoles.length} configurados` },
    ];

    // Step metadata
    const step = STEPS[currentStep];
    const canSkip = 'skippable' in step || 'recommended' in step;

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="max-w-4xl mx-auto">
            {/* Feedback Toast */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 ${
                    feedback.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Stepper */}
            <div className="flex items-center justify-between mb-8 bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-meteorite-100 shadow-sm overflow-x-auto">
                {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = i === currentStep;
                    const isDone = i < currentStep;
                    return (
                        <button
                            key={s.key}
                            onClick={() => setCurrentStep(i)}
                            className={`flex flex-col items-center gap-1 flex-1 min-w-[56px] py-2 rounded-xl transition-all ${
                                isActive
                                    ? "bg-meteorite-100 text-meteorite-700"
                                    : isDone
                                        ? "text-emerald-600"
                                        : "text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                isActive
                                    ? "bg-meteorite-600 text-white shadow-lg shadow-meteorite-600/30"
                                    : isDone
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-gray-100 text-gray-400"
                            }`}>
                                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                            </div>
                            <span className="text-[10px] font-bold hidden sm:block leading-tight text-center">{s.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="bg-white/80 backdrop-blur-md border border-meteorite-200/50 rounded-2xl p-6 shadow-xl min-h-[400px]">

                {/* ── STEP 1: CYCLE ───────────────────────────────────────── */}
                {currentStep === 0 && (
                    <div className="space-y-6">
                        <StepHeader title="Crear o Seleccionar Ciclo" subtitle="Define el ciclo académico que quieres configurar." />

                        {existingSemesters.filter(s => !s.isActive).length > 0 && (
                            <div>
                                <p className="text-sm font-bold text-meteorite-700 mb-2">Ciclos existentes (inactivos):</p>
                                <div className="flex flex-wrap gap-2">
                                    {existingSemesters.filter(s => !s.isActive).map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setSelectedCycleId(s.id); setCreatedCycleId(null); }}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                                selectedCycleId === s.id
                                                    ? "bg-meteorite-600 text-white border-meteorite-600"
                                                    : "bg-white text-meteorite-700 border-meteorite-200 hover:border-meteorite-400"
                                            }`}
                                        >
                                            {s.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="border-t border-gray-100 pt-4">
                            <p className="text-sm font-bold text-meteorite-700 mb-3">O crear uno nuevo:</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-meteorite-700 mb-1">Nombre *</label>
                                    <input type="text" value={cycleName} onChange={e => setCycleName(e.target.value)}
                                        placeholder="Ej: 2026-1"
                                        className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none bg-white text-meteorite-950 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-meteorite-700 mb-1">Inicio *</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none bg-white text-meteorite-950 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-meteorite-700 mb-1">Fin (Opcional)</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none bg-white text-meteorite-950 font-medium" />
                                </div>
                            </div>
                            <button onClick={handleCreateCycle} disabled={isPending || !cycleName.trim() || !startDate}
                                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                                Crear Ciclo
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: AREAS IISE ──────────────────────────────────── */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <StepHeader title="Activar Áreas IISE" subtitle="Selecciona qué áreas participan en este ciclo." />
                            {activeCycleId && (
                                <button onClick={handleActivateAllAreas} disabled={isPending}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                                    <Zap className="w-4 h-4" /> Activar Todas
                                </button>
                            )}
                        </div>

                        {!activeCycleId ? <NoCycleNotice /> : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {areas.map(area => (
                                    <div key={area.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <AreaBadge area={area} />
                                            <span className="font-bold text-sm text-meteorite-950">{area.name}</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => handleToggleArea(area.id, true)} disabled={isPending}
                                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all disabled:opacity-50">
                                                <ToggleRight className="w-3.5 h-3.5 inline mr-1" /> On
                                            </button>
                                            <button onClick={() => handleToggleArea(area.id, false)} disabled={isPending}
                                                className="px-2.5 py-1 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50">
                                                <ToggleLeft className="w-3.5 h-3.5 inline mr-1" /> Off
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 3: CAPABILITIES ────────────────────────────────── */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <StepHeader title="Capacidades de Áreas" subtitle="Configura qué puede hacer cada área. Los cambios se guardan automáticamente." />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {areas.map(area => (
                                <div key={area.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                        <AreaBadge area={area} />
                                        <h4 className="font-bold text-meteorite-950 text-sm">{area.name}</h4>
                                    </div>

                                    {(Object.keys(CAPABILITY_INFO) as Array<keyof typeof CAPABILITY_INFO>).map(field => {
                                        const info = CAPABILITY_INFO[field];
                                        const isOn = area[field] ?? false;
                                        const cls = ACCENT_CLASSES[info.accent];
                                        return (
                                            <div
                                                key={field}
                                                onClick={() => !isPending && handleToggleCapability(area, field, !isOn)}
                                                className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                                    isOn ? cls.ring : "bg-white border-transparent hover:bg-gray-50"
                                                } ${isPending ? "opacity-60 pointer-events-none" : ""}`}
                                            >
                                                {/* Custom toggle */}
                                                <div className="mt-0.5 flex-shrink-0">
                                                    <div
                                                        className={`rounded-full relative transition-colors ${isOn ? cls.on : "bg-gray-200"}`}
                                                        style={{ width: 40, height: 22 }}
                                                    >
                                                        <div
                                                            className="absolute bg-white rounded-full shadow transition-transform"
                                                            style={{ width: 18, height: 18, top: 2, left: isOn ? 19 : 3 }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-bold text-meteorite-900 block">{info.label}</span>
                                                    <span className="text-xs text-meteorite-500 leading-tight block">{info.description}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Permission Reference */}
                        <details className="bg-meteorite-50/50 border border-meteorite-100 rounded-2xl">
                            <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-meteorite-700 flex items-center gap-2">
                                <Info className="w-4 h-4" /> Referencia: ¿Qué permisos tiene cada rol?
                            </summary>
                            <div className="px-4 pb-4 overflow-x-auto">
                                <table className="w-full text-xs mt-2">
                                    <thead>
                                        <tr className="border-b border-meteorite-200">
                                            <th className="text-left py-1.5 font-bold text-meteorite-700">Rol</th>
                                            <th className="text-center py-1.5 font-bold text-meteorite-700">Ver eventos</th>
                                            <th className="text-center py-1.5 font-bold text-meteorite-700">Crear eventos</th>
                                            <th className="text-center py-1.5 font-bold text-meteorite-700">Gestionar ciclo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-meteorite-600">
                                        {[
                                            { role: "President / Dev", view: "✅", create: "✅", manage: "✅" },
                                            { role: "VP", view: "✅", create: "✅", manage: "❌" },
                                            { role: "Director", view: "✅", create: "⚡", manage: "❌" },
                                            { role: "Subdirector", view: "✅", create: "❌", manage: "❌" },
                                            { role: "Miembro", view: "✅", create: "❌", manage: "❌" },
                                        ].map(r => (
                                            <tr key={r.role} className="border-b border-meteorite-100/50">
                                                <td className="py-1.5 font-medium">{r.role}</td>
                                                <td className="text-center">{r.view}</td>
                                                <td className="text-center">{r.create}</td>
                                                <td className="text-center">{r.manage}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-[10px] text-meteorite-400 mt-2">
                                    ⚡ = Depende de la capacidad &quot;Crear eventos&quot; activada en el área.
                                </p>
                            </div>
                        </details>
                    </div>
                )}

                {/* ── STEP 4: DIRECTORS ───────────────────────────────────── */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        <StepHeader title="Asignar Directores" subtitle="Configura el liderazgo de cada área." />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {areasWithLeaders.map(area => (
                                <div key={area.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                        <AreaBadge area={area} />
                                        <h4 className="font-bold text-meteorite-950 text-sm">{area.name}</h4>
                                    </div>

                                    {/* Director */}
                                    <div className="flex items-center justify-between p-2.5 mb-2 rounded-xl bg-amber-50/50 border border-amber-200/50">
                                        <div className="flex items-center gap-2">
                                            <Crown className="w-4 h-4 text-amber-600" />
                                            {area.director ? (
                                                <span className="text-sm font-medium text-gray-900">{area.director.name || area.director.email}</span>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Sin director</span>
                                            )}
                                        </div>
                                        {assigningSlot?.areaId === area.id && assigningSlot.role === "DIRECTOR" ? (
                                            <button onClick={() => setAssigningSlot(null)}
                                                className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                                Cancelar
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setAssigningSlot({ areaId: area.id, role: "DIRECTOR" }); setSearchTerm(""); }}
                                                disabled={isPending}
                                                className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg disabled:opacity-50">
                                                {area.director ? "Cambiar" : "Asignar"}
                                            </button>
                                        )}
                                    </div>
                                    {assigningSlot?.areaId === area.id && assigningSlot.role === "DIRECTOR" && (
                                        <UserDropdown users={filteredUsers} searchTerm={searchTerm} onSearch={setSearchTerm}
                                            onSelect={(uid) => handleAssignLeader(uid, area.id, "DIRECTOR")} isPending={isPending} />
                                    )}

                                    {/* Subdirector */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 border border-blue-200/50">
                                        <div className="flex items-center gap-2">
                                            <Crown className="w-4 h-4 text-blue-600" />
                                            {area.subdirector ? (
                                                <span className="text-sm font-medium text-gray-900">{area.subdirector.name || area.subdirector.email}</span>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Sin subdirector</span>
                                            )}
                                        </div>
                                        {assigningSlot?.areaId === area.id && assigningSlot.role === "SUBDIRECTOR" ? (
                                            <button onClick={() => setAssigningSlot(null)}
                                                className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                                Cancelar
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setAssigningSlot({ areaId: area.id, role: "SUBDIRECTOR" }); setSearchTerm(""); }}
                                                disabled={isPending}
                                                className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg disabled:opacity-50">
                                                {area.subdirector ? "Cambiar" : "Asignar"}
                                            </button>
                                        )}
                                    </div>
                                    {assigningSlot?.areaId === area.id && assigningSlot.role === "SUBDIRECTOR" && (
                                        <UserDropdown users={filteredUsers} searchTerm={searchTerm} onSearch={setSearchTerm}
                                            onSelect={(uid) => handleAssignLeader(uid, area.id, "SUBDIRECTOR")} isPending={isPending} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 5: PILLARS ────────────────────────────────────── */}
                {currentStep === 4 && (
                    <div className="space-y-6">
                        <StepHeader title="Configurar Pilares" subtitle="Define los pilares de evaluación (rúbrica) para este ciclo." />

                        {activeCycleId ? (
                            <PillarsManager
                                semesterId={activeCycleId}
                                initialPillars={initialPillars}
                                otherSemesters={otherSemesters}
                            />
                        ) : (
                            <NoCycleNotice />
                        )}
                    </div>
                )}

                {/* ── STEP 6: PROJECT AREAS ──────────────────────────────── */}
                {currentStep === 5 && (
                    <div className="space-y-6">
                        <StepHeader title="Áreas de Proyecto" subtitle="Las áreas de proyecto son globales y se usan en todos los proyectos." />

                        {initialProjectAreas.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {initialProjectAreas.map(pa => (
                                    <div key={pa.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                                            style={pa.color
                                                ? { backgroundColor: `${pa.color}25`, color: pa.color }
                                                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                                        >
                                            {pa.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-sm text-meteorite-950 block truncate">{pa.name}</span>
                                            {pa.isSystem && (
                                                <span className="text-[10px] text-violet-600 font-medium">Sistema</span>
                                            )}
                                        </div>
                                        {pa.isSystem && (
                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">SISTEMA</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-bold">No hay áreas de proyecto configuradas.</p>
                            </div>
                        )}

                        <div className="flex justify-center">
                            <Link href="/admin/project-settings" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all">
                                <LayoutGrid className="w-4 h-4" /> Gestionar Áreas de Proyecto
                            </Link>
                        </div>
                        <p className="text-xs text-center text-meteorite-400">Se abre en otra pestaña. Los cambios se reflejarán al volver.</p>
                    </div>
                )}

                {/* ── STEP 7: PROJECT ROLES ──────────────────────────────── */}
                {currentStep === 6 && (
                    <div className="space-y-6">
                        <StepHeader title="Roles de Proyecto" subtitle="Los roles definen la jerarquía dentro de cada proyecto." />

                        {initialProjectRoles.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {[...initialProjectRoles].sort((a, b) => b.hierarchyLevel - a.hierarchyLevel).map(pr => (
                                    <div key={pr.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                                            style={pr.color
                                                ? { backgroundColor: `${pr.color}25`, color: pr.color }
                                                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                                        >
                                            {pr.hierarchyLevel}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-sm text-meteorite-950 block truncate">{pr.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-meteorite-500">Nivel {pr.hierarchyLevel}</span>
                                                {(pr.permissions?.length ?? 0) > 0 && (
                                                    <span className="text-[10px] text-violet-600 font-medium">{pr.permissions!.length} permisos</span>
                                                )}
                                            </div>
                                        </div>
                                        {pr.isSystem && (
                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">SISTEMA</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-bold">No hay roles de proyecto configurados.</p>
                            </div>
                        )}

                        <div className="flex justify-center">
                            <Link href="/admin/project-settings" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all">
                                <Shield className="w-4 h-4" /> Gestionar Roles de Proyecto
                            </Link>
                        </div>
                        <p className="text-xs text-center text-meteorite-400">Se abre en otra pestaña. Los cambios se reflejarán al volver.</p>
                    </div>
                )}

                {/* ── STEP 8: ACTIVATE ────────────────────────────────────── */}
                {currentStep === 7 && (
                    <div className="space-y-6">
                        <StepHeader title="Activar Ciclo" subtitle="Revisa la configuración y activa el ciclo cuando estés listo." />

                        {/* Validation Checklist */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2.5">
                            <h4 className="text-sm font-black text-meteorite-800 uppercase tracking-wider mb-2">
                                Checklist de Validación
                            </h4>
                            {validationChecks.map((check, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl ${
                                        check.ok
                                            ? check.warn
                                                ? "bg-amber-50/50"
                                                : "bg-emerald-50/50"
                                            : "bg-red-50/50"
                                    }`}
                                >
                                    {check.ok ? (
                                        check.warn
                                            ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                            : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-medium text-meteorite-800 flex-1">{check.label}</span>
                                    {check.info && (
                                        <span className="text-xs font-bold text-meteorite-400">{check.info}</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Activate Button */}
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-8 text-center">
                            <Rocket className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                            <h4 className="text-2xl font-black text-emerald-800 mb-2">¡Último paso!</h4>
                            <p className="text-emerald-700 mb-6 max-w-md mx-auto">
                                Al activar, este ciclo se volverá el <strong>ciclo activo</strong> del sistema.
                                Todos los demás ciclos se desactivarán automáticamente.
                            </p>

                            {!activeCycleId ? (
                                <p className="text-amber-600 font-bold">⚠️ No hay ciclo seleccionado. Regresa al paso 1.</p>
                            ) : (
                                <button onClick={handleActivateCycle} disabled={isPending}
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-50">
                                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                                    Activar Ciclo
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
                <button onClick={goBack} disabled={currentStep === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-meteorite-200 text-meteorite-700 font-bold rounded-xl hover:bg-meteorite-50 transition-all disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" /> Anterior
                </button>

                <div className="flex gap-2">
                    {canSkip && currentStep < STEPS.length - 1 && (
                        <button onClick={goNext}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-dashed border-meteorite-300 text-meteorite-500 font-bold rounded-xl hover:bg-meteorite-50 transition-all text-sm">
                            <SkipForward className="w-4 h-4" /> Omitir paso
                        </button>
                    )}
                    {currentStep < STEPS.length - 1 && (
                        <button onClick={goNext}
                            className="flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all">
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div>
            <h3 className="text-xl font-black text-meteorite-950 mb-1">{title}</h3>
            <p className="text-sm text-meteorite-500">{subtitle}</p>
        </div>
    );
}

function NoCycleNotice() {
    return (
        <div className="p-8 text-center text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-bold">Selecciona o crea un ciclo primero</p>
        </div>
    );
}

function AreaBadge({ area }: { area: { name: string; code: string | null; color: string | null } }) {
    return (
        <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
            style={area.color
                ? { backgroundColor: `${area.color}20`, color: area.color }
                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
        >
            {area.code || area.name.substring(0, 2).toUpperCase()}
        </div>
    );
}

function UserDropdown({
    users, searchTerm, onSearch, onSelect, isPending,
}: {
    users: Array<{ id: string; name: string | null; email: string; role: string | null }>;
    searchTerm: string;
    onSearch: (term: string) => void;
    onSelect: (userId: string) => void;
    isPending: boolean;
}) {
    return (
        <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
                <input type="text" value={searchTerm} onChange={e => onSearch(e.target.value)}
                    placeholder="Buscar..." autoFocus
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-meteorite-400 outline-none" />
            </div>
            <div className="max-h-36 overflow-y-auto">
                {users.slice(0, 15).map(u => (
                    <button key={u.id} onClick={() => onSelect(u.id)} disabled={isPending}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-meteorite-50 text-left text-sm disabled:opacity-50">
                        <span className="font-medium text-gray-900 truncate flex-1">{u.name || u.email}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{u.role}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
