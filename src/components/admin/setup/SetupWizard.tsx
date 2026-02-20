"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSemesterAction, toggleSemesterStatusAction } from "@/server/actions/semester.actions";
import {
    activateAllAreasInSemesterAction,
    toggleAreaInSemesterAction,
} from "@/server/actions/area.actions";
import { updateUserRoleAction } from "@/server/actions/user.actions";
import {
    CalendarDays, MapPin, Crown, BookOpen, Rocket,
    ChevronRight, ChevronLeft, Check, Loader2,
    CheckCircle2, XCircle, ToggleLeft, ToggleRight, Zap
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Area {
    id: string;
    name: string;
    code: string | null;
}

interface AreaWithStatus extends Area {
    isActiveInSemester: boolean;
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

interface Props {
    existingSemesters: Array<{ id: string; name: string; isActive: boolean | null }>;
    areas: Area[];
    areasWithLeaders: AreaWithLeaders[];
    eligibleUsers: EligibleUser[];
}

// ─── Steps Config ────────────────────────────────────────────────────────────

const STEPS = [
    { key: "cycle", label: "Ciclo", icon: CalendarDays, description: "Crear o seleccionar ciclo" },
    { key: "areas", label: "Áreas", icon: MapPin, description: "Activar áreas del ciclo" },
    { key: "directors", label: "Directores", icon: Crown, description: "Asignar liderazgo" },
    { key: "pillars", label: "Pilares", icon: BookOpen, description: "Configurar rúbrica" },
    { key: "activate", label: "Activar", icon: Rocket, description: "Activar el ciclo" },
] as const;

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SetupWizard({ existingSemesters, areas, areasWithLeaders, eligibleUsers }: Props) {
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

    // Derived
    const activeCycleId = createdCycleId || selectedCycleId;

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const goNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    // ── Step 1: Create Cycle ──
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
                // We need the ID — fetch semesters again or parse from response
                // The action doesn't return ID, so we'll navigate to refresh
                router.refresh();
                // Move to next step after a short delay
                setTimeout(() => goNext(), 500);
            } else {
                showFeedback("error", res.error || "Error al crear ciclo.");
            }
        });
    };

    // ── Step 2: Toggle Area ──
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

    // ── Step 3: Assign Director ──
    const [assigningSlot, setAssigningSlot] = useState<{ areaId: string; role: "DIRECTOR" | "SUBDIRECTOR" } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

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

    // ── Step 5: Activate Cycle ──
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

    // Filter users for assignment
    const filteredUsers = eligibleUsers.filter(u => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    });

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="max-w-4xl mx-auto">
            {/* Feedback */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 ${feedback.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Stepper */}
            <div className="flex items-center justify-between mb-8 bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-meteorite-100 shadow-sm">
                {STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i === currentStep;
                    const isDone = i < currentStep;
                    return (
                        <button
                            key={step.key}
                            onClick={() => setCurrentStep(i)}
                            className={`flex flex-col items-center gap-1.5 flex-1 py-2 rounded-xl transition-all ${isActive
                                    ? "bg-meteorite-100 text-meteorite-700"
                                    : isDone
                                        ? "text-emerald-600"
                                        : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isActive
                                    ? "bg-meteorite-600 text-white shadow-lg shadow-meteorite-600/30"
                                    : isDone
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-gray-100 text-gray-400"
                                }`}>
                                {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <span className="text-xs font-bold hidden sm:block">{step.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="bg-white/80 backdrop-blur-md border border-meteorite-200/50 rounded-2xl p-6 shadow-xl min-h-[400px]">
                {/* ── STEP 1: CYCLE ── */}
                {currentStep === 0 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-meteorite-950 mb-1">Crear o Seleccionar Ciclo</h3>
                            <p className="text-sm text-meteorite-500">Define el ciclo académico que quieres configurar.</p>
                        </div>

                        {/* Existing semesters */}
                        {existingSemesters.filter(s => !s.isActive).length > 0 && (
                            <div>
                                <p className="text-sm font-bold text-meteorite-700 mb-2">Ciclos existentes (inactivos):</p>
                                <div className="flex flex-wrap gap-2">
                                    {existingSemesters.filter(s => !s.isActive).map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setSelectedCycleId(s.id); setCreatedCycleId(null); }}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${selectedCycleId === s.id
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
                                    <input
                                        type="text"
                                        value={cycleName}
                                        onChange={e => setCycleName(e.target.value)}
                                        placeholder="Ej: 2026-1"
                                        className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none bg-white text-meteorite-950 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-meteorite-700 mb-1">Inicio *</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none bg-white text-meteorite-950 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-meteorite-700 mb-1">Fin (Opcional)</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none bg-white text-meteorite-950 font-medium"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleCreateCycle}
                                disabled={isPending || !cycleName.trim() || !startDate}
                                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                                Crear Ciclo
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: AREAS ── */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-meteorite-950 mb-1">Activar Áreas</h3>
                                <p className="text-sm text-meteorite-500">Selecciona qué áreas participan en este ciclo.</p>
                            </div>
                            {activeCycleId && (
                                <button
                                    onClick={handleActivateAllAreas}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                                >
                                    <Zap className="w-4 h-4" />
                                    Activar Todas
                                </button>
                            )}
                        </div>

                        {!activeCycleId ? (
                            <div className="p-8 text-center text-gray-400">
                                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-bold">Selecciona o crea un ciclo primero</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {areas.map(area => {
                                    // We don't have live status here, but the toggle action will revalidate
                                    return (
                                        <div key={area.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-meteorite-100 flex items-center justify-center text-xs font-black text-meteorite-700">
                                                    {area.code || area.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-sm text-meteorite-950">{area.name}</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => handleToggleArea(area.id, true)}
                                                    disabled={isPending}
                                                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all disabled:opacity-50"
                                                >
                                                    <ToggleRight className="w-3.5 h-3.5 inline mr-1" />
                                                    On
                                                </button>
                                                <button
                                                    onClick={() => handleToggleArea(area.id, false)}
                                                    disabled={isPending}
                                                    className="px-2.5 py-1 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                                                >
                                                    <ToggleLeft className="w-3.5 h-3.5 inline mr-1" />
                                                    Off
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 3: DIRECTORS ── */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-meteorite-950 mb-1">Asignar Directores</h3>
                            <p className="text-sm text-meteorite-500">Configura el liderazgo de cada área.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {areasWithLeaders.map(area => (
                                <div key={area.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                        <div className="w-8 h-8 rounded-lg bg-meteorite-100 flex items-center justify-center text-xs font-black text-meteorite-700">
                                            {area.code || area.name.substring(0, 2).toUpperCase()}
                                        </div>
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
                                            <button onClick={() => setAssigningSlot(null)} className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                                Cancelar
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setAssigningSlot({ areaId: area.id, role: "DIRECTOR" }); setSearchTerm(""); }}
                                                disabled={isPending}
                                                className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                                            >
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
                                            <button onClick={() => setAssigningSlot(null)} className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                                Cancelar
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setAssigningSlot({ areaId: area.id, role: "SUBDIRECTOR" }); setSearchTerm(""); }}
                                                disabled={isPending}
                                                className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                                            >
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

                {/* ── STEP 4: PILLARS ── */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-meteorite-950 mb-1">Configurar Pilares</h3>
                            <p className="text-sm text-meteorite-500">Configura la rúbrica de evaluación para este ciclo.</p>
                        </div>

                        {activeCycleId ? (
                            <div className="bg-meteorite-50 border border-meteorite-200 rounded-2xl p-6 text-center">
                                <BookOpen className="w-12 h-12 text-meteorite-400 mx-auto mb-3" />
                                <p className="text-meteorite-700 font-bold mb-4">
                                    Los pilares se configuran desde el gestor dedicado.
                                </p>
                                <a
                                    href={`/admin/cycles/${activeCycleId}/pillars`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    Abrir Gestor de Pilares
                                </a>
                                <p className="text-xs text-meteorite-400 mt-3">
                                    Se abrirá en otra pestaña. Cuando termines, regresa aquí y continúa.
                                </p>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-bold">Selecciona o crea un ciclo primero</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 5: ACTIVATE ── */}
                {currentStep === 4 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-meteorite-950 mb-1">Activar Ciclo</h3>
                            <p className="text-sm text-meteorite-500">¿Todo listo? Activa el ciclo para que los miembros puedan operar.</p>
                        </div>

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
                                <button
                                    onClick={handleActivateCycle}
                                    disabled={isPending}
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-50"
                                >
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
                <button
                    onClick={goBack}
                    disabled={currentStep === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-meteorite-200 text-meteorite-700 font-bold rounded-xl hover:bg-meteorite-50 transition-all disabled:opacity-30"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                </button>

                {currentStep < STEPS.length - 1 && (
                    <button
                        onClick={goNext}
                        className="flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all"
                    >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── User Dropdown Sub-component ─────────────────────────────────────────────

function UserDropdown({
    users, searchTerm, onSearch, onSelect, isPending,
}: {
    users: EligibleUser[];
    searchTerm: string;
    onSearch: (term: string) => void;
    onSelect: (userId: string) => void;
    isPending: boolean;
}) {
    return (
        <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => onSearch(e.target.value)}
                    placeholder="Buscar..."
                    autoFocus
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-meteorite-400 outline-none"
                />
            </div>
            <div className="max-h-36 overflow-y-auto">
                {users.slice(0, 15).map(u => (
                    <button
                        key={u.id}
                        onClick={() => onSelect(u.id)}
                        disabled={isPending}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-meteorite-50 text-left text-sm disabled:opacity-50"
                    >
                        <span className="font-medium text-gray-900 truncate flex-1">{u.name || u.email}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{u.role}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
