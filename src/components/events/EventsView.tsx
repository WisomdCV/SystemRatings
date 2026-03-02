"use client";

import React, { useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
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
import { getAreaColorStyle } from "@/lib/utils/area-colors";
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
    // Events v2 fields
    eventScope?: string | null;
    eventType?: string | null;
    tracksAttendance?: boolean | null;
    projectId?: string | null;
    project?: { id: string; name: string } | null;
    targetProjectArea?: { id: string; name: string } | null;
    targetArea: {
        id: string;
        name: string;
        code: string | null;
        color: string | null;
        isLeadershipArea: boolean | null;
    } | null;
    createdBy?: {
        name: string | null;
        role: string | null;
    } | null;
    createdAt?: Date;
    updatedAt?: Date;
    pendingJustificationCount?: number;
    invitees?: {
        userId: string;
        status: string | null;
        user: {
            id: string;
            name: string | null;
            image: string | null;
        };
    }[];
    // Pre-computed permissions from server (Changes 1+2)
    _permissions?: {
        canEdit: boolean;
        canDelete: boolean;
        canTakeAttendance: boolean;
    };
};

interface EventsViewProps {
    events: EventItem[];
    activeSemesterName: string;
    userRole: string;
    userId?: string | null;
    userAreaId: string | null;
    userAreaName: string | null;
    areas: any[];
    readOnly?: boolean;
    // v2 props
    availableScopes?: string[];
    availableTypes?: string[];
    projects?: { id: string; name: string }[];
    projectAreas?: { id: string; name: string }[];
    users?: { id: string; name: string | null; image: string | null }[];
    projectMembersMap?: Record<string, { id: string; name: string | null; image: string | null }[]>;
}

