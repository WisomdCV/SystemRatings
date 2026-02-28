"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Plus, ChevronDown, ChevronUp, Clock, MapPin, Users, Trash2, Loader2, FolderKanban } from "lucide-react";
import { deleteEventAction } from "@/server/actions/event.actions";
import CreateEventForm from "@/components/events/CreateEventForm";

interface ProjectEvent {
    id: string;
    title: string;
    description: string | null;
    date: Date | string;
    time: string | null;
    location: string | null;
    meetLink: string | null;
    eventScope: string | null;
    eventType: string | null;
    tracksAttendance: boolean | null;
    targetProjectArea: { id: string; name: string } | null;
    createdBy: { name: string | null; role: string | null } | null;
}

interface ProjectEventsTabProps {
    projectId: string;
    projectName: string;
    events: ProjectEvent[];
    canCreateEvents: boolean;
    projectAreas: { id: string; name: string }[];
    users: { id: string; name: string | null; image: string | null }[];
    userRole: string;
    userAreaId: string | null;
    userAreaName: string | null;
}

export default function ProjectEventsTab({
    projectId,
    projectName,
    events,
    canCreateEvents,
    projectAreas,
    users,
    userRole,
    userAreaId,
    userAreaName,
}: ProjectEventsTabProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isExpanded, setIsExpanded] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = (eventId: string, title: string) => {
        if (!confirm(`¿Eliminar evento "${title}"?`)) return;
        setDeletingId(eventId);
        startTransition(async () => {
            const res = await deleteEventAction(eventId);
            if (res.success) router.refresh();
            setDeletingId(null);
        });
    };

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" });
    };

    const sortedEvents = [...events].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                        <CalendarCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-black text-meteorite-950 text-lg">Eventos del Proyecto</h3>
                        <p className="text-xs text-meteorite-500 font-medium">{events.length} evento{events.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-meteorite-400" /> : <ChevronDown className="w-5 h-5 text-meteorite-400" />}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Create Button */}
                    {canCreateEvents && !showCreateForm && (
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-meteorite-200 rounded-xl text-meteorite-600 font-bold hover:border-meteorite-400 hover:text-meteorite-800 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Nuevo Evento para {projectName}
                        </button>
                    )}

                    {/* Create Form */}
                    {showCreateForm && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-meteorite-950 text-sm">Nuevo Evento</h4>
                                <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
                                    Cancelar
                                </button>
                            </div>
                            <CreateEventForm
                                userRole={userRole}
                                userAreaId={userAreaId}
                                userAreaName={userAreaName}
                                areas={[]}
                                onSuccess={() => { setShowCreateForm(false); router.refresh(); }}
                                availableScopes={["PROJECT"]}
                                availableTypes={["GENERAL", "AREA"]}
                                projects={[{ id: projectId, name: projectName }]}
                                projectAreas={projectAreas}
                                users={users}
                                defaultProjectId={projectId}
                            />
                        </div>
                    )}

                    {/* Events List */}
                    {sortedEvents.length === 0 && !showCreateForm ? (
                        <div className="text-center py-8">
                            <FolderKanban className="w-10 h-10 text-meteorite-200 mx-auto mb-2" />
                            <p className="text-meteorite-400 font-bold text-sm">Sin eventos aún</p>
                            <p className="text-meteorite-300 text-xs">Los eventos del proyecto aparecerán aquí</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sortedEvents.map(event => (
                                <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group">
                                    {/* Date badge */}
                                    <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 flex flex-col items-center justify-center shrink-0 shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-meteorite-400">
                                            {new Date(event.date).toLocaleDateString("es-EC", { month: "short" })}
                                        </span>
                                        <span className="text-lg font-black text-meteorite-950 -mt-0.5">
                                            {new Date(event.date).getDate()}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-meteorite-950 text-sm truncate">{event.title}</h4>
                                            {event.targetProjectArea && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100 shrink-0">
                                                    {event.targetProjectArea.name}
                                                </span>
                                            )}
                                            {event.eventType === "GENERAL" && !event.targetProjectArea && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                                                    General
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-meteorite-400">
                                            {event.time && (
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.time}</span>
                                            )}
                                            {event.location && (
                                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
                                            )}
                                            {event.createdBy?.name && (
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.createdBy.name.split(" ")[0]}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {canCreateEvents && (
                                        <button
                                            onClick={() => handleDelete(event.id, event.title)}
                                            disabled={deletingId === event.id}
                                            className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                                        >
                                            {deletingId === event.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
