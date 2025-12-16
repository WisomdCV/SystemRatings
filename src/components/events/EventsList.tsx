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
    createdBy?: {
        name: string | null;
        role: string | null;
    } | null;
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

    const [viewMode, setViewMode] = useState<"upcoming" | "history">("upcoming");

    // Filter events based on viewMode
    // We compare strings (YYYY-MM-DD) to ensure we respect the Local Calendar Day
    // vs the Stored UTC Date.
    const nowStr = new Date().toLocaleDateString('en-CA');

    const filteredEvents = events.filter(e => {
        // e.date comes as Date object or string usually normalized to UTC midnight
        // We want the UTC date string part "YYYY-MM-DD"
        const eventDate = new Date(e.date);
        const eventDateStr = eventDate.toISOString().split('T')[0];

        // If today is 2025-12-16. Event is 2025-12-16.
        // Upcoming >= Today. History < Today.
        return viewMode === "upcoming" ? eventDateStr >= nowStr : eventDateStr < nowStr;
    });

    return (
        <>
            {/* Tabs / Filters */}
            <div className="flex space-x-1 bg-meteorite-100/50 p-1 rounded-xl w-fit mb-6">
                <button
                    onClick={() => setViewMode("upcoming")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === "upcoming"
                        ? "bg-white text-meteorite-600 shadow-sm"
                        : "text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-50"
                        }`}
                >
                    Próximas
                </button>
                <button
                    onClick={() => setViewMode("history")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === "history"
                        ? "bg-white text-meteorite-600 shadow-sm"
                        : "text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-50"
                        }`}
                >
                    Historial
                </button>
            </div>

            {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-meteorite-200/50 text-center">
                    <div className="w-16 h-16 bg-meteorite-100 rounded-full flex items-center justify-center mb-4">
                        <Calendar className="w-8 h-8 text-meteorite-500" />
                    </div>
                    <h3 className="text-xl font-bold text-meteorite-900 mb-2">
                        {viewMode === "upcoming" ? "Sin eventos próximos" : "Sin historial de eventos"}
                    </h3>
                    <p className="text-meteorite-500 max-w-md">
                        {viewMode === "upcoming"
                            ? "No hay actividades programadas. ¡Crea una nueva!"
                            : "No hay eventos pasados registrados."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
                    {filteredEvents.map((event) => {
                        const isGeneral = !event.targetArea;
                        const dateObj = new Date(event.date);
                        const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' });
                        const month = dateObj.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');
                        const isBoard = event.targetArea?.code === "MD";

                        return (
                            <div
                                key={event.id}
                                className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden ${isBoard ? 'border-amber-200 bg-amber-50/30' : 'border-meteorite-100'}`}
                            >
                                {/* Decorative Strip for Board */}
                                {isBoard && <div className="absolute top-0 left-0 w-full h-1 bg-amber-400"></div>}

                                {/* Header: Date + Options */}
                                <div className="flex justify-between items-start mb-4">
                                    {/* Date Badge */}
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm text-center py-2 px-3 min-w-[60px]">
                                        <span className="block text-[10px] font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                                        <span className="block text-2xl font-black text-meteorite-950 leading-none">{day}</span>
                                    </div>

                                    {/* Options Button */}
                                    <button
                                        onClick={() => setEditingEvent(event)}
                                        className="text-gray-300 hover:text-meteorite-600 p-1 rounded-full hover:bg-meteorite-50 transition-colors"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Tag */}
                                <div className="mb-2">
                                    {isGeneral ? (
                                        <span className="inline-block px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide border border-gray-200">
                                            General
                                        </span>
                                    ) : isBoard ? (
                                        <span className="inline-block px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide border border-amber-200">
                                            Mesa Directiva
                                        </span>
                                    ) : (
                                        <span className="inline-block px-3 py-1 rounded-lg bg-meteorite-100 text-meteorite-700 text-[10px] font-bold uppercase tracking-wide border border-meteorite-200">
                                            {event.targetArea?.name}
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                                    {event.title}
                                </h3>

                                {/* Description Box */}
                                {event.description && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 text-sm text-slate-500 italic">
                                        "{event.description}"
                                    </div>
                                )}

                                {/* Details List */}
                                <div className="space-y-3 flex-1 mb-6">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Clock className="w-5 h-5 text-meteorite-400 mr-2" />
                                        <span className="font-medium">{event.startTime} - {event.endTime}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600">
                                        {event.isVirtual ? <Video className="w-5 h-5 text-meteorite-400 mr-2" /> : <MapPin className="w-5 h-5 text-meteorite-400 mr-2" />}
                                        <span className="truncate">{event.isVirtual ? "Virtual (Google Meet)" : "Presencial"}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-500 mt-3 pt-3 border-t border-gray-50">
                                        <div className="w-5 h-5 rounded-full bg-meteorite-100 text-meteorite-700 flex items-center justify-center text-[10px] font-bold mr-2">
                                            {event.createdBy?.name?.charAt(0) || "U"}
                                        </div>
                                        <span className="text-xs">
                                            Creado por: <span className="font-bold text-gray-700">{event.createdBy?.name || event.createdBy?.role || "Desconocido"}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Footer / Actions */}
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                                    {/* Left Actions (Edit/Delete) */}
                                    <div className="flex space-x-1">
                                        <button
                                            onClick={() => setEditingEvent(event)}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-meteorite-600 hover:bg-meteorite-50 transition-colors"
                                            title="Editar"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(event.id)}
                                            disabled={isDeleting === event.id}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                            title="Eliminar"
                                        >
                                            {isDeleting === event.id ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Right Actions (Buttons) */}
                                    <div className="flex space-x-2">
                                        {event.isVirtual && event.meetLink && (
                                            <a
                                                href={event.meetLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center px-4 py-2 bg-meteorite-600 hover:bg-meteorite-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-meteorite-600/20"
                                            >
                                                <Video className="w-3.5 h-3.5 mr-2" />
                                                Unirse
                                            </a>
                                        )}
                                        <a
                                            href={`/admin/events/${event.id}/attendance`}
                                            className="flex items-center px-3 py-2 bg-white border border-meteorite-200 hover:border-meteorite-400 text-meteorite-700 text-sm font-bold rounded-xl transition-all"
                                        >
                                            <Zap className="w-3.5 h-3.5 mr-2 text-meteorite-500" />
                                            Asistencia
                                        </a>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
