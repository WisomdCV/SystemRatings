"use client";

import { useState, useTransition } from "react";
import { createSemesterAction } from "@/server/actions/semester.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles } from "lucide-react";

interface Props {
    isFirstTime: boolean;
}

export default function CreateSemesterForm({ isFirstTime }: Props) {
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activateNow, setActivateNow] = useState(true);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // Generar sugerencia de nombre basado en fecha actual
    const getNameSuggestion = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        // A = Enero-Julio, B = Agosto-Diciembre
        const period = month < 7 ? "A" : "B";
        return `${year} - ${period}`;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("El nombre del ciclo es requerido");
            return;
        }
        if (!startDate) {
            toast.error("La fecha de inicio es requerida");
            return;
        }

        startTransition(async () => {
            const result = await createSemesterAction({
                name: name.trim(),
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : undefined,
                activateImmediately: activateNow
            });

            if (result.success) {
                toast.success(result.message || "Ciclo creado correctamente");
                if (activateNow) {
                    router.push("/dashboard");
                } else {
                    router.refresh();
                }
            } else {
                toast.error(result.error || "Error al crear el ciclo");
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nombre del Ciclo *
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: 2026 - A"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-100 outline-none transition-all"
                        disabled={isPending}
                    />
                    <button
                        type="button"
                        onClick={() => setName(getNameSuggestion())}
                        className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
                        disabled={isPending}
                    >
                        Sugerir
                    </button>
                </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Fecha de Inicio *
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-100 outline-none transition-all"
                        disabled={isPending}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Fecha de Fin
                        <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-100 outline-none transition-all"
                        disabled={isPending}
                    />
                </div>
            </div>

            {/* Activar inmediatamente */}
            <label className="flex items-center gap-3 p-4 bg-meteorite-50 rounded-xl cursor-pointer group">
                <input
                    type="checkbox"
                    checked={activateNow}
                    onChange={(e) => setActivateNow(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-meteorite-600 focus:ring-meteorite-500"
                    disabled={isPending}
                />
                <div>
                    <p className="font-semibold text-gray-900 group-hover:text-meteorite-700 transition-colors">
                        Activar inmediatamente
                    </p>
                    <p className="text-sm text-gray-500">
                        {isFirstTime
                            ? "El ciclo se activará y podrás empezar a usar el sistema"
                            : "Esto desactivará cualquier otro ciclo activo"}
                    </p>
                </div>
            </label>

            {/* Submit */}
            <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 px-6 bg-gradient-to-r from-meteorite-600 to-meteorite-700 text-white font-bold rounded-xl 
                    hover:from-meteorite-700 hover:to-meteorite-800 transition-all shadow-lg shadow-meteorite-200
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                    flex items-center justify-center gap-2"
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creando ciclo...
                    </>
                ) : (
                    <>
                        {isFirstTime ? <Sparkles className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {isFirstTime ? "Comenzar con este Ciclo" : "Crear Ciclo"}
                    </>
                )}
            </button>
        </form>
    );
}
