"use client";

import {
    User as UserIcon,
    Mail,
    Phone,
    CalendarDays,
    Award,
    Shield,
    Briefcase,
    Clock,
    MapPin,
    Hash
} from "lucide-react";
import { format } from "date-fns";
import { UserAvatar } from "@/components/ui/user-avatar";
import { es } from "date-fns/locale";

interface UserProfileProps {
    userProfile: any;
}

export default function UserProfileView({ userProfile }: UserProfileProps) {
    // Helper to format dates
    const formatDate = (date: any) => {
        if (!date) return "N/A";
        return format(new Date(date), "dd MMMM yyyy", { locale: es });
    };

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-40 -left-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

            <div className="relative z-10 max-w-5xl mx-auto space-y-6">

                {/* 1. Header (Cover & Avatar) */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-xl shadow-meteorite-900/5">
                    {/* Cover Photo Area */}
                    <div className="h-32 md:h-48 bg-gradient-to-r from-meteorite-600 via-violet-500 to-indigo-600 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm mix-blend-overlay"></div>
                    </div>

                    {/* Profile Information Area */}
                    <div className="px-6 md:px-10 pb-8 relative">
                        {/* Avatar */}
                        <div className="relative -mt-16 md:-mt-24 mb-4 flex justify-between items-end">
                            <div className="relative">
                                <UserAvatar
                                    src={userProfile.image}
                                    name={userProfile.name}
                                    alt={userProfile.name}
                                    className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl bg-white"
                                    fallbackClassName="bg-meteorite-100"
                                    fallbackIcon={<UserIcon className="w-16 h-16 text-meteorite-400" />}
                                />
                            </div>

                            {/* Main Role Badge */}
                            <div className="hidden md:flex bg-meteorite-100/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-meteorite-200 items-center gap-2 shadow-sm">
                                <Shield className="w-5 h-5 text-meteorite-600" />
                                <span className="font-bold text-meteorite-800 tracking-wide">{userProfile.role}</span>
                            </div>
                        </div>

                        {/* Name and Basic Info */}
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-meteorite-950 mb-2">
                                    {userProfile.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-meteorite-600 font-medium">
                                    <span className="flex items-center gap-1.5 bg-white/50 px-3 py-1.5 rounded-xl border border-meteorite-100">
                                        <Mail className="w-4 h-4 text-meteorite-500" />
                                        {userProfile.email}
                                    </span>
                                    {userProfile.currentArea && (
                                        <span className="flex items-center gap-1.5 bg-white/50 px-3 py-1.5 rounded-xl border border-meteorite-100">
                                            <MapPin className="w-4 h-4 text-meteorite-500" />
                                            {userProfile.currentArea.name} ({userProfile.currentArea.code})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Details & Roles */}
                    <div className="md:col-span-1 space-y-6">
                        {/* Identidad Card */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-meteorite-900/5">
                            <h2 className="text-xl font-bold text-meteorite-950 mb-6 flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-meteorite-500" />
                                Información Personal
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-meteorite-50 rounded-xl text-meteorite-600">
                                        <Hash className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-meteorite-400 uppercase tracking-wider">CUI</p>
                                        <p className="font-semibold text-meteorite-800">{userProfile.cui || "No registrado"}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-meteorite-50 rounded-xl text-meteorite-600">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-meteorite-400 uppercase tracking-wider">Teléfono</p>
                                        <p className="font-semibold text-meteorite-800">{userProfile.phone || "No registrado"}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-meteorite-50 rounded-xl text-meteorite-600">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-meteorite-400 uppercase tracking-wider">Miembro desde</p>
                                        <p className="font-semibold text-meteorite-800 capitalize">{formatDate(userProfile.joinedAt)}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-meteorite-50 rounded-xl text-meteorite-600">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-meteorite-400 uppercase tracking-wider">Categoría</p>
                                        <p className="font-semibold text-meteorite-800">{userProfile.category}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Roles Múltiples (Sub-Roles) Card */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-meteorite-900/5">
                            <h2 className="text-xl font-bold text-meteorite-950 mb-6 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-meteorite-500" />
                                Roles y Permisos
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-meteorite-400 uppercase tracking-wider mb-2">Rol del Sistema Principal</p>
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-meteorite-100 text-meteorite-700 border border-meteorite-200">
                                        {userProfile.role}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-meteorite-400 uppercase tracking-wider mb-3">Roles Adicionales (Sub-roles)</p>
                                    {userProfile.customRoles && userProfile.customRoles.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {userProfile.customRoles.map((ur: any) => (
                                                <div
                                                    key={ur.customRole.id}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold shadow-sm"
                                                    style={{
                                                        backgroundColor: `${ur.customRole.color}10`,
                                                        color: ur.customRole.color,
                                                        borderColor: `${ur.customRole.color}30`
                                                    }}
                                                >
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ur.customRole.color }}></span>
                                                    {ur.customRole.name}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-meteorite-500 italic bg-meteorite-50/50 p-3 rounded-xl border border-gray-100">
                                            Sin roles adicionales por el momento.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: History */}
                    <div className="md:col-span-2">
                        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-meteorite-900/5 h-full">
                            <h2 className="text-xl font-bold text-meteorite-950 mb-6 flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-meteorite-500" />
                                Historial de Cargos
                            </h2>

                            {userProfile.positionHistory && userProfile.positionHistory.length > 0 ? (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-meteorite-200 before:to-transparent">
                                    {userProfile.positionHistory.map((historyItem: any, index: number) => (
                                        <div key={historyItem.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">

                                            {/* Icon Marker */}
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-meteorite-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                                <Briefcase className="w-4 h-4" />
                                            </div>

                                            {/* Content Card */}
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-meteorite-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between space-x-2 mb-2">
                                                    <div className="font-bold text-meteorite-900">{historyItem.role}</div>
                                                    <time className="text-xs font-medium text-meteorite-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDate(historyItem.startDate)}
                                                    </time>
                                                </div>

                                                <div className="flex flex-col gap-1 text-sm text-meteorite-600">
                                                    {historyItem.area && (
                                                        <span className="font-medium bg-meteorite-50 px-2 py-0.5 rounded w-fit">
                                                            {historyItem.area.name} ({historyItem.area.code})
                                                        </span>
                                                    )}
                                                    {historyItem.semester && (
                                                        <span className="text-xs text-meteorite-400">
                                                            Ciclo: {historyItem.semester.name}
                                                        </span>
                                                    )}
                                                    {historyItem.endDate ? (
                                                        <span className="text-xs italic mt-1">
                                                            Finalizó: {formatDate(historyItem.endDate)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs italic font-medium text-green-600 mt-1">
                                                            Cargo Actual
                                                        </span>
                                                    )}
                                                </div>

                                                {historyItem.reason && (
                                                    <p className="mt-2 text-sm text-meteorite-600 border-t border-meteorite-50 pt-2 line-clamp-2">
                                                        "{historyItem.reason}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center bg-meteorite-50/50 rounded-2xl border border-dashed border-meteorite-200 h-64">
                                    <Clock className="w-12 h-12 text-meteorite-300 mb-4" />
                                    <h3 className="text-meteorite-800 font-bold mb-1">Sin Historial Registrado</h3>
                                    <p className="text-sm text-meteorite-500 max-w-sm">
                                        El historial de cargos de este usuario se construirá conforme se le asignen o transfieran puestos en los diferentes ciclos.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
