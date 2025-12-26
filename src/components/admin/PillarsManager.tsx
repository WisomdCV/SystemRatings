"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Copy, X, Edit } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { upsertPillarAction, deletePillarAction, clonePillarsAction, PillarInput } from "@/server/actions/pillar.actions";
import { useRouter } from "next/navigation";

// --- Types ---
type Pillar = {
    id: string;
    semesterId: string;
    name: string;
    weight: number;
    directorWeight: number | null;
    maxScore: number;
    isDirectorOnly: boolean;
};

interface PillarsManagerProps {
    semesterId: string;
    initialPillars: Pillar[];
    otherSemesters: { id: string, name: string }[];
}

export function PillarsManager({ semesterId, initialPillars, otherSemesters }: PillarsManagerProps) {
    const [pillars, setPillars] = useState<Pillar[]>(initialPillars);
    const [isLoading, setIsLoading] = useState(false);
    const [isCloneLoading, setIsCloneLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    // Fix: Sync state with props when router.refresh() fetches new data
    useEffect(() => {
        setPillars(initialPillars);
    }, [initialPillars]);

    // Editor State
    const [editingPillar, setEditingPillar] = useState<PillarInput>({
        semesterId, name: "", weight: 0, maxScore: 5, isDirectorOnly: false, directorWeight: null
    });

    const [cloneSourceId, setCloneSourceId] = useState<string>("");

    // --- Stats Calculation ---
    const sumMember = pillars
        .filter(p => !p.isDirectorOnly)
        .reduce((sum, p) => sum + p.weight, 0);

    const sumDirector = pillars.reduce((sum, p) => {
        const w = (p.directorWeight !== null && p.directorWeight !== undefined) ? p.directorWeight : p.weight;
        return sum + w;
    }, 0);

    // --- Handlers ---
    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        try {
            const res = await upsertPillarAction(editingPillar);
            if (!res.success) throw new Error(res.error);

            toast.success("Guardado: " + res.message);
            setIsOpen(false);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar pilar? Esto podría afectar notas existentes.")) return;
        setIsLoading(true);
        try {
            const res = await deletePillarAction(id, semesterId);
            if (!res.success) throw new Error(res.error);
            toast.success("Eliminado: " + res.message);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClone = async () => {
        if (!cloneSourceId) return;
        if (!confirm("¿Sobrescribir pilares actuales? Se eliminarán los config actuales.")) return;

        setIsCloneLoading(true);
        try {
            const res = await clonePillarsAction(cloneSourceId, semesterId);
            if (!res.success) throw new Error(res.error);
            toast.success("Clonado Exitoso: " + res.message);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsCloneLoading(false);
        }
    };

    const openCreate = () => {
        setEditingPillar({
            semesterId,
            name: "",
            weight: 0,
            directorWeight: null,
            maxScore: 5,
            isDirectorOnly: false
        });
        setIsOpen(true);
    };

    const openEdit = (p: Pillar) => {
        setEditingPillar({
            id: p.id,
            semesterId: p.semesterId,
            name: p.name,
            weight: p.weight,
            directorWeight: p.directorWeight,
            maxScore: p.maxScore,
            isDirectorOnly: p.isDirectorOnly
        });
        setIsOpen(true);
    };

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        if (isOpen) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen]);

    const closeModal = () => setIsOpen(false);

    // --- Validation Logic (Hoisted) ---
    // Calculate validity based on current editing state
    const otherPillars = pillars.filter(p => p.id !== editingPillar.id);

    // Member Validity
    const otherMemberSum = otherPillars
        .filter(p => !p.isDirectorOnly)
        .reduce((sum, p) => sum + p.weight, 0);
    const projectedMemberSum = otherMemberSum + (editingPillar.isDirectorOnly ? 0 : editingPillar.weight);
    const isMemberOver = projectedMemberSum > 100.1;

    // Director Validity
    const otherDirectorSum = otherPillars.reduce((sum, p) => {
        const w = (p.directorWeight !== null && p.directorWeight !== undefined) ? p.directorWeight : p.weight;
        return sum + w;
    }, 0);
    const projectedDirectorSum = otherDirectorSum + ((editingPillar.directorWeight !== null && editingPillar.directorWeight !== undefined) ? editingPillar.directorWeight : editingPillar.weight);
    const isDirectorOver = projectedDirectorSum > 100.1;

    // Block saving if limit exceeded
    const isFormInvalid = isMemberOver || isDirectorOver;

    return (
        <div className="space-y-6">
            {/* --- TOP BAR: Stats & Clone --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stats Card */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-bold text-gray-900 text-lg">Validación de Pesos</h3>

                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-900">Miembros:</span>
                        <span className={`font-black ${Math.abs(sumMember - 100) < 0.1 ? "text-emerald-600" : "text-amber-500"}`}>
                            {sumMember.toFixed(1)}% / 100%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${Math.abs(sumMember - 100) < 0.1 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(sumMember, 100)}%` }}></div>
                    </div>

                    <div className="flex items-center justify-between text-sm mt-1">
                        <span className="font-bold text-gray-900">Directores:</span>
                        <span className={`font-black ${Math.abs(sumDirector - 100) < 0.1 ? "text-emerald-600" : "text-amber-500"}`}>
                            {sumDirector.toFixed(1)}% / 100%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${Math.abs(sumDirector - 100) < 0.1 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(sumDirector, 100)}%` }}></div>
                    </div>

                    {(sumMember > 100.1 || sumDirector > 100.1) && (
                        <p className="text-xs text-red-600 font-bold mt-1 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center">
                            ⚠️ Error: Los pesos exceden el 100%
                        </p>
                    )}
                </div>

                {/* Clone Panel */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-bold text-gray-900 text-lg">Clonar Configuración</h3>
                    <div className="flex gap-2">
                        <select
                            className="bg-white border border-gray-200 rounded-xl text-sm px-3 py-2 flex-1 text-gray-900 font-medium focus:ring-2 focus:ring-meteorite-500/20 focus:border-meteorite-500 outline-none transition-all cursor-pointer hover:border-gray-300"
                            value={cloneSourceId}
                            onChange={(e) => setCloneSourceId(e.target.value)}
                        >
                            <option value="" className="text-gray-500">Seleccionar ciclo origen...</option>
                            {otherSemesters.map(s => (
                                <option key={s.id} value={s.id} className="text-gray-900 font-medium">{s.name}</option>
                            ))}
                        </select>
                        <Button size="sm" variant="outline" onClick={handleClone} disabled={!cloneSourceId || isCloneLoading} className="rounded-xl bg-white border-gray-200 text-gray-700 font-bold hover:bg-meteorite-600 hover:text-white hover:border-meteorite-600 transition-all shadow-sm">
                            {isCloneLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                            Clonar
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 font-medium bg-gray-50 p-2 rounded-lg">
                        <span className="font-bold text-gray-700">Nota:</span> Copia pesos y reglas del ciclo seleccionado. Borra la configuración actual.
                    </p>
                </div>
            </div>

            {/* --- DATA TABLE --- */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="font-black text-xl text-meteorite-950">Pilares Configurados</h2>
                        <p className="text-sm text-gray-500 font-medium">Define las columnas de evaluación.</p>
                    </div>
                    <Button onClick={openCreate} className="bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/20 px-4 transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-5 h-5 mr-2" /> Nuevo Pilar
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 border-b border-gray-100">
                                <TableHead className="py-4 px-6 text-gray-900 font-bold text-xs uppercase tracking-wider">Nombre</TableHead>
                                <TableHead className="py-4 px-6 text-center text-gray-900 font-bold text-xs uppercase tracking-wider">Peso Base (Miembros)</TableHead>
                                <TableHead className="py-4 px-6 text-center text-gray-900 font-bold text-xs uppercase tracking-wider">Peso Director (Opcional)</TableHead>
                                <TableHead className="py-4 px-6 text-center text-gray-900 font-bold text-xs uppercase tracking-wider">Solo Director?</TableHead>
                                <TableHead className="py-4 px-6 text-center text-gray-900 font-bold text-xs uppercase tracking-wider">Max Score</TableHead>
                                <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pillars.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-gray-500 italic font-medium bg-gray-50/30">
                                        No hay pilares configurados. Usa "Clonar" o "Nuevo" para comenzar.
                                    </TableCell>
                                </TableRow>
                            )}
                            {pillars.map(pillar => (
                                <TableRow key={pillar.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                                    <TableCell className="px-6 py-4 font-bold text-gray-900 text-base">{pillar.name}</TableCell>

                                    {/* Member Weight Column */}
                                    <TableCell className="px-6 py-4 text-center">
                                        {!pillar.isDirectorOnly ? (
                                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-lg text-sm font-bold shadow-sm inline-block min-w-[3rem]">
                                                {pillar.weight}%
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 font-bold text-lg" title="No aplica a miembros">-</span>
                                        )}
                                    </TableCell>

                                    {/* Director Weight Column */}
                                    <TableCell className="px-6 py-4 text-center">
                                        {(pillar.isDirectorOnly || pillar.directorWeight !== null) ? (
                                            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1 rounded-lg text-sm font-bold shadow-sm inline-block min-w-[3rem]">
                                                {pillar.isDirectorOnly ? pillar.weight : pillar.directorWeight}%
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 font-bold text-lg" title="Mismo peso que miembros">-</span>
                                        )}
                                    </TableCell>

                                    <TableCell className="px-6 py-4 text-center">
                                        {pillar.isDirectorOnly ? (
                                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">Sí</span>
                                        ) : (
                                            <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">No</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-center text-base font-bold text-gray-900">{pillar.maxScore} pts</TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="flex gap-1 justify-end">
                                            <Button size="icon" variant="ghost" className="h-9 w-9 text-gray-400 hover:text-meteorite-600 hover:bg-meteorite-50 rounded-lg transition-colors" onClick={() => openEdit(pillar)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => handleDelete(pillar.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* --- CUSTOM MODAL (Matched CreateCycleModal / NewEventModal Style) --- */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                        onClick={closeModal}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-float-up p-0 ring-1 ring-gray-100">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h2 className="text-xl font-black text-meteorite-950">
                                {editingPillar.id ? "Editar Pilar" : "Crear Nuevo Pilar"}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            {/* Name */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-900 block">Nombre del Pilar</label>
                                <Input
                                    value={editingPillar.name}
                                    onChange={e => setEditingPillar({ ...editingPillar, name: e.target.value })}
                                    placeholder="Ej. Proyectos, Asistencia, etc."
                                    className="bg-white text-gray-900 border-gray-200 focus:border-meteorite-500 focus:ring-meteorite-500/20 rounded-xl"
                                    required
                                />
                            </div>

                            {/* Dynamic Validation Logic */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-sm font-bold text-gray-900 block">
                                            {editingPillar.isDirectorOnly ? "Peso (Solo Directores)" : "Peso Base (%)"}
                                        </label>
                                        {/* Show Remaining based on context */}
                                        <span className={`text-xs font-bold ${(editingPillar.isDirectorOnly ? isDirectorOver : isMemberOver) ? "text-red-500" : "text-gray-400"}`}>
                                            {editingPillar.isDirectorOnly
                                                ? `${(100 - otherDirectorSum).toFixed(1)}% Disp. (Dir)`
                                                : `${(100 - otherMemberSum).toFixed(1)}% Disp. (Miem)`
                                            }
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={editingPillar.weight}
                                            onChange={e => setEditingPillar({ ...editingPillar, weight: parseFloat(e.target.value) || 0 })}
                                            className={`bg-white text-gray-900 focus:border-meteorite-500 rounded-xl pr-8 ${(editingPillar.isDirectorOnly ? isDirectorOver : isMemberOver) ? "border-red-500 focus:border-red-500 focus:ring-red-200" : "border-gray-200"}`}
                                        />
                                        <span className="absolute right-3 top-2.5 text-gray-400 font-bold text-sm">%</span>
                                    </div>
                                    {/* Contextual Warning */}
                                    {(editingPillar.isDirectorOnly ? isDirectorOver : isMemberOver) ? (
                                        <p className="text-[10px] text-red-600 font-bold">
                                            ⚠️ Excede el 100% {editingPillar.isDirectorOnly ? "de Directores" : "de Miembros"} (Suma: {(editingPillar.isDirectorOnly ? projectedDirectorSum : projectedMemberSum).toFixed(1)}%)
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-gray-500 font-medium">
                                            {editingPillar.isDirectorOnly
                                                ? "Este peso cuenta para Directores (por defecto)."
                                                : "Aplicado a miembros regulares."}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-900 block">Nota Máxima</label>
                                    <Input
                                        type="number"
                                        value={editingPillar.maxScore}
                                        onChange={e => setEditingPillar({ ...editingPillar, maxScore: parseFloat(e.target.value) || 5 })}
                                        className="bg-white text-gray-900 border-gray-200 focus:border-meteorite-500 rounded-xl"
                                    />
                                </div>

                                {/* Extra Director Validation Warning (if both affected or specific director weight issue) */}
                                {isDirectorOver && !editingPillar.isDirectorOnly && (
                                    <div className="col-span-2 bg-red-50 text-red-700 text-xs font-bold p-2 rounded-lg border border-red-100 flex items-center gap-2">
                                        <span>⚠️ Cuidado: Además, esta configuración excede el 100% para Directores ({projectedDirectorSum.toFixed(1)}%).</span>
                                    </div>
                                )}
                            </div>

                            {/* Director Weight Override */}
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        id="hasDirWeight"
                                        checked={editingPillar.directorWeight !== null && editingPillar.directorWeight !== undefined}
                                        onCheckedChange={(c: boolean | "indeterminate") => {
                                            if (c === true) setEditingPillar({ ...editingPillar, directorWeight: 0 });
                                            else setEditingPillar({ ...editingPillar, directorWeight: null });
                                        }}
                                        className="border-gray-300 data-[state=checked]:bg-meteorite-600 data-[state=checked]:text-white"
                                    />
                                    <label htmlFor="hasDirWeight" className="text-sm font-bold text-gray-900 cursor-pointer select-none">
                                        ¿Peso distinto para Directores?
                                    </label>
                                </div>

                                {(editingPillar.directorWeight !== null && editingPillar.directorWeight !== undefined) && (
                                    <div className="animate-in fade-in slide-in-from-top-1 pl-7">
                                        <label className="text-xs font-bold text-purple-700 block mb-1.5 uppercase tracking-wide">Peso Director</label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                className="bg-white border-purple-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl pr-8"
                                                value={editingPillar.directorWeight}
                                                onChange={e => setEditingPillar({ ...editingPillar, directorWeight: parseFloat(e.target.value) || 0 })}
                                            />
                                            <span className="absolute right-3 top-2.5 text-purple-400 font-bold text-sm">%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Director Only Toggle */}
                            <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                <Checkbox
                                    id="isDirOnly"
                                    checked={editingPillar.isDirectorOnly}
                                    onCheckedChange={(c: boolean | "indeterminate") => {
                                        const isChecked = c === true;
                                        setEditingPillar({
                                            ...editingPillar,
                                            isDirectorOnly: isChecked,
                                            // Ensure directorWeight is null if DirectorOnly is active to avoid confusion/double inputs
                                            directorWeight: isChecked ? null : editingPillar.directorWeight
                                        });
                                    }}
                                    className="border-amber-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-white"
                                />
                                <div>
                                    <label htmlFor="isDirOnly" className="text-sm font-bold text-gray-900 cursor-pointer select-none block">
                                        Exclusivo de Directores
                                    </label>
                                    <p className="text-xs text-amber-700 font-medium mt-0.5">
                                        Este pilar no aparecerá para miembros regulares (ej. Liderazgo).
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={closeModal}
                                    className="rounded-xl text-gray-500 hover:bg-gray-100 font-bold hover:text-gray-900"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isLoading || isFormInvalid}
                                    className={`bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/20 px-6 ${isFormInvalid ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Guardar Cambios
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
