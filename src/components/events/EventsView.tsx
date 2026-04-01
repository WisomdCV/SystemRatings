"use client";

import React, { useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
    CalendarCheck,
    Filter,
    LayoutGrid,
    List as ListIcon,
    Calendar,
    Clock,
    Video,
    MapPin,
    Edit,
    Trash2,
    Zap,
    X,
    ArrowLeft
} from "lucide-react";
import CreateEventForm from "@/components/events/CreateEventForm";
import NewEventModal from "@/components/events/NewEventModal";
import { deleteEventAction } from "@/server/actions/event.actions";
import { getAreaColorStyle } from "@/lib/utils/area-colors";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    project?: { id: string; name: string; color?: string | null } | null;
    targetProjectArea?: { id: string; name: string; color?: string | null } | null;
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
    areas: Array<{ id: string; name: string; code?: string | null }>;
    readOnly?: boolean;
    // v2 props
    availableScopes?: string[];
    availableTypes?: string[];
    projects?: { id: string; name: string }[];
    projectAreas?: { id: string; name: string }[];
    users?: { id: string; name: string | null; image: string | null }[];
    projectMembersMap?: Record<string, { id: string; name: string | null; image: string | null }[]>;
    canTargetAnyArea?: boolean;
    attendanceRouteMode?: "admin" | "dashboard";
}

