"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Shield, Users, X, Check, Lock } from "lucide-react";
import {
    createCustomRoleAction,
    updateCustomRoleAction,
    deleteCustomRoleAction,
} from "@/server/actions/custom-role.actions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomRole {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    position: number | null;
    isSystem: boolean | null;
    createdAt: Date | null;
    permissions: { id: string; permission: string }[];
    userAssignments: {
        user: { id: string; name: string | null; image: string | null; role: string | null };
    }[];
}

interface Props {
    initialRoles: CustomRole[];
    permissionGroups: Record<string, string[]>;
}

// ─── Permission label map ────────────────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
    "event:create_general": "Crear eventos generales (IISE)",
    "event:create_area_own": "Crear eventos en área propia",
    "event:create_area_any": "Crear eventos en cualquier área",
    "event:create_meeting": "Crear reuniones individuales/grupales",
    "event:manage_own": "Gestionar eventos permitidos",
    "event:manage_all": "Gestionar todos los eventos",
    "attendance:take_own_area": "Pasar asistencia en área propia",
    "attendance:take_all": "Pasar asistencia global",
    "attendance:review_own_area": "Revisar justificaciones de área propia",
    "attendance:review_all": "Revisar justificaciones globales",
    "grade:assign_own_area": "Asignar calificaciones en área propia",
    "grade:assign_all": "Asignar calificaciones globales",
    "grade:view_own_area": "Ver hoja de calificaciones de área propia",
    "grade:view_all": "Ver hoja de calificaciones global",
    "pillar:manage": "Gestionar pilares",
    "semester:manage": "Gestionar ciclos",
    "user:approve": "Aprobar/rechazar solicitudes",
    "user:manage_role": "Gestionar rol y área de usuarios",
    "user:manage_data": "Editar datos de usuarios",
    "user:moderate": "Moderar usuarios (ban/suspend/warn)",
    "user:manage": "Gestionar usuarios (legacy)",
    "area:manage": "Gestionar áreas",
    "project:create": "Crear proyectos",
    "project:manage": "Gestionar proyectos",
    "admin:access": "Acceso al panel admin",
    "admin:full": "Admin completo (CRUD roles)",
    "dashboard:area_comparison": "Ver comparación de áreas",
    "dashboard:leadership_view": "Vista de liderazgo",
};