export default function EventsView({
    events,
    activeSemesterName,
    userRole,
    userId,
    userAreaId,
    userAreaName,
    areas,
    readOnly = false,
    availableScopes,
    availableTypes,
    projects,
    projectAreas,
    users,
    projectMembersMap,
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
                                {readOnly ? "Agenda de Actividades" : "Agenda & Eventos"}
                            </h1>
                            <p className="text-meteorite-600 mt-1 font-medium text-sm sm:text-base">
                                {readOnly
                                    ? `Actividades del semestre ${activeSemesterName}`
                                    : `Gestión de actividades para el semestre ${activeSemesterName}`}
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

                        {!readOnly && (
                            <NewEventModal
                                userRole={userRole}
                                userAreaId={userAreaId}
                                userAreaName={userAreaName}
                                areas={areas}
                                availableScopes={availableScopes}
                                availableTypes={availableTypes}
                                projects={projects}
                                projectAreas={projectAreas}
                                users={users}
                                projectMembersMap={projectMembersMap}
                            />
                        )}
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
                                    const canEdit = !readOnly && (event._permissions?.canEdit ?? false);
                                    const canDelete = !readOnly && (event._permissions?.canDelete ?? false);
                                    const canAttendance = !readOnly && (event._permissions?.canTakeAttendance ?? false);

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
                                    const canEdit = !readOnly && (event._permissions?.canEdit ?? false);
                                    const canDelete = !readOnly && (event._permissions?.canDelete ?? false);
                                    const canAttendance = !readOnly && (event._permissions?.canTakeAttendance ?? false);

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
                                availableScopes={availableScopes}
                                availableTypes={availableTypes}
                                projects={projects}
                                projectAreas={projectAreas}
                                users={users}
                                projectMembersMap={projectMembersMap}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Sub-components ---
// NOTE: Per-event permissions are pre-computed on the server (_permissions field)
// and consumed directly here — ZERO client-side permission logic.

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
    const isBoard = event.targetArea?.isLeadershipArea === true;
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
                <div className="flex space-x-1">
                    {canAttendance && (event.pendingJustificationCount || 0) > 0 && (
                        <div className="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-1 rounded-full flex items-center border border-amber-200 animate-pulse" title={`${event.pendingJustificationCount} justificaciones pendientes de revisión`}>
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></div>
                            {event.pendingJustificationCount} pendientes
                        </div>
                    )}
                    {canEdit && (
                        <button onClick={onEdit} className="text-gray-300 hover:text-meteorite-600 p-1 rounded-full hover:bg-meteorite-50 transition-colors">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-2">
                <Tag isGeneral={isGeneral} isBoard={isBoard} areaName={event.targetArea?.name} areaColor={event.targetArea?.color} event={event} />
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
                {event.eventType === "INDIVIDUAL_GROUP" && event.invitees && event.invitees.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-50">
                        <InviteeAvatars invitees={event.invitees} />
                    </div>
                )}
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
    const isBoard = event.targetArea?.isLeadershipArea === true;
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
                    <div className="flex justify-center md:justify-start gap-2 items-center">
                        <Tag isGeneral={isGeneral} isBoard={isBoard} areaName={event.targetArea?.name} areaColor={event.targetArea?.color} event={event} />
                        {canAttendance && (event.pendingJustificationCount || 0) > 0 && (
                            <div className="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center border border-amber-200" title={`${event.pendingJustificationCount} justificaciones pendientes`}>
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse"></div>
                                {event.pendingJustificationCount}
                            </div>
                        )}
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
                {event.eventType === "INDIVIDUAL_GROUP" && event.invitees && event.invitees.length > 0 && (
                    <div className="mt-1">
                        <InviteeAvatars invitees={event.invitees} />
                    </div>
                )}
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

function InviteeAvatars({ invitees }: { invitees?: EventItem["invitees"] }) {
    if (!invitees || invitees.length === 0) return null;
    const MAX_VISIBLE = 3;
    const visible = invitees.slice(0, MAX_VISIBLE);
    const remaining = invitees.length - MAX_VISIBLE;

    return (
        <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
                {visible.map(inv => (
                    <div
                        key={inv.user.id}
                        className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-meteorite-100 shadow-sm"
                        title={inv.user.name || "Invitado"}
                    >
                        <UserAvatar
                            src={inv.user.image}
                            name={inv.user.name}
                            className="w-full h-full"
                            fallbackClassName="bg-transparent text-[9px] text-meteorite-600"
                        />
                    </div>
                ))}
                {remaining > 0 && (
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-meteorite-200 flex items-center justify-center text-[9px] font-bold text-meteorite-700 shadow-sm">
                        +{remaining}
                    </div>
                )}
            </div>
            <span className="text-[10px] text-meteorite-400 font-medium">
                {invitees.length} invitado{invitees.length !== 1 ? "s" : ""}
            </span>
        </div>
    );
}

function Tag({ isGeneral, isBoard, areaName, areaColor, event }: { isGeneral: boolean, isBoard: boolean, areaName?: string, areaColor?: string | null, event?: EventItem }) {
    const tags: React.ReactElement[] = [];

    // Scope badge (only for PROJECT events)
    if (event?.eventScope === "PROJECT") {
        tags.push(
            <span key="scope" className="inline-block px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wide border border-violet-200">
                📁 {event.project?.name || "Proyecto"}
            </span>
        );
    }

    // Type badge for INDIVIDUAL_GROUP
    if (event?.eventType === "INDIVIDUAL_GROUP") {
        tags.push(
            <span key="type" className="inline-block px-2 py-0.5 rounded-md bg-teal-100 text-teal-700 text-[10px] font-bold uppercase tracking-wide border border-teal-200">
                👥 Reunión
            </span>
        );
    }

    // Area badge — skip for INDIVIDUAL_GROUP (the "👥 Reunión" tag is sufficient)
    if (event?.eventType === "INDIVIDUAL_GROUP") {
        // No extra area/general tag needed
    } else if (event?.eventScope === "PROJECT" && event?.targetProjectArea) {
        const style = "bg-violet-50 text-violet-600 border-violet-200";
        tags.push(
            <span key="pArea" className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${style}`}>
                {event.targetProjectArea.name}
            </span>
        );
    } else if (isGeneral) {
        tags.push(
            <span key="area" className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide border border-gray-200">General</span>
        );
    } else if (isBoard) {
        tags.push(
            <span key="area" className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border bg-amber-100 text-amber-700 border-amber-200`}>{areaName || "Mesa Directiva"}</span>
        );
    } else {
        const colorStyle = getAreaColorStyle(areaColor);
        tags.push(
            <span key="area" className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border" style={colorStyle}>{areaName}</span>
        );
    }

    return <div className="flex flex-wrap gap-1">{tags}</div>;
}
