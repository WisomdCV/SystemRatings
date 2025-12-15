"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateEventSchema, CreateEventDTO } from "@/lib/validators/event";
import { createEventAction } from "@/server/actions/event.actions";
import {
    Calendar,
    Clock,
    MapPin,
    Video,
    AlignLeft,
    CheckCircle2,
    AlertCircle,
    Loader2
} from "lucide-react";

interface Area {
    id: string;
    name: string;
}

interface CreateEventFormProps {
    userRole: string;
    userAreaId: string | null;
    userAreaName: string | null;
    areas: Area[]; // List of areas for admin selection
    onSuccess: () => void;
}

export default function CreateEventForm({
    userRole,
    userAreaId,
    userAreaName,
    areas,
    onSuccess
}: CreateEventFormProps) {
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const isDirector = userRole === "DIRECTOR";
    const canSelectArea = ["DEV", "PRESIDENT"].includes(userRole);

    const form = useForm<CreateEventDTO>({
        resolver: zodResolver(CreateEventSchema),
        defaultValues: {
            title: "",
            description: "",
            date: undefined,
            startTime: "",
            endTime: "",
            isVirtual: true,
            targetAreaId: isDirector ? userAreaId : null, // Director defaults to their area, Admin defaults to Null (General)
        },
    });

    const onSubmit = (data: CreateEventDTO) => {
        setSubmitError(null);
        startTransition(async () => {
            // Security Override: Director always submits for their area
            if (isDirector && userAreaId) {
                data.targetAreaId = userAreaId;
            }

            const result = await createEventAction(data);

            if (result.success) {
                form.reset();
                onSuccess();
            } else {
                setSubmitError(result.error || "Error desconocido al crear evento.");
            }
        });
    };

    const handleQuickTime = (minutes: number) => {
        const now = new Date();
        const futureDate = new Date(now.getTime() + minutes * 60000);

        // Update Date (Format YYYY-MM-DD for input type="date")
        // Note: Using local string construction to avoid UTC discrepancies if needed, but ISO split is usually fine for "Today" if timezone is not edge case.
        // Better: helpers to ensure local date string.
        const year = futureDate.getFullYear();
        const month = String(futureDate.getMonth() + 1).padStart(2, '0');
        const day = String(futureDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        form.setValue("date", dateString as any); // cast as any because schema expects Date but input needs string

        // Update Start Time (HH:MM format)
        const hours = futureDate.getHours().toString().padStart(2, '0');
        const mins = futureDate.getMinutes().toString().padStart(2, '0');
        const startTime = `${hours}:${mins}`;
        form.setValue("startTime", startTime);

        // Update End Time (+1 hour from start)
        const endDate = new Date(futureDate.getTime() + 60 * 60000);
        const endHours = endDate.getHours().toString().padStart(2, '0');
        const endMins = endDate.getMinutes().toString().padStart(2, '0');
        form.setValue("endTime", `${endHours}:${endMins}`);
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Header / Context */}
            <div className="bg-meteorite-50/50 p-4 rounded-xl border border-meteorite-100 flex items-start gap-3">
                <div className="p-2 bg-meteorite-100 rounded-lg text-meteorite-600 mt-1">
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-meteorite-900 text-sm">Nuevo Evento</h4>
                    <p className="text-xs text-meteorite-500 mt-1">
                        Programar una nueva reunión o actividad. Se sincronizará automáticamente con Google Calendar.
                    </p>
                </div>
            </div>

            {/* Title & Area Selection */}
            <div className="grid grid-cols-1 gap-5">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                        Título del Evento
                    </label>
                    <div className="relative">
                        <input
                            {...form.register("title")}
                            placeholder="Ej: Reunión Semanal de Staff"
                            className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
                        />
                    </div>
                    {form.formState.errors.title && (
                        <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{form.formState.errors.title.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                        Área Destino
                    </label>

                    {canSelectArea ? (
                        <select
                            {...form.register("targetAreaId")}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-700 appearance-none cursor-pointer"
                        >
                            <option value="">🎯 Organización Completa (General)</option>
                            {areas.map((area) => (
                                <option key={area.id} value={area.id}>
                                    📂 {area.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="w-full px-4 py-2.5 rounded-xl border border-meteorite-200 bg-meteorite-50 text-meteorite-700 text-sm font-bold flex items-center">
                            <span className="w-2 h-2 rounded-full bg-meteorite-500 mr-2"></span>
                            Evento para: {userAreaName || "Mi Área"}
                        </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                        {canSelectArea
                            ? "Elige si es para todos o un área específica."
                            : "Como Director, solo puedes crear eventos para tu área."}
                    </p>
                </div>
            </div>

            {/* Quick Time Actions */}
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2 hide-scroll">
                <button
                    type="button"
                    onClick={() => handleQuickTime(5)}
                    className="px-3 py-1.5 rounded-lg bg-meteorite-100 text-meteorite-700 text-xs font-bold hover:bg-meteorite-200 transition-colors whitespace-nowrap"
                >
                    🚀 En 5 min
                </button>
                <button
                    type="button"
                    onClick={() => handleQuickTime(15)}
                    className="px-3 py-1.5 rounded-lg bg-meteorite-100 text-meteorite-700 text-xs font-bold hover:bg-meteorite-200 transition-colors whitespace-nowrap"
                >
                    ⏱️ En 15 min
                </button>
                <button
                    type="button"
                    onClick={() => handleQuickTime(30)}
                    className="px-3 py-1.5 rounded-lg bg-meteorite-100 text-meteorite-700 text-xs font-bold hover:bg-meteorite-200 transition-colors whitespace-nowrap"
                >
                    🕜 En 30 min
                </button>
                <button
                    type="button"
                    onClick={() => handleQuickTime(60)}
                    className="px-3 py-1.5 rounded-lg bg-meteorite-100 text-meteorite-700 text-xs font-bold hover:bg-meteorite-200 transition-colors whitespace-nowrap"
                >
                    🕐 En 1 hora
                </button>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Date */}
                <div className="md:col-span-2 lg:col-span-1">
                    <div className="flex justify-between items-center mb-1.5 ml-1">
                        <label className="text-sm font-bold text-gray-700">
                            Fecha
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                const now = new Date();
                                const year = now.getFullYear();
                                const month = String(now.getMonth() + 1).padStart(2, '0');
                                const day = String(now.getDate()).padStart(2, '0');
                                form.setValue("date", `${year}-${month}-${day}` as any);
                            }}
                            className="text-[10px] bg-meteorite-100 text-meteorite-700 font-bold px-2 py-0.5 rounded hover:bg-meteorite-200 transition-colors"
                        >
                            📅 Hoy
                        </button>
                    </div>

                    <input
                        type="date"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-900"
                        {...form.register("date")}
                    />
                    {form.formState.errors.date && (
                        <p className="text-red-500 text-xs mt-1 ml-1 font-medium">Requerido</p>
                    )}
                </div>

                {/* Start Time */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                        Inicio
                    </label>
                    <div className="relative">
                        <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input
                            type="time"
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${form.formState.errors.startTime ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50/50"} focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-900`}
                            {...form.register("startTime")}
                        />
                    </div>
                    {form.formState.errors.startTime && (
                        <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{form.formState.errors.startTime.message}</p>
                    )}
                </div>

                {/* End Time */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                        Fin
                    </label>
                    <div className="relative">
                        <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input
                            type="time"
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${form.formState.errors.endTime ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50/50"} focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-900`}
                            {...form.register("endTime")}
                        />
                    </div>
                    {form.formState.errors.endTime && (
                        <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{form.formState.errors.endTime.message}</p>
                    )}
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                    Descripción (Opcional)
                </label>
                <div className="relative">
                    <AlignLeft className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <textarea
                        {...form.register("description")}
                        rows={3}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400 resize-none"
                        placeholder="Detalles adicionales, agenda, o notas..."
                    />
                </div>
            </div>

            {/* Checkbox Virtual/Presential */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                    Modalidad
                </label>
                <div className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-300 ${form.watch("isVirtual") ? "bg-blue-50/50 border-blue-100 hover:bg-blue-50" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`} onClick={() => form.setValue("isVirtual", !form.getValues("isVirtual"))}>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${form.watch("isVirtual") ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"}`}>
                        {form.watch("isVirtual") ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : null}
                    </div>
                    <input type="checkbox" {...form.register("isVirtual")} className="hidden" />
                    <div className="ml-3 select-none flex-1">
                        <span className={`block text-sm font-bold ${form.watch("isVirtual") ? "text-blue-900" : "text-gray-700"}`}>
                            {form.watch("isVirtual") ? "Reunión Virtual (Google Meet)" : "Reunión Presencial"}
                        </span>
                        <span className={`block text-xs ${form.watch("isVirtual") ? "text-blue-600/80" : "text-gray-500"}`}>
                            {form.watch("isVirtual") ? "Se generará un enlace automáticamente." : "No se generará enlace de Meet."}
                        </span>
                    </div>
                    {form.watch("isVirtual") ? <Video className="w-5 h-5 text-blue-400" /> : <MapPin className="w-5 h-5 text-gray-400" />}
                </div>
            </div>

            {/* Errors */}
            {submitError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {submitError}
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 px-4 bg-gradient-to-r from-meteorite-600 to-meteorite-700 hover:from-meteorite-700 hover:to-meteorite-800 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/20 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Sincronizando con Google...
                    </>
                ) : (
                    "Programar Evento"
                )}
            </button>
        </form>
    );
}