const DOMAIN_LABELS: Record<string, string> = {
    event: "📅 Eventos",
    attendance: "📝 Asistencia",
    grade: "📊 Calificaciones",
    pillar: "🎯 Pilares",
    semester: "📆 Ciclos",
    area: "🗂️ Áreas",
    project: "📁 Proyectos",
    admin: "🔒 Administración",
    dashboard: "📈 Dashboard",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomRoleManager({ initialRoles, permissionGroups }: Props) {
    const [roles, setRoles] = useState<CustomRole[]>(initialRoles);
    const [showForm, setShowForm] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
    const [isPending, startTransition] = useTransition();

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState("#6366f1");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const resetForm = () => {
        setName("");
        setDescription("");
        setColor("#6366f1");
        setSelectedPermissions([]);
        setEditingRole(null);
        setShowForm(false);
    };

    const openEdit = (role: CustomRole) => {
        setEditingRole(role);
        setName(role.name);
        setDescription(role.description || "");
        setColor(role.color || "#6366f1");
        setSelectedPermissions(role.permissions.map(p => p.permission));
        setShowForm(true);
    };

    const togglePermission = (perm: string) => {
        setSelectedPermissions(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    const handleSubmit = () => {
        if (!name.trim() || selectedPermissions.length === 0) {
            showFeedback("error", "Nombre y al menos un permiso son requeridos.");
            return;
        }

        startTransition(async () => {
            try {
                if (editingRole) {
                    const result = await updateCustomRoleAction({
                        id: editingRole.id,
                        name,
                        description: description || null,
                        color,
                        position: 0,
                        permissions: selectedPermissions,
                    });
                    if (result.success) {
                        showFeedback("success", "Rol actualizado.");
                        // Update local state
                        setRoles(prev => prev.map(r =>
                            r.id === editingRole.id
                                ? { ...r, name, description, color, permissions: selectedPermissions.map(p => ({ id: "", permission: p })) }
                                : r
                        ));
                        resetForm();
                    } else {
                        showFeedback("error", result.message || "Error al actualizar.");
                    }
                } else {
                    const result = await createCustomRoleAction({
                        name,
                        description: description || null,
                        color,
                        position: 0,
                        permissions: selectedPermissions,
                    });
                    if (result.success) {
                        showFeedback("success", "Rol creado exitosamente.");
                        resetForm();
                        // Refresh — ideally we'd revalidate, but since this is optimistic:
                        window.location.reload();
                    } else {
                        showFeedback("error", result.error || "Error al crear.");
                    }
                }
            } catch (error) {
                showFeedback("error", "Error inesperado.");
            }
        });
    };

    const handleDelete = (roleId: string, roleName: string) => {
        if (!confirm(`¿Eliminar el rol "${roleName}"? Los usuarios perderán estos permisos.`)) return;

        startTransition(async () => {
            const result = await deleteCustomRoleAction(roleId);
            if (result.success) {
                showFeedback("success", "Rol eliminado.");
                setRoles(prev => prev.filter(r => r.id !== roleId));
            } else {
                showFeedback("error", result.error || "Error al eliminar.");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Feedback */}
            {feedback && (
                <div className={`p-4 rounded-xl text-sm font-medium border transition-all ${feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                    {feedback.message}
                </div>
            )}

            {/* Roles List */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {roles.map(role => (
                    <div
                        key={role.id}
                        className="bg-white rounded-2xl border border-meteorite-100 shadow-sm hover:shadow-md transition-all p-5"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                                    style={{ backgroundColor: role.color || "#6366f1" }}
                                >
                                    <Shield className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-meteorite-900 text-lg">{role.name}</h3>
                                    {role.description && (
                                        <p className="text-meteorite-500 text-xs mt-0.5">{role.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openEdit(role)}
                                    className="p-1.5 rounded-lg text-meteorite-400 hover:text-meteorite-700 hover:bg-meteorite-50 transition-all"
                                    title="Editar"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                {!role.isSystem && (
                                    <button
                                        onClick={() => handleDelete(role.id, role.name)}
                                        className="p-1.5 rounded-lg text-meteorite-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                        title="Eliminar"
                                        disabled={isPending}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                {role.isSystem && (
                                    <div className="p-1.5" title="Rol del sistema — no eliminable">
                                        <Lock className="w-4 h-4 text-meteorite-300" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Permissions badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {role.permissions.map(p => (
                                <span
                                    key={p.id || p.permission}
                                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-meteorite-100 text-meteorite-600"
                                >
                                    {PERMISSION_LABELS[p.permission] || p.permission}
                                </span>
                            ))}
                        </div>

                        {/* Users count */}
                        <div className="flex items-center gap-1.5 text-meteorite-400 text-xs">
                            <Users className="w-3.5 h-3.5" />
                            <span>{role.userAssignments.length} usuario{role.userAssignments.length !== 1 ? "s" : ""}</span>
                        </div>
                    </div>
                ))}

                {/* Add New Role Card */}
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-white/50 rounded-2xl border-2 border-dashed border-meteorite-200 p-5 flex flex-col items-center justify-center gap-3 hover:bg-white hover:border-violet-300 transition-all min-h-[160px] group"
                >
                    <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-all">
                        <Plus className="w-6 h-6 text-violet-600" />
                    </div>
                    <span className="text-sm font-semibold text-meteorite-500 group-hover:text-violet-600 transition-colors">
                        Crear nuevo rol
                    </span>
                </button>
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-meteorite-100">
                            <h3 className="text-xl font-black text-meteorite-900">
                                {editingRole ? "Editar Rol" : "Crear Nuevo Rol"}
                            </h3>
                            <button
                                onClick={resetForm}
                                className="p-2 rounded-xl hover:bg-meteorite-100 transition-all"
                            >
                                <X className="w-5 h-5 text-meteorite-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-meteorite-700 mb-1.5">
                                    Nombre del Rol
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej: Director de Proyectos"
                                    className="w-full px-4 py-2.5 border border-meteorite-200 rounded-xl focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none transition-all text-meteorite-900"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-meteorite-700 mb-1.5">
                                    Descripción <span className="font-normal text-meteorite-400">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Ej: Puede crear y administrar proyectos"
                                    className="w-full px-4 py-2.5 border border-meteorite-200 rounded-xl focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none transition-all text-meteorite-900"
                                />
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-sm font-bold text-meteorite-700 mb-1.5">
                                    Color del Badge
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="w-10 h-10 rounded-xl cursor-pointer border border-meteorite-200"
                                    />
                                    <div
                                        className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
                                        style={{ backgroundColor: color }}
                                    >
                                        {name || "Preview"}
                                    </div>
                                </div>
                            </div>

                            {/* Permissions */}
                            <div>
                                <label className="block text-sm font-bold text-meteorite-700 mb-3">
                                    Permisos ({selectedPermissions.length} seleccionados)
                                </label>
                                <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                                    {Object.entries(permissionGroups).map(([domain, perms]) => (
                                        <div key={domain}>
                                            <h4 className="text-xs font-bold text-meteorite-500 uppercase tracking-wider mb-2">
                                                {DOMAIN_LABELS[domain] || domain}
                                            </h4>
                                            <div className="space-y-1">
                                                {perms.map(perm => (
                                                    <label
                                                        key={perm}
                                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${selectedPermissions.includes(perm)
                                                            ? "bg-violet-50 border border-violet-200"
                                                            : "hover:bg-meteorite-50 border border-transparent"
                                                            }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedPermissions.includes(perm)
                                                            ? "bg-violet-500 border-violet-500"
                                                            : "border-meteorite-300"
                                                            }`}>
                                                            {selectedPermissions.includes(perm) && (
                                                                <Check className="w-3 h-3 text-white" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-medium text-meteorite-800">
                                                                {PERMISSION_LABELS[perm] || perm}
                                                            </span>
                                                            <span className="text-xs text-meteorite-400 ml-2">{perm}</span>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPermissions.includes(perm)}
                                                            onChange={() => togglePermission(perm)}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-meteorite-100">
                            <button
                                onClick={resetForm}
                                className="px-5 py-2.5 text-sm font-semibold text-meteorite-600 hover:bg-meteorite-100 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isPending || !name.trim() || selectedPermissions.length === 0}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-200"
                            >
                                {isPending ? "Guardando..." : editingRole ? "Actualizar" : "Crear Rol"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
