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

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
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
                        <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-red-500 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-meteorite-100">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profile' ? 'border-meteorite-500 text-meteorite-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <UserIcon className="w-4 h-4 inline mr-2" />
                        Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab("role")}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'role' ? 'border-meteorite-500 text-meteorite-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Shield className="w-4 h-4 inline mr-2" />
                        Jerarquía
                    </button>
                    <button
                        onClick={() => setActiveTab("moderation")}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'moderation' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <AlertTriangle className="w-4 h-4 inline mr-2" />
                        Moderación
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* --- Tab: Profile --- */}
                    {activeTab === "profile" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    CUI (Código Universitario)
                                </label>
                                <input
                                    type="text"
                                    maxLength={8}
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-meteorite-500 focus-visible:outline-none"
                                    defaultValue={user.cui || ""}
                                    onChange={(e) => setFormData({ ...formData, cui: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Teléfono
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-meteorite-500 focus-visible:outline-none"
                                    defaultValue={user.phone || ""}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Categoría
                                </label>
                                <select
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-meteorite-500 focus-visible:outline-none"
                                    defaultValue={user.category || "TRAINEE"}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isPending}
                                className="w-full mt-4 flex justify-center items-center gap-2 rounded bg-meteorite-600 px-6 py-2.5 font-medium text-white hover:bg-meteorite-700 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" /> Guardar Perfil
                            </button>
                        </div>
                    )}

                    {/* --- Tab: Role --- */}
                    {activeTab === "role" && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs">
                                <strong className="font-bold">Nota:</strong> Los cambios de jerarquía se registran en el historial oficial del usuario.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rol Principal
                                </label>
                                <select
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-meteorite-500 focus-visible:outline-none"
                                    defaultValue={user.role || "Voluntario"}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Área Asignada
                                </label>
                                <select
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-meteorite-500 focus-visible:outline-none"
                                    defaultValue={user.currentAreaId || ""}
                                    onChange={(e) => setFormData({ ...formData, areaId: e.target.value === "" ? null : e.target.value })}
                                >
                                    <option value="">-- Sin Área --</option>
                                    {areas.map(area => (
                                        <option key={area.id} value={area.id}>{area.name} ({area.code})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Directores y Subdirectores requieren un área obligatoria.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Motivo del Cambio (Opcional)
                                </label>
                                <textarea
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-meteorite-500 focus-visible:outline-none"
                                    placeholder="Ej: Ascenso por mérito..."
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                ></textarea>
                            </div>
                            <button
                                onClick={handleSaveRole}
                                disabled={isPending}
                                className="w-full mt-4 flex justify-center items-center gap-2 rounded bg-meteorite-600 px-6 py-2.5 font-medium text-white hover:bg-meteorite-700 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" /> Aplicar Cambio de Jerarquía
                            </button>
                        </div>
                    )}

                    {/* --- Tab: Moderation --- */}
                    {activeTab === "moderation" && (
                        <div className="space-y-4">
                            <div className="bg-red-50 text-red-800 p-3 rounded-lg text-xs">
                                <strong className="font-bold">Atención:</strong> Estas acciones pueden restringir el acceso del usuario al sistema.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Estado del Usuario
                                </label>
                                <select
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-red-500 focus-visible:outline-none"
                                    defaultValue={user.status || "ACTIVE"}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Date Picker for Suspension */}
                            {(formData.status === "SUSPENDED" || (user.status === "SUSPENDED" && !formData.status)) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Suspender hasta
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-red-500 focus-visible:outline-none"
                                        defaultValue={
                                            user.suspendedUntil ? new Date(user.suspendedUntil).toISOString().split('T')[0] : ""
                                        }
                                        onChange={(e) => setFormData({ ...formData, suspendedUntil: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]} // Prevent past dates
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        El usuario no podrá acceder hasta esta fecha.
                                    </p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Justificación (Obligatoria)
                                </label>
                                <textarea
                                    className="w-full rounded-xl border border-meteorite-200 bg-meteorite-50/30 px-3 py-2 text-black focus:border-red-500 focus-visible:outline-none"
                                    placeholder="Explique la razón de la sanción o reactivación..."
                                    defaultValue={user.moderationReason || ""}
                                    onChange={(e) => setFormData({ ...formData, moderationReason: e.target.value })}
                                ></textarea>
                            </div>
                            <button
                                onClick={handleSaveModeration}
                                disabled={isPending}
                                className="w-full mt-4 flex justify-center items-center gap-2 rounded bg-red-600 px-6 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                <AlertTriangle className="w-4 h-4" /> Guardar Estado
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