export default function EventsView({
    events,
    activeSemesterName,
    userRole,
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
    canTargetAnyArea = false,
    attendanceRouteMode = "admin",
}: EventsViewProps) {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [filterMode, setFilterMode] = useState<"upcoming" | "history">("upcoming");
    const [showFilters, setShowFilters] = useState(false);
    const [contextFilter, setContextFilter] = useState<"ALL" | "PROJECT" | "IISE_GENERAL" | "IISE_AREA">("ALL");
    const [typeFilter, setTypeFilter] = useState<"ALL" | "GENERAL" | "INDIVIDUAL_GROUP" | "TREASURY_SPECIAL">("ALL");
    const [modalityFilter, setModalityFilter] = useState<"ALL" | "VIRTUAL" | "PRESENTIAL">("ALL");
    const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // --- Derived State ---
    const nowStr = new Date().toLocaleDateString('en-CA');
    const dateFilteredEvents = events.filter(e => {
        const eventDate = new Date(e.date);
        const eventDateStr = eventDate.toISOString().split('T')[0];
        return filterMode === "upcoming" ? eventDateStr >= nowStr : eventDateStr < nowStr;
    });

    const filteredEvents = dateFilteredEvents.filter((event) => {
        const normalizedType = event.eventType || "GENERAL";

        if (contextFilter === "PROJECT" && event.eventScope !== "PROJECT") return false;
        if (contextFilter === "IISE_GENERAL" && !(event.eventScope === "IISE" && !event.targetAreaId)) return false;
        if (contextFilter === "IISE_AREA" && !(event.eventScope === "IISE" && Boolean(event.targetAreaId))) return false;

        if (typeFilter !== "ALL" && normalizedType !== typeFilter) return false;

        if (modalityFilter === "VIRTUAL" && !event.isVirtual) return false;
        if (modalityFilter === "PRESENTIAL" && event.isVirtual) return false;

        return true;
    });

    const activeFiltersCount = [contextFilter !== "ALL", typeFilter !== "ALL", modalityFilter !== "ALL"].filter(Boolean).length;

    const clearFilters = () => {
        setContextFilter("ALL");
        setTypeFilter("ALL");
        setModalityFilter("ALL");
    };

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
        } catch {
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

                        <button
                            type="button"
                            onClick={() => setShowFilters((prev) => !prev)}
                            className="flex items-center px-4 py-2 bg-white border border-meteorite-200 text-meteorite-700 font-bold rounded-xl hover:bg-meteorite-50 transition-colors shadow-sm h-[42px]"
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Filtrar{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
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
                                canTargetAnyArea={canTargetAnyArea}
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

                {showFilters && (
                    <div className="mb-6 rounded-2xl border border-meteorite-200 bg-white/85 backdrop-blur-sm p-4 shadow-sm">
                        <div className="flex flex-col lg:flex-row gap-3">
                            <div className="flex-1">
                                <label className="block text-[11px] font-black text-meteorite-700 uppercase tracking-wide mb-1">Contexto</label>
                                <select
                                    value={contextFilter}
                                    onChange={(e) => setContextFilter(e.target.value as typeof contextFilter)}
                                    className="w-full px-3 py-2 rounded-xl border border-meteorite-200 bg-white text-sm font-semibold text-meteorite-900"
                                >
                                    <option value="ALL">Todos</option>
                                    <option value="PROJECT">Reuniones de Proyecto</option>
                                    <option value="IISE_GENERAL">IISE General</option>
                                    <option value="IISE_AREA">IISE por Área</option>
                                </select>
                            </div>

                            <div className="flex-1">
                                <label className="block text-[11px] font-black text-meteorite-700 uppercase tracking-wide mb-1">Tipo</label>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                                    className="w-full px-3 py-2 rounded-xl border border-meteorite-200 bg-white text-sm font-semibold text-meteorite-900"
                                >
                                    <option value="ALL">Todos</option>
                                    <option value="GENERAL">General</option>
                                    <option value="INDIVIDUAL_GROUP">Reunión Individual</option>
                                    <option value="TREASURY_SPECIAL">Tesorería Especial</option>
                                </select>
                            </div>

                            <div className="flex-1">
                                <label className="block text-[11px] font-black text-meteorite-700 uppercase tracking-wide mb-1">Modalidad</label>
                                <select
                                    value={modalityFilter}
                                    onChange={(e) => setModalityFilter(e.target.value as typeof modalityFilter)}
                                    className="w-full px-3 py-2 rounded-xl border border-meteorite-200 bg-white text-sm font-semibold text-meteorite-900"
                                >
                                    <option value="ALL">Todas</option>
                                    <option value="VIRTUAL">Virtual</option>
                                    <option value="PRESENTIAL">Presencial</option>
                                </select>
                            </div>

                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="w-full lg:w-auto px-3 py-2 rounded-xl text-sm font-black border border-meteorite-200 text-meteorite-600 hover:bg-meteorite-50"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                                    const attendanceHref = attendanceRouteMode === "dashboard"
                                        ? `/dashboard/attendance/${event.id}`
                                        : `/admin/events/${event.id}/attendance`;

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
                                            attendanceHref={attendanceHref}
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
                                    const attendanceHref = attendanceRouteMode === "dashboard"
                                        ? `/dashboard/attendance/${event.id}`
                                        : `/admin/events/${event.id}/attendance`;

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
                                            attendanceHref={attendanceHref}
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
                                canTargetAnyArea={canTargetAnyArea}
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
    attendanceHref: string;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

function normalizeHexColor(value?: string | null): string | null {
    if (!value) return null;
    const text = value.trim();
    const withHash = text.startsWith("#") ? text : `#${text}`;
    return HEX_COLOR_REGEX.test(withHash) ? withHash : null;
}

function colorToRgba(hex: string | null | undefined, alpha: number): string {
    const normalized = normalizeHexColor(hex) || "#6366F1";
    const clean = normalized.slice(1);
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getEventAccentColor(event?: EventItem): string {
    if (!event) return "#6366F1";
    if (event.eventScope === "PROJECT") {
        return normalizeHexColor(event.targetProjectArea?.color) || normalizeHexColor(event.project?.color) || "#6366F1";
    }
    if (event.targetArea?.isLeadershipArea) {
        return "#f59e0b";
    }
    return normalizeHexColor(event.targetArea?.color) || "#64748b";
}

function getEventTypeLabel(event: EventItem): string | null {
    if (event.eventType === "INDIVIDUAL_GROUP") return "Reunión";
    if (event.eventType === "TREASURY_SPECIAL") return "Tesorería";
    return null;
}

function EventCardGrid({ event, isDeleting, onEdit, onDelete, canEdit, canDelete, canAttendance, attendanceHref }: EventCardProps) {
    const isGeneral = !event.targetArea;
    const isBoard = event.targetArea?.isLeadershipArea === true;
    const accentColor = getEventAccentColor(event);
    const typeLabel = getEventTypeLabel(event);
    const dateObj = new Date(event.date);
    const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' });
    const month = dateObj.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');

    return (
        <div
            className="relative rounded-2xl border p-4 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col h-full overflow-hidden"
            style={{
                borderColor: colorToRgba(accentColor, 0.28),
                backgroundImage: `linear-gradient(180deg, ${colorToRgba(accentColor, 0.1)} 0%, rgba(255,255,255,0.98) 35%)`,
            }}
        >
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: colorToRgba(accentColor, 0.88) }} />

            <div className="flex justify-between items-start gap-2 mb-3">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm text-center py-2 px-3 min-w-[62px]">
                    <span className="block text-[10px] font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                    <span className="block text-2xl font-black text-meteorite-950 leading-none">{day}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {typeLabel && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                            {typeLabel}
                        </span>
                    )}
                    {canAttendance && (event.pendingJustificationCount || 0) > 0 && (
                        <div className="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center border border-amber-200" title={`${event.pendingJustificationCount} justificaciones pendientes de revisión`}>
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></div>
                            {event.pendingJustificationCount}
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-2.5">
                <Tag isGeneral={isGeneral} isBoard={isBoard} areaName={event.targetArea?.name} areaColor={event.targetArea?.color} event={event} />
            </div>

            <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight mobile-title-clamp">{event.title}</h3>

            {event.description && (
                <div className="bg-white/85 border border-white rounded-xl px-3 py-2 mb-3 text-xs text-slate-600 truncate-multi-line">
                    {event.description}
                </div>
            )}

            <div className="space-y-2.5 flex-1 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-meteorite-400 mr-2" />
                    <span className="font-medium">{event.startTime} - {event.endTime}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                    {event.isVirtual ? <Video className="w-4 h-4 text-meteorite-400 mr-2" /> : <MapPin className="w-4 h-4 text-meteorite-400 mr-2" />}
                    <span className="truncate">{event.isVirtual ? "Virtual (Google Meet)" : "Presencial"}</span>
                </div>
                <div className="flex items-center text-sm text-gray-500 mt-2 pt-2 border-t border-gray-100">
                    <div className="w-5 h-5 rounded-full bg-meteorite-100 text-meteorite-700 flex items-center justify-center text-[10px] font-bold mr-2">
                        {event.createdBy?.name?.charAt(0) || "U"}
                    </div>
                    <span className="text-xs">
                        <span className="font-semibold text-gray-700">{event.createdBy?.name || event.createdBy?.role || "Desconocido"}</span>
                    </span>
                </div>
                {(event.eventType === "INDIVIDUAL_GROUP" || event.eventType === "TREASURY_SPECIAL") && event.invitees && event.invitees.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-50">
                        <InviteeAvatars invitees={event.invitees} />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
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
                        <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 bg-meteorite-700 hover:bg-meteorite-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm">
                            <Video className="w-3.5 h-3.5 mr-1" /> Unirse
                        </a>
                    )}
                    {canAttendance && (
                        <Link href={attendanceHref} className="flex items-center px-3 py-2 bg-white border border-meteorite-200 hover:border-meteorite-400 text-meteorite-700 text-xs font-bold rounded-xl transition-all">
                            <Zap className="w-3.5 h-3.5 mr-1 text-meteorite-500" /> Asistencia
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

function EventCardList({ event, isDeleting, onEdit, onDelete, canEdit, canDelete, canAttendance, attendanceHref }: EventCardProps) {
    const isGeneral = !event.targetArea;
    const isBoard = event.targetArea?.isLeadershipArea === true;
    const accentColor = getEventAccentColor(event);
    const typeLabel = getEventTypeLabel(event);
    const dateObj = new Date(event.date);
    const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' });
    const month = dateObj.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '');

    return (
        <div
            className="rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row items-center gap-4 relative overflow-hidden"
            style={{
                borderColor: colorToRgba(accentColor, 0.25),
                backgroundImage: `linear-gradient(105deg, ${colorToRgba(accentColor, 0.1)} 0%, rgba(255,255,255,0.98) 42%)`,
            }}
        >
            <div className="absolute top-0 left-0 w-1 h-full hidden md:block" style={{ backgroundColor: colorToRgba(accentColor, 0.86) }}></div>
            <div className="absolute top-0 left-0 w-full h-1 md:hidden" style={{ backgroundColor: colorToRgba(accentColor, 0.86) }}></div>

            {/* Left: Date */}
            <div className="flex-shrink-0">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm text-center py-2 px-3 w-[70px] h-[70px] flex flex-col justify-center">
                    <span className="block text-[10px] font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                    <span className="block text-2xl font-black text-meteorite-950 leading-none">{day}</span>
                </div>
            </div>

            {/* Center: Info */}
            <div className="flex-1 w-full md:w-auto text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{event.title}</h3>
                    <div className="flex justify-center md:justify-start gap-2 items-center">
                        {typeLabel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                                {typeLabel}
                            </span>
                        )}
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
                    <p className="text-sm text-slate-600 truncate w-full max-w-md hidden md:block mb-1">{event.description}</p>
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
                {(event.eventType === "INDIVIDUAL_GROUP" || event.eventType === "TREASURY_SPECIAL") && event.invitees && event.invitees.length > 0 && (
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
                        <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-meteorite-700 hover:bg-meteorite-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm">
                            Unirse
                        </a>
                    )}
                    {canAttendance && (
                        <Link href={attendanceHref} className="flex items-center px-4 py-2 bg-white border border-meteorite-200 hover:border-meteorite-400 text-meteorite-700 text-xs font-bold rounded-xl transition-all">
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
    const accentColor = getEventAccentColor(event);

    // Scope badge
    if (event?.eventScope === "PROJECT") {
        tags.push(
            <span
                key="scope"
                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border"
                style={{
                    backgroundColor: colorToRgba(accentColor, 0.14),
                    color: accentColor,
                    borderColor: colorToRgba(accentColor, 0.34),
                }}
            >
                Proyecto: {event.project?.name || "General"}
            </span>
        );
    } else if (event?.eventScope === "IISE" && event.targetArea) {
        const areaStyle = getAreaColorStyle(event.targetArea.color);
        tags.push(
            <span key="scope-iise-area" className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border" style={areaStyle}>
                IISE Área
            </span>
        );
    } else if (event?.eventScope === "IISE") {
        tags.push(
            <span key="scope-iise-general" className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border bg-gray-100 text-gray-700 border-gray-200">
                IISE General
            </span>
        );
    }

    if (event?.eventType === "INDIVIDUAL_GROUP") {
        tags.push(
            <span key="type-individual" className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border bg-teal-100 text-teal-700 border-teal-200">
                Reunión Individual
            </span>
        );
    }

    if (event?.eventType === "TREASURY_SPECIAL") {
        tags.push(
            <span key="type-treasury" className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border bg-amber-100 text-amber-700 border-amber-200">
                Tesorería Especial
            </span>
        );
    }

    // Area badge — skip for invitee-targeted event types.
    if (event?.eventType === "INDIVIDUAL_GROUP" || event?.eventType === "TREASURY_SPECIAL") {
        if (event?.eventScope === "PROJECT" && event?.targetProjectArea) {
            const projectAreaColor = normalizeHexColor(event.targetProjectArea.color) || accentColor;
            tags.push(
                <span
                    key="pArea-invitee"
                    className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border"
                    style={{
                        backgroundColor: colorToRgba(projectAreaColor, 0.12),
                        color: projectAreaColor,
                        borderColor: colorToRgba(projectAreaColor, 0.3),
                    }}
                >
                    {event.targetProjectArea.name}
                </span>
            );
        }
    } else if (event?.eventScope === "PROJECT" && event?.targetProjectArea) {
        const projectAreaColor = normalizeHexColor(event.targetProjectArea.color) || accentColor;
        tags.push(
            <span
                key="pArea"
                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border"
                style={{
                    backgroundColor: colorToRgba(projectAreaColor, 0.12),
                    color: projectAreaColor,
                    borderColor: colorToRgba(projectAreaColor, 0.3),
                }}
            >
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
