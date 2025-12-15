"use client";

import { Zap, Video, Calendar, MapPin, MoreVertical, Edit, Trash2, X, Clock } from "lucide-react";
import { useState } from "react";
import { deleteEventAction } from "@/server/actions/event.actions";
import { useRouter } from "next/navigation";
import CreateEventForm from "./CreateEventForm";

type EventItem = {
    id: string;
    title: string;
    description: string | null;
    date: Date;
    startTime: string | null;
    endTime: string | null;
    isVirtual: boolean | null;
    meetLink: string | null;
    status: string | null;
    createdById: string | null;
    targetAreaId: string | null;
    targetArea: {
        id: string;
        name: string;
        code: string | null;
    } | null;
    createdAt?: Date;
    updatedAt?: Date;
};

interface EventsListProps {
    events: EventItem[];
    userRole: string;
    userAreaId: string | null;
    userAreaName: string | null;
    areas: any[];
}

export default function EventsList({ events, userRole, userAreaId, userAreaName, areas }: EventsListProps) {
    const router = useRouter();
    const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // ID of event being deleted

    const handleDelete = async (eventId: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer y borrará el evento de Google Calendar.")) return;

        setIsDeleting(eventId);
        try {
            const result = await deleteEventAction(eventId);
            if (result.success) {
                // Toast or alert? Simple alert for now as requested
                // alert(result.message); 
                router.refresh();
            } else {
                alert("Error: " + result.error);
            }
        } catch (error) {
            alert("Error al eliminar el evento.");
        } finally {
            setIsDeleting(null);
        }
    };

    if (!events || events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-meteorite-200/50 text-center">
                <div className="w-16 h-16 bg-meteorite-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-meteorite-500" />
                </div>
                <h3 className="text-xl font-bold text-meteorite-900 mb-2">Sin eventos programados</h3>
                <p className="text-meteorite-500 max-w-md">
                    No hay eventos próximos en tu agenda. ¡Crea uno nuevo para comenzar!
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => {
                    const isGeneral = !event.targetArea;
                    const dateObj = new Date(event.date);
                    const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' });
                    const month = dateObj.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase();

                    // Permission Check (Should match server logic visually)
                    // DEV/PRESI can edit all. DIRECTOR can edit ONLY own.
                    // We don't have 'currentUserId' easily here unless we pass it or check logic.
                    // Assuming server handles security, we show buttons. 
                    // Best effort: Pass currentUserId? Or just let server fail.
                    // Let's rely on server failure but maybe hide if clearly not owner? 
                    // For now, allow click, let action fail if unauthorized.

                    return (
                        <div
                            key={event.id}
                            className="group relative bg-white/70 backdrop-blur-lg border border-meteorite-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-meteorite-900/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                        >
                            {/* Decorative Gradient Line */}
                            <div className={`absolute top-0 left-0 w-full h-1.5 ${isGeneral ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-meteorite-500 to-meteorite-700'}`}></div>

                            <div className="flex items-start justify-between mb-4">
                                {/* Date Badge */}
                                <div className="flex flex-col items-center justify-center w-14 h-14 bg-meteorite-50 rounded-2xl border border-meteorite-100 group-hover:bg-meteorite-100 transition-colors">
                                    <span className="text-xs font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                                    <span className="text-xl font-black text-meteorite-800 leading-none">{day}</span>
                                </div>

                                {/* Options Button (Visual only for now) */}
                                <button className="text-meteorite-300 hover:text-meteorite-600 transition-colors p-1">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Title & Area */}
                            <div className="mb-4">
                                <div className="flex items-center mb-2">
                                    {isGeneral ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                            GENERAL
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-meteorite-100 text-meteorite-700 border border-meteorite-200">
                                            {event.targetArea?.name}
                                        </span>
                                    )}

                                    {/* Edited Badge */}
                                    {event.updatedAt && (!event.createdAt || new Date(event.updatedAt).getTime() > new Date(event.createdAt).getTime() + 1000) && (
                                        <span
                                            className="ml-2 inline-flex items-center text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100"
                                            title={`Actualizado: ${new Date(event.updatedAt).toISOString().split('T')[0]}`}
                                            suppressHydrationWarning
                                        >
                                            <Clock className="w-3 h-3 mr-1" />
                                            Actualizado
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-lg text-gray-800 leading-tight group-hover:text-meteorite-700 transition-colors">
                                    {event.title}
                                </h3>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 text-sm text-gray-500 mb-5">
                                <div className="flex items-center">
                                    <div className="w-5 flex justify-center mr-2"><Calendar className="w-4 h-4 text-meteorite-400" /></div>
                                    <span>
                                        {event.startTime} - {event.endTime}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-5 flex justify-center mr-2">
                                        {event.isVirtual ? <Video className="w-4 h-4 text-meteorite-400" /> : <MapPin className="w-4 h-4 text-meteorite-400" />}
                                    </div>
                                    <span className="truncate">
                                        {event.isVirtual ? "Virtual (Google Meet)" : "Presencial"}
                                    </span>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-meteorite-100/50">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setEditingEvent(event)}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-meteorite-50 hover:text-meteorite-600 transition-colors"
                                        title="Editar"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(event.id)}
                                        disabled={isDeleting === event.id}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                                        title="Eliminar"
                                    >
                                        {isDeleting === event.id ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>

                                {event.isVirtual && event.meetLink && (
                                    <a
                                        href={event.meetLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center px-3 py-2 bg-meteorite-600 text-white text-xs font-bold rounded-xl hover:bg-meteorite-700 hover:shadow-lg hover:shadow-meteorite-600/30 transition-all"
                                    >
                                        <Video className="w-3 h-3 mr-2" />
                                        Unirse
                                    </a>
                                )}

                                {/* Attendance Button */}
                                <a
                                    href={`/admin/events/${event.id}/attendance`}
                                    className="flex items-center px-3 py-2 bg-white border border-meteorite-200 text-meteorite-700 text-xs font-bold rounded-xl hover:bg-meteorite-50 transition-colors ml-2"
                                >
                                    <Zap className="w-3 h-3 mr-2" />
                                    Asistencia
                                </a>
                            </div>

                            {/* Edited Timestamp */}
                            {/* Removed from bottom */}
                        </div>
                    );
                })}
            </div>

            {/* Edit Modal */}
            {editingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setEditingEvent(null)}
                    ></div>

                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-float-up p-0">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <h2 className="text-xl font-black text-meteorite-950">Editar Evento</h2>
                            <button
                                onClick={() => setEditingEvent(null)}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[85vh] overflow-y-auto">
                            <CreateEventForm
                                userRole={userRole}
                                userAreaId={userAreaId}
                                userAreaName={userAreaName}
                                areas={areas}
                                onSuccess={() => setEditingEvent(null)}
                                initialData={editingEvent}
                                eventId={editingEvent.id}
                                isEditing={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
