"use client";

import { useState } from "react";
import {
    CalendarCheck,
    Filter,
    LayoutGrid,
    List as ListIcon,
    Calendar,
    MoreVertical,
    Clock,
    Video,
    MapPin,
    Edit,
    Trash2,
    Zap,
    X,
    User,
    ArrowLeft
} from "lucide-react";
import CreateEventForm from "@/components/events/CreateEventForm";
import NewEventModal from "@/components/events/NewEventModal";
import { deleteEventAction } from "@/server/actions/event.actions";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Ensure Link is imported

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

interface EventsViewProps {
    events: EventItem[];
    activeSemesterName: string;
    userRole: string;
    userAreaId: string | null;
    userAreaName: string | null;
    areas: any[];
}

export default function EventsView({
    events,
    activeSemesterName,
    userRole,
    userAreaId,
    userAreaName,
    areas
}: EventsViewProps) {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [filterMode, setFilterMode] = useState<"upcoming" | "history">("upcoming");
    const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // --- Derived State ---
    const nowStr = new Date().toLocaleDateString('en-CA');
    const filteredEvents = events.filter(e => {
        const eventDate = new Date(e.date);
        const eventDateStr = eventDate.toISOString().split('T')[0];
        return filterMode === "upcoming" ? eventDateStr >= nowStr : eventDateStr < nowStr;
    });

    // --- Handlers ---
    const handleDelete = async (eventId: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer y borrará el evento de Google Calendar.")) return;

        setIsDeleting(eventId);
        try {
            const result = await deleteEventAction(eventId);
            if (result.success) {
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

    return (
        <div className="p-6 lg:p-10 min-h-screen bg-meteorite-50 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100 shrink-0"
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black text-meteorite-950 flex items-center">
                                <CalendarCheck className="mr-3 w-8 h-8 text-meteorite-600 hidden sm:block" />
                                Agenda & Eventos
                            </h1>
                            <p className="text-meteorite-600 mt-1 font-medium text-sm sm:text-base">
                                Gestión de actividades para el semestre {activeSemesterName}
                            </p>
                        </div>
                    </div>

                    {/* Actions & Toggles */}
                    <div className="flex items-center gap-3">
                        {/* View Toggle */}
                        <div className="bg-white border border-meteorite-200 rounded-xl p-1 flex items-center shadow-sm">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-meteorite-100 text-meteorite-600' : 'text-meteorite-400 hover:text-meteorite-600'}`}
                                title="Vista Cuadrícula"
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-meteorite-100 text-meteorite-600' : 'text-meteorite-400 hover:text-meteorite-600'}`}
                                title="Vista Lista"
                            >
                                <ListIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <button className="flex items-center px-4 py-2 bg-white border border-meteorite-200 text-meteorite-700 font-bold rounded-xl hover:bg-meteorite-50 transition-colors shadow-sm h-[42px]">
                            <Filter className="w-4 h-4 mr-2" />
                            Filtrar
                        </button>

                        <NewEventModal
                            userRole={userRole}
                            userAreaId={userAreaId}
                            userAreaName={userAreaName}
                            areas={areas}
                        />
                    </div>
                </div>

                {/* Filter Tabs (Upcoming / History) */}
                <div className="flex space-x-1 bg-meteorite-100/50 p-1 rounded-xl w-fit mb-6">
                    <button
                        onClick={() => setFilterMode("upcoming")}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterMode === "upcoming"
                            ? "bg-white text-meteorite-600 shadow-sm"
                            : "text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-50"
                            }`}
                    >
                        Próximas
                    </button>
                    <button
                        onClick={() => setFilterMode("history")}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterMode === "history"
                            ? "bg-white text-meteorite-600 shadow-sm"
                            : "text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-50"
                            }`}
                    >
                        Historial
                    </button>
                </div>

                {/* Content */}
                {filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-meteorite-200/50 text-center">
                        <div className="w-16 h-16 bg-meteorite-100 rounded-full flex items-center justify-center mb-4">
                            <Calendar className="w-8 h-8 text-meteorite-500" />
                        </div>
                        <h3 className="text-xl font-bold text-meteorite-900 mb-2">
                            {filterMode === "upcoming" ? "Sin eventos próximos" : "Sin historial de eventos"}
                        </h3>
                        <p className="text-meteorite-500 max-w-md">
                            {filterMode === "upcoming"
                                ? "No hay actividades programadas. ¡Crea una nueva!"
                                : "No hay eventos pasados registrados."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* GRID VIEW */}
                        {viewMode === "grid" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
                                {filteredEvents.map((event) => {
                                    const canEdit = canManageEvent(userRole, userAreaId, event);
                                    const canDelete = canManageEvent(userRole, userAreaId, event);
                                    const canAttendance = canTakeAttendance(userRole, userAreaId, event);

                                    return (
                                        <EventCardGrid
                                            key={event.id}
                                            event={event}
                                            isDeleting={isDeleting}
                                            onEdit={() => setEditingEvent(event)}
                                            onDelete={() => handleDelete(event.id)}
                                            canEdit={canEdit}
                                            canDelete={canDelete}
                                            canAttendance={canAttendance}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* LIST VIEW */}
                        {viewMode === "list" && (
                            <div className="space-y-4 pb-8">
                                {filteredEvents.map((event) => {
                                    const canEdit = canManageEvent(userRole, userAreaId, event);
                                    const canDelete = canManageEvent(userRole, userAreaId, event);
                                    const canAttendance = canTakeAttendance(userRole, userAreaId, event);

                                    return (
                                        <EventCardList
                                            key={event.id}
                                            event={event}
                                            isDeleting={isDeleting}
                                            onEdit={() => setEditingEvent(event)}
                                            onDelete={() => handleDelete(event.id)}
                                            canEdit={canEdit}
                                            canDelete={canDelete}
                                            canAttendance={canAttendance}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Modal Logic */}
            {editingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setEditingEvent(null)}
                    ></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-float-up p-0">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <h2 className="text-xl font-black text-meteorite-950">Editar Evento</h2>
                            <button onClick={() => setEditingEvent(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
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
        </div>
    );
}

// --- Helpers ---
function canManageEvent(role: string, userAreaId: string | null, event: EventItem) {
    if (role === "DEV" || role === "PRESIDENT") return true; // Start Mode God/Strategic Global
    if (role === "TREASURER") {
        // Can manage General and MD events
        return !event.targetAreaId || event.targetArea?.code === "MD";
    }
    if (role === "DIRECTOR" || role === "SUBDIRECTOR") {
        // Can manage ONLY their area events
        return event.targetAreaId === userAreaId;
    }
    return false;
}

function canTakeAttendance(role: string, userAreaId: string | null, event: EventItem) {
    // Logic is identical to management for now based on the matrix
    // "Tomar Asistencia" vs "Crear Eventos" columns are identical in scope
    return canManageEvent(role, userAreaId, event);
}

// --- Sub-components to keep clean ---

interface EventCardProps {
    event: EventItem;
    isDeleting: string | null;
    onEdit: () => void;
    onDelete: () => void;
    canEdit: boolean;
    canDelete: boolean;
    canAttendance: boolean;
}

function EventCardGrid({ event, isDeleting, onEdit, onDelete, canEdit, canDelete, canAttendance }: EventCardProps) {
    const isGeneral = !event.targetArea;
    const isBoard = event.targetArea?.code === "MD";
    const dateObj = new Date(event.date);
    const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' });
    const month = dateObj.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');

    return (
        <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden ${isBoard ? 'border-amber-200 bg-amber-50/30' : 'border-meteorite-100'}`}>
            {isBoard && <div className="absolute top-0 left-0 w-full h-1 bg-amber-400"></div>}

            <div className="flex justify-between items-start mb-4">
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm text-center py-2 px-3 min-w-[60px]">
                    <span className="block text-[10px] font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                    <span className="block text-2xl font-black text-meteorite-950 leading-none">{day}</span>
                </div>
                {canEdit && (
                    <button onClick={onEdit} className="text-gray-300 hover:text-meteorite-600 p-1 rounded-full hover:bg-meteorite-50 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="mb-2">
                <Tag isGeneral={isGeneral} isBoard={isBoard} areaName={event.targetArea?.name} areaCode={event.targetArea?.code} />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight mobile-title-clamp">{event.title}</h3>

            {event.description && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 text-sm text-slate-500 italic truncate-multi-line">
                    "{event.description}"
                </div>
            )}

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

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                <div className="flex space-x-1">
                    {canEdit && (
                        <button onClick={onEdit} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-meteorite-600 hover:bg-meteorite-50 transition-colors" title="Editar">
                            <Edit className="w-4 h-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={onDelete} disabled={isDeleting === event.id} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Eliminar">
                            {isDeleting === event.id ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div> : <Trash2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
                <div className="flex space-x-2">
                    {event.isVirtual && event.meetLink && (
                        <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 bg-meteorite-600 hover:bg-meteorite-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-meteorite-600/20">
                            <Video className="w-3.5 h-3.5 mr-1" /> Unirse
                        </a>
                    )}
                    {canAttendance && (
                        <Link href={`/admin/events/${event.id}/attendance`} className="flex items-center px-3 py-2 bg-white border border-meteorite-200 hover:border-meteorite-400 text-meteorite-700 text-xs font-bold rounded-xl transition-all">
                            <Zap className="w-3.5 h-3.5 mr-1 text-meteorite-500" /> Asistencia
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

function EventCardList({ event, isDeleting, onEdit, onDelete, canEdit, canDelete, canAttendance }: EventCardProps) {
    const isGeneral = !event.targetArea;
    const isBoard = event.targetArea?.code === "MD";
    const dateObj = new Date(event.date);
    const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' });
    const month = dateObj.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');

    return (
        <div className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row items-center gap-4 relative overflow-hidden ${isBoard ? 'border-amber-200 bg-amber-50/30' : 'border-meteorite-100'}`}>
            {isBoard && <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 hidden md:block"></div>}
            {isBoard && <div className="absolute top-0 left-0 w-full h-1 bg-amber-400 md:hidden"></div>}

            {/* Left: Date */}
            <div className="flex-shrink-0">
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm text-center py-2 px-3 w-[70px] h-[70px] flex flex-col justify-center">
                    <span className="block text-[10px] font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                    <span className="block text-2xl font-black text-meteorite-950 leading-none">{day}</span>
                </div>
            </div>

            {/* Center: Info */}
            <div className="flex-1 w-full md:w-auto text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{event.title}</h3>
                    <div className="flex justify-center md:justify-start">
                        <Tag isGeneral={isGeneral} isBoard={isBoard} areaName={event.targetArea?.name} areaCode={event.targetArea?.code} />
                    </div>
                </div>

                {event.description && (
                    <p className="text-sm text-slate-500 italic truncate w-full max-w-md hidden md:block mb-1">"{event.description}"</p>
                )}

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-gray-500">
                    <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 text-meteorite-400 mr-1.5" />
                        <span className="font-medium">{event.startTime} - {event.endTime}</span>
                    </div>
                    <div className="flex items-center">
                        {event.isVirtual ? <Video className="w-3.5 h-3.5 text-meteorite-400 mr-1.5" /> : <MapPin className="w-3.5 h-3.5 text-meteorite-400 mr-1.5" />}
                        <span>{event.isVirtual ? "Virtual" : "Presencial"}</span>
                    </div>
                    <div className="flex items-center hidden lg:flex">
                        <div className="w-4 h-4 rounded-full bg-meteorite-100 text-meteorite-700 flex items-center justify-center text-[9px] font-bold mr-1.5">
                            {(event.createdBy?.name || event.createdBy?.role || "U").charAt(0)}
                        </div>
                        <span>{event.createdBy?.name || event.createdBy?.role || "Desconocido"}</span>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                {/* Edit/Delete */}
                <div className="flex items-center gap-1">
                    {canEdit && (
                        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-meteorite-600 rounded-full hover:bg-meteorite-50 transition-colors">
                            <Edit className="w-4 h-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={onDelete} disabled={isDeleting === event.id} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50">
                            {isDeleting === event.id ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div> : <Trash2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {event.isVirtual && event.meetLink && (
                        <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-meteorite-600 hover:bg-meteorite-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-meteorite-600/20">
                            Unirse
                        </a>
                    )}
                    {canAttendance && (
                        <Link href={`/admin/events/${event.id}/attendance`} className="flex items-center px-4 py-2 bg-white border border-meteorite-200 hover:border-meteorite-400 text-meteorite-700 text-xs font-bold rounded-xl transition-all">
                            Asistencia
                        </Link>
                    )}
                    {/* More options dots could go here if needed -> Hidden to reduce clutter if actions are limited */}
                </div>
            </div>
        </div>
    );
}

function getAreaStyle(code?: string | null) {
    if (!code) return "bg-meteorite-100 text-meteorite-700 border-meteorite-200";
    switch (code) {
        case "LO": return "bg-blue-100 text-blue-700 border-blue-200";
        case "MK": return "bg-red-100 text-red-700 border-red-200";
        case "PM": return "bg-slate-100 text-slate-700 border-slate-200";
        case "TH": return "bg-pink-100 text-pink-700 border-pink-200";
        case "TI": return "bg-cyan-100 text-cyan-700 border-cyan-200";
        case "MC": return "bg-emerald-100 text-emerald-700 border-emerald-200";
        case "RP": return "bg-purple-100 text-purple-700 border-purple-200";
        case "IN": return "bg-orange-100 text-orange-700 border-orange-200";
        case "MD": return "bg-amber-100 text-amber-700 border-amber-200";
        default: return "bg-meteorite-100 text-meteorite-700 border-meteorite-200";
    }
}

function Tag({ isGeneral, isBoard, areaName, areaCode }: { isGeneral: boolean, isBoard: boolean, areaName?: string, areaCode?: string | null }) {
    if (isGeneral) {
        return <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide border border-gray-200">General</span>;
    }
    // Board is handled by areaCode MD usually, but keep specific check if needed
    if (isBoard) {
        return <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${getAreaStyle("MD")}`}>Mesa Directiva</span>;
    }
    const style = getAreaStyle(areaCode);
    return <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${style}`}>{areaName}</span>;
}
