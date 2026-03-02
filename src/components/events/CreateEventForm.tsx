"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CreateEventSchema, CreateEventDTO } from "@/lib/validators/event";
import { createEventAction, updateEventAction } from "@/server/actions/event.actions";
import {
    Calendar,
    Clock,
    MapPin,
    Video,
    AlignLeft,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Globe,
    FolderKanban,
    Users,
    Megaphone,
    UserPlus,
    Shield,
    Info,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Area {
    id: string;
    name: string;
}

interface CreateEventFormProps {
    userRole: string;
    userAreaId: string | null;
    userAreaName: string | null;
    areas: any[];
    onSuccess?: () => void;
    initialData?: any;
    eventId?: string;
    isEditing?: boolean;
    // v2 props
    projects?: { id: string; name: string }[];
    projectAreas?: { id: string; name: string }[];
    availableScopes?: string[];
    availableTypes?: string[];
    users?: { id: string; name: string | null; image: string | null }[];
    projectMembersMap?: Record<string, { id: string; name: string | null; image: string | null }[]>;
    defaultProjectId?: string;
}

export default function CreateEventForm({
    userRole,
    userAreaId,
    userAreaName,
    areas,
    onSuccess,
    initialData,
    eventId,
    isEditing = false,
    projects = [],
    projectAreas = [],
    availableScopes = ["IISE"],
    availableTypes = ["GENERAL", "AREA"],
    users = [],
    projectMembersMap = {},
    defaultProjectId,
}: CreateEventFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Pre-populate invitees from initialData when editing
    const initialInviteeIds = (isEditing && initialData?.invitees)
        ? initialData.invitees.map((inv: any) => inv.userId || inv.user?.id).filter(Boolean) as string[]
        : [];
    const [selectedInvitees, setSelectedInvitees] = useState<string[]>(initialInviteeIds);
    const [inviteeSearch, setInviteeSearch] = useState("");

    // Keep inviteeUserIds in sync with selectedInvitees so Zod sees them during validation
    const syncInvitees = (ids: string[]) => {
        setSelectedInvitees(ids);
        form.setValue("inviteeUserIds", ids, { shouldValidate: false });
    };

    const defaultValues = isEditing && initialData ? {
        title: initialData.title,
        description: initialData.description || "",
        eventScope: initialData.eventScope || "IISE",
        eventType: initialData.eventType || "GENERAL",
        targetAreaId: initialData.targetAreaId || "",
        projectId: initialData.projectId || "",
        targetProjectAreaId: initialData.targetProjectAreaId || "",
        date: new Date(initialData.date).toISOString().split('T')[0],
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        isVirtual: initialData.isVirtual,
        inviteeUserIds: (initialData.invitees || []).map((inv: any) => inv.userId || inv.user?.id).filter(Boolean),
    } : {
        title: "",
        description: "",
        eventScope: defaultProjectId ? "PROJECT" : "IISE",
        eventType: "GENERAL",
        targetAreaId: userRole === "DIRECTOR" || userRole === "SUBDIRECTOR" ? (userAreaId || "") : "",
        projectId: defaultProjectId || "",
        targetProjectAreaId: "",
        date: undefined,
        startTime: "",
        endTime: "",
        isVirtual: true,
        inviteeUserIds: [],
    };

    const form = useForm<CreateEventDTO>({
        resolver: zodResolver(CreateEventSchema) as any,
        defaultValues: defaultValues as any
    });

    const watchScope = form.watch("eventScope") || "IISE";
    const watchType = form.watch("eventType") || "GENERAL";
    const isVirtual = form.watch("isVirtual");

    const canSelectArea = ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"].includes(userRole);

    const onSubmit = async (data: CreateEventDTO) => {
        setIsSubmitting(true);
        setSubmitError(null);

        // Invitees are already synced via syncInvitees → form.setValue

        try {
            let result;
            if (isEditing && eventId) {
                result = await updateEventAction(eventId, data);
            } else {
                result = await createEventAction(data);
            }

            if (result.success) {
                if (!isEditing) {
                    form.reset();
                    syncInvitees([]);
                }
                if (onSuccess) onSuccess();
                router.refresh();
            } else {
                setSubmitError(result.error || "Error al guardar el evento.");
            }
        } catch (error) {
            setSubmitError("Error inesperado. Inténtalo de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleQuickTime = (minutes: number) => {
        const now = new Date();
        const futureDate = new Date(now.getTime() + minutes * 60000);
        const year = futureDate.getFullYear();
        const month = String(futureDate.getMonth() + 1).padStart(2, '0');
        const day = String(futureDate.getDate()).padStart(2, '0');
        form.setValue("date", `${year}-${month}-${day}` as any);
        const hours = futureDate.getHours().toString().padStart(2, '0');
        const mins = futureDate.getMinutes().toString().padStart(2, '0');
        form.setValue("startTime", `${hours}:${mins}`);
        const endDate = new Date(futureDate.getTime() + 60 * 60000);
        const endHours = endDate.getHours().toString().padStart(2, '0');
        const endMins = endDate.getMinutes().toString().padStart(2, '0');
        form.setValue("endTime", `${endHours}:${endMins}`);
    };

    const toggleInvitee = (userId: string) => {
        const next = selectedInvitees.includes(userId)
            ? selectedInvitees.filter(id => id !== userId)
            : [...selectedInvitees, userId];
        syncInvitees(next);
    };

    // Determine which users to show in the invitee picker based on scope
    const watchProjectId = form.watch("projectId");
    const inviteePool = (watchScope === "PROJECT" && watchProjectId && projectMembersMap[watchProjectId])
        ? projectMembersMap[watchProjectId]
        : users;

    const filteredUsers = inviteePool.filter(u =>
        u.name?.toLowerCase().includes(inviteeSearch.toLowerCase())
    );

    const SCOPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
        IISE: { label: "IISE (Organización)", icon: Globe, color: "meteorite" },
        PROJECT: { label: "Proyecto", icon: FolderKanban, color: "violet" },
    };

    const TYPE_LABELS: Record<string, { label: string; icon: any; desc: string }> = {
        GENERAL: { label: "General", icon: Megaphone, desc: "Para toda la organización o proyecto" },
        AREA: { label: "Área", icon: Users, desc: "Para un área específica" },
        INDIVIDUAL_GROUP: { label: "Individual/Grupal", icon: UserPlus, desc: "Reunión con invitados específicos" },
    };

    // Build capability description for the indicator header
    const capabilityChips: { label: string; color: string }[] = [];
    if (availableTypes.includes("GENERAL")) {
        capabilityChips.push({ label: "General", color: "bg-blue-100 text-blue-700 border-blue-200" });
    }
    if (availableTypes.includes("AREA")) {
        if (canSelectArea) {
            capabilityChips.push({ label: "Todas las áreas", color: "bg-emerald-100 text-emerald-700 border-emerald-200" });
        } else {
            capabilityChips.push({ label: userAreaName || "Mi Área", color: "bg-indigo-100 text-indigo-700 border-indigo-200" });
        }
    }
    if (availableTypes.includes("INDIVIDUAL_GROUP")) {
        capabilityChips.push({ label: "Individual/Grupal", color: "bg-teal-100 text-teal-700 border-teal-200" });
    }
    const hasProjectScope = availableScopes.includes("PROJECT");
    const isOvernightHint = (() => {
        const start = form.watch("startTime");
        const end = form.watch("endTime");
        if (!start || !end) return false;
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        return (eh * 60 + em) < (sh * 60 + sm);
    })();

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Permission Capability Banner */}
            {!isEditing && (
                <div className="p-3 bg-gradient-to-r from-meteorite-50 to-indigo-50 border border-meteorite-200/60 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-3.5 h-3.5 text-meteorite-500" />
                        <span className="text-[11px] font-black text-meteorite-600 uppercase tracking-wider">
                            Tus capacidades
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {capabilityChips.map((chip, i) => (
                            <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip.color}`}>
                                {chip.label}
                            </span>
                        ))}
                        {hasProjectScope && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-100 text-violet-700 border-violet-200">
                                Proyectos
                            </span>
                        )}
                    </div>
                </div>
            )}
            {/* Step 1: Scope Selection */}
            {!isEditing && availableScopes.length > 1 && (
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2 ml-1">
                        Alcance del Evento
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {availableScopes.map(scope => {
                            const cfg = SCOPE_LABELS[scope] || { label: scope, icon: Globe, color: "gray" };
                            const Icon = cfg.icon;
                            const isActive = watchScope === scope;
                            return (
                                <button
                                    key={scope}
                                    type="button"
                                    onClick={() => {
                                        form.setValue("eventScope", scope as any);
                                        // Reset type when switching scope
                                        form.setValue("eventType", "GENERAL" as any);
                                    }}
                                    className={`p-3 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${isActive
                                        ? `border-${cfg.color}-500 bg-${cfg.color}-50 shadow-md`
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${isActive ? `bg-${cfg.color}-100 text-${cfg.color}-600` : "bg-gray-100 text-gray-400"}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className={`text-sm font-bold ${isActive ? `text-${cfg.color}-700` : "text-gray-600"}`}>
                                        {cfg.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step 2: Type Selection */}
            {!isEditing && (
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2 ml-1">
                        Tipo de Evento
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {availableTypes.map(type => {
                            const cfg = TYPE_LABELS[type] || { label: type, icon: Calendar, desc: "" };
                            const Icon = cfg.icon;
                            const isActive = watchType === type;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => form.setValue("eventType", type as any)}
                                    className={`p-3 rounded-xl border-2 transition-all text-left ${isActive
                                        ? "border-meteorite-500 bg-meteorite-50 shadow-md"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className={`w-4 h-4 ${isActive ? "text-meteorite-600" : "text-gray-400"}`} />
                                        <span className={`text-sm font-bold ${isActive ? "text-meteorite-700" : "text-gray-600"}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 leading-tight">{cfg.desc}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step 3: Title */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                    Título del Evento
                </label>
                <input
                    {...form.register("title")}
                    placeholder="Ej: Reunión Semanal de Staff"
                    className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
                />
                {form.formState.errors.title && (
                    <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{form.formState.errors.title.message}</p>
                )}
            </div>

            {/* Conditional: Area Target (IISE + AREA or IISE + GENERAL) */}
            {watchScope === "IISE" && watchType !== "INDIVIDUAL_GROUP" && (
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
                </div>
            )}

            {/* Conditional: Project Selection (PROJECT scope) */}
            {watchScope === "PROJECT" && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            Proyecto
                        </label>
                        <select
                            {...form.register("projectId")}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none text-sm font-medium text-gray-700 appearance-none cursor-pointer"
                        >
                            <option value="">Seleccionar proyecto...</option>
                            {projects.map(proj => (
                                <option key={proj.id} value={proj.id}>📁 {proj.name}</option>
                            ))}
                        </select>
                        {form.formState.errors.projectId && (
                            <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{(form.formState.errors.projectId as any)?.message}</p>
                        )}
                    </div>
                    {watchType === "AREA" && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                                Área del Proyecto
                            </label>
                            <select
                                {...form.register("targetProjectAreaId")}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none text-sm font-medium text-gray-700 appearance-none cursor-pointer"
                            >
                                <option value="">Seleccionar área...</option>
                                {projectAreas.map(pa => (
                                    <option key={pa.id} value={pa.id}>📂 {pa.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Conditional: Invitees (INDIVIDUAL_GROUP) */}
            {watchType === "INDIVIDUAL_GROUP" && (
                <div>
                    <label className="block text-sm font-black text-meteorite-950 mb-1.5 ml-1">
                        Invitados ({selectedInvitees.length} seleccionados)
                    </label>
                    <input
                        type="text"
                        value={inviteeSearch}
                        onChange={(e) => setInviteeSearch(e.target.value)}
                        placeholder="Buscar usuarios..."
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 transition-all outline-none text-sm font-medium mb-2"
                    />
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                        {filteredUsers.length === 0 ? (
                            <p className="p-3 text-xs text-gray-400 text-center">No se encontraron usuarios</p>
                        ) : (
                            filteredUsers.map(user => (
                                <label
                                    key={user.id}
                                    className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${selectedInvitees.includes(user.id) ? "bg-meteorite-50" : ""}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedInvitees.includes(user.id)}
                                        onChange={() => toggleInvitee(user.id)}
                                        className="w-4 h-4 rounded border-gray-300 text-meteorite-600 focus:ring-meteorite-500"
                                    />
                                    {user.image ? (
                                        <UserAvatar src={user.image} name={user.name} className="w-6 h-6 rounded-full" />
                                    ) : (
                                        <UserAvatar src={null} name={user.name} className="w-6 h-6 rounded-full text-[10px]" fallbackClassName="bg-gray-200 text-gray-500" />
                                    )}
                                    <span className="text-sm font-medium text-gray-700">{user.name || "Sin nombre"}</span>
                                </label>
                            ))
                        )}
                    </div>
                    {selectedInvitees.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedInvitees.map(uid => {
                                const user = users.find(u => u.id === uid);
                                return (
                                    <span
                                        key={uid}
                                        className="px-2 py-1 bg-meteorite-100 text-meteorite-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-meteorite-200"
                                        onClick={() => toggleInvitee(uid)}
                                    >
                                        {user?.name?.split(' ')[0] || uid.slice(0, 6)}
                                        <span className="text-meteorite-400">×</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Time */}
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
                {[
                    { label: "🚀 En 5 min", min: 5 },
                    { label: "⏱️ En 15 min", min: 15 },
                    { label: "🕜 En 30 min", min: 30 },
                    { label: "🕐 En 1 hora", min: 60 },
                ].map(qt => (
                    <button
                        key={qt.min}
                        type="button"
                        onClick={() => handleQuickTime(qt.min)}
                        className="px-3 py-1.5 rounded-lg bg-meteorite-100 text-meteorite-700 text-xs font-bold hover:bg-meteorite-200 transition-colors whitespace-nowrap"
                    >
                        {qt.label}
                    </button>
                ))}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <div className="flex justify-between items-center mb-1.5 ml-1">
                        <label className="text-sm font-bold text-gray-700">Fecha</label>
                        <button
                            type="button"
                            onClick={() => {
                                const now = new Date();
                                form.setValue("date", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` as any);
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

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Inicio</label>
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

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Fin</label>
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

            {/* Overnight indicator */}
            {isOvernightHint && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">
                        Evento nocturno — la hora de fin corresponde al día siguiente.
                    </span>
                </div>
            )}

            {/* Description */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Descripción (Opcional)</label>
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

            {/* Virtual Toggle */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Modalidad</label>
                <div
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-300 ${isVirtual ? "bg-blue-50/50 border-blue-100 hover:bg-blue-50" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
                    onClick={() => form.setValue("isVirtual", !form.getValues("isVirtual"))}
                >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isVirtual ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"}`}>
                        {isVirtual ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : null}
                    </div>
                    <input type="checkbox" {...form.register("isVirtual")} className="hidden" />
                    <div className="ml-3 select-none flex-1">
                        <span className={`block text-sm font-bold ${isVirtual ? "text-blue-900" : "text-gray-700"}`}>
                            {isVirtual ? "Reunión Virtual (Google Meet)" : "Reunión Presencial"}
                        </span>
                        <span className={`block text-xs ${isVirtual ? "text-blue-600/80" : "text-gray-500"}`}>
                            {isVirtual ? "Se generará un enlace automáticamente." : "No se generará enlace de Meet."}
                        </span>
                    </div>
                    {isVirtual ? <Video className="w-5 h-5 text-blue-400" /> : <MapPin className="w-5 h-5 text-gray-400" />}
                </div>
            </div>

            {/* Invitee validation error */}
            {(form.formState.errors as any).inviteeUserIds && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {(form.formState.errors as any).inviteeUserIds.message || "Selecciona al menos un invitado."}
                </div>
            )}

            {/* Errors */}
            {submitError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {submitError}
                </div>
            )}

            {/* Submit */}
            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-meteorite-600 to-meteorite-800 hover:from-meteorite-700 hover:to-meteorite-900 text-white font-bold rounded-xl shadow-lg shadow-meteorite-500/20 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            {isEditing ? "Guardando..." : "Programando..."}
                        </>
                    ) : (
                        <>
                            {isEditing ? "Guardar Cambios" : "Programar Evento"}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
