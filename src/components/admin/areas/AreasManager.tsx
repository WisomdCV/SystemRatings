"use client";

import { useState, useTransition } from "react";
import {
    createAreaAction,
    updateAreaAction,
    deleteAreaAction,
    toggleAreaInSemesterAction,
    activateAllAreasInSemesterAction,
} from "@/server/actions/area.actions";
import {
    Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
    CheckCircle2, XCircle, Loader2, MapPin, Zap, Crown
} from "lucide-react";
import { AREA_COLOR_PRESETS } from "@/lib/utils/area-colors";

interface Area {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    color: string | null;
    isLeadershipArea: boolean | null;
    canCreateEvents: boolean | null;
    canCreateIndividualEvents: boolean | null;
}

interface AreaWithStatus extends Area {
    isActiveInSemester: boolean;
    semesterAreaId: string | null;
}

interface Props {
    initialAreas: Area[];
    semesterStatus: AreaWithStatus[];
    activeSemester: { id: string; name: string } | null;
}

export default function AreasManager({ initialAreas, semesterStatus, activeSemester }: Props) {
    const [isPending, startTransition] = useTransition();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingArea, setEditingArea] = useState<Area | null>(null);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Form state
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formColor, setFormColor] = useState("#6366f1");
    const [formIsLeadershipArea, setFormIsLeadershipArea] = useState(false);
    const [formCanCreateEvents, setFormCanCreateEvents] = useState(false);
    const [formCanCreateIndividualEvents, setFormCanCreateIndividualEvents] = useState(false);

    // Merge areas with semester status
    const areasData: AreaWithStatus[] = initialAreas.map(area => {
        const status = semesterStatus.find(s => s.id === area.id);
        return {
            ...area,
            isActiveInSemester: status?.isActiveInSemester ?? false,
            semesterAreaId: status?.semesterAreaId ?? null,
        };
    });

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const resetForm = () => {
        setFormName("");
        setFormCode("");
        setFormDescription("");
        setFormColor("#6366f1");
        setFormIsLeadershipArea(false);
        setFormCanCreateEvents(false);
        setFormCanCreateIndividualEvents(false);
        setShowCreateForm(false);
        setEditingArea(null);
    };

    const handleCreate = () => {
        startTransition(async () => {
            const result = await createAreaAction({
                name: formName,
                code: formCode || null,
                description: formDescription || null,
                color: formColor,
                isLeadershipArea: formIsLeadershipArea,
                canCreateEvents: formCanCreateEvents,
                canCreateIndividualEvents: formCanCreateIndividualEvents,
            });
            if (result.success) {
                showFeedback("success", result.message || "Área creada.");
                resetForm();
            } else {
                showFeedback("error", result.error || "Error al crear.");
            }
        });
    };

    const handleUpdate = () => {
        if (!editingArea) return;
        startTransition(async () => {
            const result = await updateAreaAction({
                id: editingArea.id,
                name: formName,
                code: formCode || null,
                description: formDescription || null,
                color: formColor,
                isLeadershipArea: formIsLeadershipArea,
                canCreateEvents: formCanCreateEvents,
                canCreateIndividualEvents: formCanCreateIndividualEvents,
            });
            if (result.success) {
                showFeedback("success", result.message || "Área actualizada.");
                resetForm();
            } else {
                showFeedback("error", result.error || "Error al actualizar.");
            }
        });
    };

    const handleDelete = (areaId: string, areaName: string) => {
        if (!confirm(`¿Eliminar el área "${areaName}"? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            const result = await deleteAreaAction(areaId);
            if (result.success) {
                showFeedback("success", result.message || "Área eliminada.");
            } else {
                showFeedback("error", result.error || "Error al eliminar.");
            }
        });
    };

    const handleToggleSemester = (areaId: string, activate: boolean) => {
        if (!activeSemester) return;
        startTransition(async () => {
            const result = await toggleAreaInSemesterAction(areaId, activeSemester.id, activate);
            if (result.success) {
                showFeedback("success", result.message || "Estado actualizado.");
            } else {
                showFeedback("error", result.error || "Error al cambiar estado.");
            }
        });
    };

    const handleActivateAll = () => {
        if (!activeSemester) return;
        startTransition(async () => {
            const result = await activateAllAreasInSemesterAction(activeSemester.id);
            if (result.success) {
                showFeedback("success", result.message || "Todas activadas.");
            } else {
                showFeedback("error", result.error || "Error.");
            }
        });
    };

    const startEdit = (area: Area) => {
        setEditingArea(area);
        setFormName(area.name);
        setFormCode(area.code || "");
        setFormDescription(area.description || "");
        setFormColor(area.color || "#6366f1");
        setFormIsLeadershipArea(area.isLeadershipArea ?? false);
        setFormCanCreateEvents(area.canCreateEvents ?? false);
        setFormCanCreateIndividualEvents(area.canCreateIndividualEvents ?? false);
        setShowCreateForm(false);
    };

    const startCreate = () => {
        resetForm();
        setShowCreateForm(true);
    };

    const activeCount = areasData.filter(a => a.isActiveInSemester).length;

    return (
        <div className="space-y-6">
            {/* Feedback Toast */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${feedback.type === "success"
                    ? "bg-emerald-500 text-white"
                    : "bg-red-500 text-white"
                    }`}>
                    {feedback.type === "success"
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <XCircle className="w-4 h-4" />
                    }
                    {feedback.message}
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={startCreate}
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Área
                    </button>

                    {activeSemester && (
                        <button
                            onClick={handleActivateAll}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                        >
                            <Zap className="w-4 h-4" />
                            Activar Todas
                        </button>
                    )}
                </div>

                {activeSemester && (
                    <div className="text-sm font-medium text-meteorite-600">
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg font-bold">
                            {activeCount}/{areasData.length}
                        </span>
                        {" "}áreas activas en <span className="font-bold">{activeSemester.name}</span>
                    </div>
                )}
            </div>

            {/* Create / Edit Form */}
            {(showCreateForm || editingArea) && (
                <div className="bg-white/80 backdrop-blur-md border border-meteorite-200/50 rounded-2xl p-6 shadow-xl ring-1 ring-gray-100 animate-in fade-in zoom-in-95 duration-300">
                    <h3 className="text-lg font-black text-meteorite-950 mb-4">
                        {editingArea ? `Editar: ${editingArea.name}` : "Crear Nueva Área"}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Nombre *</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="Ej: Marketing Digital"
                                className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none transition-all bg-white text-meteorite-950 font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Código</label>
                            <input
                                type="text"
                                value={formCode}
                                onChange={e => setFormCode(e.target.value.toUpperCase())}
                                placeholder="Ej: MKT"
                                maxLength={10}
                                className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none transition-all bg-white text-meteorite-950 font-medium uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Descripción</label>
                            <input
                                type="text"
                                value={formDescription}
                                onChange={e => setFormDescription(e.target.value)}
                                placeholder="Descripción breve..."
                                className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none transition-all bg-white text-meteorite-950 font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Color</label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {AREA_COLOR_PRESETS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setFormColor(c)}
                                        className={`w-7 h-7 rounded-full border-2 transition-all ${formColor === c ? 'border-meteorite-700 scale-110 ring-2 ring-meteorite-300' : 'border-transparent hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={formColor}
                                    onChange={e => setFormColor(e.target.value)}
                                    className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                                    title="Color personalizado"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col justify-end pb-1">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={formIsLeadershipArea}
                                        onChange={(e) => setFormIsLeadershipArea(e.target.checked)}
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${formIsLeadershipArea ? 'bg-amber-500' : 'bg-gray-200'}`}></div>
                                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${formIsLeadershipArea ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <div className="text-sm font-bold text-meteorite-700 group-hover:text-meteorite-900 transition-colors">
                                    Mesa Directiva <span className="text-amber-500 inline-block ml-1"><Crown className="w-4 h-4" /></span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Event Capabilities */}
                    <div className="mt-4 p-4 bg-violet-50/60 rounded-xl border border-violet-200/50">
                        <h4 className="text-xs font-black text-violet-700 uppercase tracking-wider mb-3">📅 Permisos de Eventos</h4>
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={formCanCreateEvents}
                                        onChange={(e) => setFormCanCreateEvents(e.target.checked)}
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${formCanCreateEvents ? 'bg-violet-500' : 'bg-gray-200'}`}></div>
                                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${formCanCreateEvents ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <div className="text-sm font-bold text-meteorite-700 group-hover:text-meteorite-900 transition-colors">
                                    Crear eventos generales / área
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={formCanCreateIndividualEvents}
                                        onChange={(e) => setFormCanCreateIndividualEvents(e.target.checked)}
                                    />
                                    <div className={`w-11 h-6 rounded-full transition-colors ${formCanCreateIndividualEvents ? 'bg-violet-500' : 'bg-gray-200'}`}></div>
                                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${formCanCreateIndividualEvents ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <div className="text-sm font-bold text-meteorite-700 group-hover:text-meteorite-900 transition-colors">
                                    Crear reuniones individuales/grupales
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={editingArea ? handleUpdate : handleCreate}
                            disabled={isPending || !formName.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {editingArea ? "Actualizar" : "Crear"}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {areasData.map(area => (
                    <div
                        key={area.id}
                        className={`bg-white/80 backdrop-blur-md border rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 group ${area.isActiveInSemester
                            ? "border-emerald-200/50 ring-1 ring-emerald-100"
                            : "border-gray-200/50"
                            }`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner"
                                    style={area.color ? {
                                        backgroundColor: `${area.color}20`,
                                        color: area.color,
                                    } : area.isActiveInSemester ? {
                                        backgroundColor: 'rgb(209 250 229)',
                                        color: 'rgb(21 128 61)',
                                    } : {
                                        backgroundColor: 'rgb(243 244 246)',
                                        color: 'rgb(107 114 128)',
                                    }}
                                >
                                    {area.code || area.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-meteorite-950 text-base flex items-center gap-2">
                                        {area.name}
                                        {area.isLeadershipArea && (
                                            <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                                        )}
                                    </h3>
                                    {area.code && (
                                        <span className="text-xs font-mono text-meteorite-400">
                                            {area.code}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Status Badge */}
                            {activeSemester && (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${area.isActiveInSemester
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-500"
                                    }`}>
                                    {area.isActiveInSemester ? "Activa" : "Inactiva"}
                                </span>
                            )}
                        </div>

                        {area.description && (
                            <p className="text-sm text-meteorite-500 mb-3 line-clamp-2">{area.description}</p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <button
                                onClick={() => startEdit(area)}
                                disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-meteorite-600 bg-meteorite-50 hover:bg-meteorite-100 rounded-lg transition-all disabled:opacity-50"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar
                            </button>

                            {activeSemester && (
                                <button
                                    onClick={() => handleToggleSemester(area.id, !area.isActiveInSemester)}
                                    disabled={isPending}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50 ${area.isActiveInSemester
                                        ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                                        : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                        }`}
                                >
                                    {area.isActiveInSemester
                                        ? <><ToggleRight className="w-3.5 h-3.5" /> Desactivar</>
                                        : <><ToggleLeft className="w-3.5 h-3.5" /> Activar</>
                                    }
                                </button>
                            )}

                            <button
                                onClick={() => handleDelete(area.id, area.name)}
                                disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50 ml-auto"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty state */}
            {areasData.length === 0 && (
                <div className="bg-white/80 backdrop-blur-md border border-meteorite-200/50 rounded-2xl p-12 text-center">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-600 mb-2">
                        No hay áreas registradas
                    </h3>
                    <p className="text-sm text-gray-400 mb-6">
                        Crea la primera área para comenzar a organizar tu estructura.
                    </p>
                    <button
                        onClick={startCreate}
                        className="px-6 py-3 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg transition-all"
                    >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Crear Primera Área
                    </button>
                </div>
            )}
        </div>
    );
}
