"use client";

import { useState, useTransition } from "react";
import { X, Save, AlertTriangle, Shield, User as UserIcon } from "lucide-react";
import {
    updateUserRoleAction,
    updateUserDataAction,
    moderateUserAction,
} from "@/server/actions/user.actions";
import { STATUSES, CATEGORIES, ROLES } from "@/lib/validators/user";

type User = {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string | null;
    firstName: string | null;
    lastName: string | null;
    status: string | null;
    currentAreaId: string | null;
    cui: string | null;
    phone: string | null;
    category: string | null;
    moderationReason: string | null;
    suspendedUntil: Date | null;
    currentArea: {
        id: string;
        name: string;
    } | null;
};

type Area = {
    id: string;
    name: string;
    code: string | null;
};

interface UserEditDrawerProps {
    user: User | null;
    areas: Area[];
    isOpen: boolean;
    onClose: () => void;
}

export default function UserEditDrawer({
    user,
    areas,
    isOpen,
    onClose,
}: UserEditDrawerProps) {
    const [activeTab, setActiveTab] = useState<"profile" | "role" | "moderation">("profile");
    const [isPending, startTransition] = useTransition();

    // Local State for Forms
    const [formData, setFormData] = useState<any>({});

    // Reset form when user opens drawer
    if (!isOpen && user && formData.id !== user.id) {
        /* Ideally performed in useEffect when user changes, 
           but for simplicity in this pure component we initialize later */
    }

    if (!isOpen || !user) return null;

    const handleSaveProfile = () => {
        startTransition(async () => {
            const result = await updateUserDataAction({
                userId: user.id,
                cui: formData.cui ?? user.cui,
                phone: formData.phone ?? user.phone,
                category: formData.category ?? user.category ?? "TRAINEE",
            });
            if (result.success) {
                alert("Perfil actualizado correctamente");
                onClose();
            } else {
                alert("Error: " + result.error);
            }
        });
    };

    const handleSaveRole = () => {
        startTransition(async () => {
            const result = await updateUserRoleAction({
                userId: user.id,
                role: formData.role ?? user.role,
                areaId: formData.areaId ?? user.currentAreaId, // Can be null
                reason: formData.reason,
            });
            if (result.success) {
                alert("Jerarquía actualizada correctamete");
                onClose();
            } else {
                alert("Error: " + result.error);
            }
        });
    };

    const handleSaveModeration = () => {
        startTransition(async () => {
            const result = await moderateUserAction({
                userId: user.id,
                status: formData.status ?? user.status,
                moderationReason: formData.moderationReason,
                suspendedUntil: formData.suspendedUntil ? new Date(formData.suspendedUntil) : undefined,
            });

            if (result.success) {
                alert("Estado de moderación actualizado");
                onClose();
            } else {
                alert("Error: " + result.error);
            }
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Drawer Panel */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">

                {/* Header */}
                <div className="px-6 py-4 border-b border-meteorite-100 flex justify-between items-center bg-meteorite-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-meteorite-900">
                            Editar Usuario
                        </h2>
                        <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-red-500 transition-colors bg-white p-2 rounded-full border border-gray-100 shadow-sm"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-meteorite-100">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-meteorite-500 text-meteorite-600 bg-meteorite-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <UserIcon className="w-4 h-4 inline mr-2" />
                        Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab("role")}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'role' ? 'border-meteorite-500 text-meteorite-600 bg-meteorite-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <Shield className="w-4 h-4 inline mr-2" />
                        Jerarquía
                    </button>
                    <button
                        onClick={() => setActiveTab("moderation")}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'moderation' ? 'border-red-500 text-red-600 bg-red-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <AlertTriangle className="w-4 h-4 inline mr-2" />
                        Moderación
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* --- Tab: Profile --- */}
                    {activeTab === "profile" && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 uppercase tracking-wide mb-1.5 align-middle">
                                    CUI / Matrícula
                                </label>
                                <input
                                    type="text"
                                    maxLength={8}
                                    className="w-full rounded-xl border border-meteorite-200 bg-white px-4 py-2.5 text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 focus:outline-none transition-all shadow-sm font-medium"
                                    defaultValue={user.cui || ""}
                                    placeholder="Ej. 20210001"
                                    onChange={(e) => setFormData({ ...formData, cui: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 uppercase tracking-wide mb-1.5">
                                    Teléfono
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-meteorite-200 bg-white px-4 py-2.5 text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 focus:outline-none transition-all shadow-sm font-medium"
                                    defaultValue={user.phone || ""}
                                    placeholder="+51 999 999 999"
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 uppercase tracking-wide mb-1.5">
                                    Categoría
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none rounded-xl border border-meteorite-200 bg-white px-4 py-2.5 text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 focus:outline-none transition-all shadow-sm font-medium cursor-pointer"
                                        defaultValue={user.category || "TRAINEE"}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-meteorite-500">
                                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isPending}
                                className="w-full mt-4 flex justify-center items-center gap-2 rounded-xl bg-meteorite-600 px-6 py-3 font-bold text-white hover:bg-meteorite-700 disabled:opacity-50 shadow-md shadow-meteorite-600/20 active:scale-95 transition-all"
                            >
                                <Save className="w-4 h-4" /> Guardar Perfil
                            </button>
                        </div>
                    )}

                    {/* --- Tab: Role --- */}
                    {activeTab === "role" && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl text-xs flex gap-3 items-start">
                                <Shield className="w-5 h-5 text-blue-600 shrink-0" />
                                <div>
                                    <strong className="block font-bold text-blue-900 mb-0.5">Control de Jerarquía</strong>
                                    Los cambios de jerarquía afectarán los permisos del usuario en el sistema.
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 uppercase tracking-wide mb-1.5">
                                    Rol Principal
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none rounded-xl border border-meteorite-200 bg-white px-4 py-2.5 text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 focus:outline-none transition-all shadow-sm font-medium cursor-pointer"
                                        defaultValue={user.role || "Voluntario"}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        {ROLES.filter(r => r !== "DEV").map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-meteorite-500">
                                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 uppercase tracking-wide mb-1.5">
                                    Área Asignada
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none rounded-xl border border-meteorite-200 bg-white px-4 py-2.5 text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 focus:outline-none transition-all shadow-sm font-medium cursor-pointer"
                                        defaultValue={user.currentAreaId || ""}
                                        onChange={(e) => setFormData({ ...formData, areaId: e.target.value === "" ? null : e.target.value })}
                                    >
                                        <option value="">-- Sin Área --</option>
                                        {areas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name} ({area.code})</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-meteorite-500">
                                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 uppercase tracking-wide mb-1.5">
                                    Razón (Opcional)
                                </label>
                                <textarea
                                    className="w-full rounded-xl border border-meteorite-200 bg-white px-4 py-2.5 text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 focus:outline-none transition-all shadow-sm font-medium"
                                    placeholder="Ej: Ascenso por mérito..."
                                    rows={2}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                ></textarea>
                            </div>
                            <button
                                onClick={handleSaveRole}
                                disabled={isPending}
                                className="w-full mt-4 flex justify-center items-center gap-2 rounded-xl bg-meteorite-600 px-6 py-3 font-bold text-white hover:bg-meteorite-700 disabled:opacity-50 shadow-md shadow-meteorite-600/20 active:scale-95 transition-all"
                            >
                                <Save className="w-4 h-4" /> Aplicar Jerarquía
                            </button>
                        </div>
                    )}

                    {/* --- Tab: Moderation --- */}
                    {activeTab === "moderation" && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl text-xs flex gap-3 items-start">
                                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                <div>
                                    <strong className="block font-bold text-red-900 mb-0.5">Zona de Moderación</strong>
                                    Estas acciones restringirán el acceso del usuario. Úselas con precaución.
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5">
                                    Estado del Usuario
                                </label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none rounded-xl border border-red-200 bg-white px-4 py-2.5 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-all shadow-sm font-medium cursor-pointer"
                                        defaultValue={user.status || "ACTIVE"}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-red-500">
                                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Date Picker for Suspension */}
                            {(formData.status === "SUSPENDED" || (user.status === "SUSPENDED" && !formData.status)) && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5">
                                        Suspender hasta
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-all shadow-sm font-medium"
                                        defaultValue={
                                            user.suspendedUntil ? new Date(user.suspendedUntil).toISOString().split('T')[0] : ""
                                        }
                                        onChange={(e) => setFormData({ ...formData, suspendedUntil: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5">
                                    Justificación (Obligatoria)
                                </label>
                                <textarea
                                    className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-all shadow-sm font-medium"
                                    placeholder="Explique el motivo de la sanción..."
                                    rows={3}
                                    defaultValue={user.moderationReason || ""}
                                    onChange={(e) => setFormData({ ...formData, moderationReason: e.target.value })}
                                ></textarea>
                            </div>
                            <button
                                onClick={handleSaveModeration}
                                disabled={isPending}
                                className="w-full mt-4 flex justify-center items-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50 shadow-md shadow-red-600/20 active:scale-95 transition-all"
                            >
                                <AlertTriangle className="w-4 h-4" /> Confirmar Estado
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>,
        document.body
    );
}

import { createPortal } from "react-dom";
