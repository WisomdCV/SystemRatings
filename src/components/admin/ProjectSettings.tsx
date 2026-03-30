"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    createProjectAreaAction, updateProjectAreaAction, deleteProjectAreaAction, reorderProjectAreasAction,
    createProjectRoleAction, updateProjectRoleAction, deleteProjectRoleAction, reorderProjectRolesAction
} from "@/server/actions/project-settings.actions";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
    Plus, Loader2, GripVertical, Trash2, Edit2,
    Save, X, ShieldAlert, CheckCircle2, AlertCircle, LayoutGrid, Users, ListChecks,
    CalendarCheck, Eye, EyeOff, Shield, UserCog, FolderKanban, Info
} from "lucide-react";

interface Area {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    position: number | null;
    isSystem: boolean | null;
}

interface RolePermission {
    id: string;
    permission: string;
    projectRoleId: string;
}

interface Role {
    id: string;
    name: string;
    description: string | null;
    hierarchyLevel: number;
    displayOrder?: number;
    color: string | null;
    isSystem: boolean | null;
    permissions: RolePermission[];
}

interface Props {
    initialAreas: Area[];
    initialRoles: Role[];
}

/** Permission display labels */
const PERMISSION_LABELS: Record<string, { label: string; group: string; icon: "event" | "task" | "manage" | "visibility" }> = {
    "project:event_create_any": { label: "Crear eventos (cualquier área)", group: "Eventos", icon: "event" },
    "project:event_create_own_area": { label: "Crear eventos (su área)", group: "Eventos", icon: "event" },
    "project:event_manage_any": { label: "Gestionar cualquier evento", group: "Eventos", icon: "event" },
    "project:event_manage_own": { label: "Gestionar eventos propios/área", group: "Eventos", icon: "event" },
    "project:event_view_all": { label: "Ver eventos de todas las áreas", group: "Eventos", icon: "visibility" },
    "project:task_create_any": { label: "Crear tareas (cualquier área)", group: "Tareas", icon: "task" },
    "project:task_create_own_area": { label: "Crear tareas (su área)", group: "Tareas", icon: "task" },
    "project:task_manage_any": { label: "Gestionar cualquier tarea", group: "Tareas", icon: "task" },
    "project:task_manage_own": { label: "Gestionar tareas propias/área", group: "Tareas", icon: "task" },
    "project:task_assign": { label: "Asignar miembros a tareas", group: "Tareas", icon: "task" },
    "project:task_update_status": { label: "Actualizar estado de tareas", group: "Tareas", icon: "task" },
    "project:manage_settings": { label: "Editar configuración del proyecto", group: "Gestión", icon: "manage" },
    "project:manage_members": { label: "Gestionar miembros", group: "Gestión", icon: "manage" },
    "project:manage_status": { label: "Cambiar estado del proyecto", group: "Gestión", icon: "manage" },
    "project:delete": { label: "Eliminar proyecto", group: "Gestión", icon: "manage" },
    "project:view_all_areas": { label: "Ver contenido de todas las áreas", group: "Visibilidad", icon: "visibility" },
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);
const PERMISSION_GROUPS = ["Eventos", "Tareas", "Gestión", "Visibilidad"];

function getGroupIcon(group: string) {
    switch (group) {
        case "Eventos": return <CalendarCheck className="w-3 h-3" />;
        case "Tareas": return <ListChecks className="w-3 h-3" />;
        case "Gestión": return <UserCog className="w-3 h-3" />;
        case "Visibilidad": return <Eye className="w-3 h-3" />;
        default: return null;
    }
}

export default function ProjectSettings({ initialAreas, initialRoles }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<"AREAS" | "ROLES">("ROLES");

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const [areas, setAreas] = useState<Area[]>(initialAreas);
    const [roles, setRoles] = useState<Role[]>(initialRoles);

    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const [editingArea, setEditingArea] = useState<Area | null>(null);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [editingPermissions, setEditingPermissions] = useState<string[]>([]);

    const [newArea, setNewArea] = useState({ name: "", description: "", color: "#94a3b8" });
    const [newRole, setNewRole] = useState({ name: "", description: "", color: "#6366f1" });
    const [isCreatingArea, setIsCreatingArea] = useState(false);
    const [isCreatingRole, setIsCreatingRole] = useState(false);

    useEffect(() => { setAreas(initialAreas); }, [initialAreas]);
    useEffect(() => { setRoles(initialRoles); }, [initialRoles]);

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const startEditingRole = (role: Role) => {
        setEditingRole(role);
        setEditingPermissions(role.permissions.map(p => p.permission));
    };

    const togglePermission = (perm: string) => {
        setEditingPermissions(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    // ==========================================
    // DRAG AND DROP HANDLERS
    // ==========================================

    const onDragEndRoles = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(roles);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setRoles(items);

        startTransition(async () => {
            const res = await reorderProjectRolesAction(items.map(r => r.id));
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else { showFeedback("error", res.error!); setRoles(initialRoles); }
        });
    };

    const onDragEndAreas = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(areas);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setAreas(items);

        startTransition(async () => {
            const res = await reorderProjectAreasAction(items.map(a => a.id));
            if (res.success) { router.refresh(); }
            else { setAreas(initialAreas); }
        });
    };

    // ==========================================
    // CRUD AREAS
    // ==========================================

    const handleCreateArea = () => {
        startTransition(async () => {
            const res = await createProjectAreaAction(newArea);
            if (res.success) {
                showFeedback("success", res.message!);
                setIsCreatingArea(false);
                setNewArea({ name: "", description: "", color: "#94a3b8" });
                router.refresh();
            } else showFeedback("error", res.error!);
        });
    };

    const handleUpdateArea = () => {
        if (!editingArea) return;
        startTransition(async () => {
            const payload = {
                name: editingArea.name,
                description: editingArea.description || undefined,
                color: editingArea.color || "#94a3b8",
            };
            const res = await updateProjectAreaAction(editingArea.id, payload);
            if (res.success) { showFeedback("success", res.message!); setEditingArea(null); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleDeleteArea = (id: string, name: string) => {
        if (!confirm(`¿Eliminar área "${name}"?`)) return;
        startTransition(async () => {
            const res = await deleteProjectAreaAction(id);
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    // ==========================================
    // CRUD ROLES
    // ==========================================

    const handleCreateRole = () => {
        startTransition(async () => {
            const res = await createProjectRoleAction(newRole);
            if (res.success) {
                showFeedback("success", res.message!);
                setIsCreatingRole(false);
                setNewRole({ name: "", description: "", color: "#6366f1" });
                router.refresh();
            } else showFeedback("error", res.error!);
        });
    };

    const handleUpdateRole = () => {
        if (!editingRole) return;
        startTransition(async () => {
            const payload = {
                name: editingRole.name,
                description: editingRole.description || undefined,
                color: editingRole.color || "#6366f1",
                hierarchyLevel: editingRole.hierarchyLevel,
                permissions: editingPermissions,
            };
            const res = await updateProjectRoleAction(editingRole.id, payload);
            if (res.success) { showFeedback("success", res.message!); setEditingRole(null); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleDeleteRole = (id: string, name: string) => {
        if (!confirm(`¿Eliminar rol "${name}"?`)) return;
        startTransition(async () => {
            const res = await deleteProjectRoleAction(id);
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    if (!isMounted) return <div className="p-8 text-center text-meteorite-500 font-bold"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

    /** Render a compact summary of a role's permissions */
    const renderPermissionSummary = (role: Role) => {
        const perms = role.permissions.map(p => p.permission);
        const counts: Record<string, number> = {};
        for (const group of PERMISSION_GROUPS) {
            const groupPerms = ALL_PERMISSIONS.filter(p => PERMISSION_LABELS[p].group === group);
            const active = groupPerms.filter(p => perms.includes(p)).length;
            counts[group] = active;
        }

        return (
            <div className="mt-2 flex flex-wrap gap-1.5">
                {PERMISSION_GROUPS.map(group => {
                    const total = ALL_PERMISSIONS.filter(p => PERMISSION_LABELS[p].group === group).length;
                    const active = counts[group];
                    const isActive = active > 0;
                    const isFull = active === total;

                    return (
                        <span key={group}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isFull ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : isActive ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-gray-50 border-gray-100 text-gray-400"
                            }`}
                        >
                            {getGroupIcon(group)}
                            {group} {active}/{total}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 ${feedback.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-white/50 backdrop-blur-md rounded-2xl border border-meteorite-100 max-w-sm">
                <button
                    onClick={() => setActiveTab("ROLES")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === "ROLES" ? "bg-white text-meteorite-950 shadow-sm border border-gray-100" : "text-meteorite-500 hover:text-meteorite-700"
                        }`}
                >
                    <Users className="w-4 h-4" /> Jerarquías
                </button>
                <button
                    onClick={() => setActiveTab("AREAS")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === "AREAS" ? "bg-white text-meteorite-950 shadow-sm border border-gray-100" : "text-meteorite-500 hover:text-meteorite-700"
                        }`}
                >
                    <LayoutGrid className="w-4 h-4" /> Áreas
                </button>
            </div>

            {/* ─── TAB: ROLES ────────────────────────────────────────────────── */}
            {activeTab === "ROLES" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-meteorite-950">Jerarquía de Roles</h3>
                            <p className="text-sm text-meteorite-500">
                                Arrastra y suelta para ordenar visualmente los roles.
                                <strong className="text-meteorite-700 block mt-0.5">El orden visual no cambia la autoridad. El campo "Autoridad" sí la cambia.</strong>
                            </p>
                        </div>
                        <button onClick={() => setIsCreatingRole(true)} disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-meteorite-950 hover:bg-meteorite-800 text-white font-bold rounded-xl transition-all shadow-lg hover:rotate-1">
                            <Plus className="w-4 h-4" /> Nuevo Rol
                        </button>
                    </div>

                    {isCreatingRole && (
                        <div className="bg-white border-2 border-dashed border-meteorite-200 rounded-2xl p-4 flex gap-3">
                            <input autoFocus type="text" value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                placeholder="Nombre del Rol (Ej: Consultor)"
                                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:border-violet-500 outline-none font-bold text-meteorite-950" />
                            <input type="text" value={newRole.description} onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                                placeholder="Descripción"
                                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 outline-none text-sm text-meteorite-950" />
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase font-bold text-meteorite-400">Color:</label>
                                <input type="color" value={newRole.color} onChange={e => setNewRole({ ...newRole, color: e.target.value })}
                                    className="w-8 h-8 rounded shrink-0 cursor-pointer border-none bg-transparent" />
                            </div>
                            <div className="flex gap-1">
                                <button onClick={handleCreateRole} disabled={isPending || !newRole.name} className="px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"><Save className="w-4 h-4" /></button>
                                <button onClick={() => setIsCreatingRole(false)} className="px-3 py-2 bg-gray-100 text-meteorite-600 rounded-xl hover:bg-gray-200 hover:text-meteorite-800"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}

                    <DragDropContext onDragEnd={onDragEndRoles}>
                        <Droppable droppableId="roles-list">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                    {roles.map((role, index) => (
                                        <Draggable key={role.id} draggableId={role.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps}
                                                    className={`bg-white border rounded-2xl p-3 flex gap-4 items-start transition-all ${snapshot.isDragging ? "shadow-2xl border-violet-400 rotate-1 scale-[1.02]" : "shadow-sm border-gray-200"
                                                        }`}
                                                >
                                                    <div {...provided.dragHandleProps} className="p-2 -m-2 text-gray-400 hover:text-meteorite-900 cursor-grab active:cursor-grabbing mt-1">
                                                        <GripVertical className="w-5 h-5" />
                                                    </div>

                                                    {editingRole?.id === role.id ? (
                                                        <div className="flex-1 space-y-3">
                                                            <div className="flex gap-2">
                                                                <input autoFocus type="text" value={editingRole.name} onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                                                                    className="px-3 py-1.5 rounded-lg border border-gray-200 font-bold text-sm text-meteorite-950" />
                                                                <input type="text" value={editingRole.description || ""} onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                                                                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-meteorite-950" />
                                                                <input type="color" value={editingRole.color || "#6366f1"} onChange={e => setEditingRole({ ...editingRole, color: e.target.value })}
                                                                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent self-center shrink-0" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-[10px] uppercase font-bold text-meteorite-400">Nivel de autoridad:</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={100}
                                                                    value={editingRole.hierarchyLevel}
                                                                    onChange={e => setEditingRole({ ...editingRole, hierarchyLevel: Number.parseInt(e.target.value, 10) || 10 })}
                                                                    className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm font-bold text-meteorite-950 text-center"
                                                                />
                                                                <span className="text-[10px] text-meteorite-400">(1-100, mayor = más autoridad)</span>
                                                            </div>
                                                            {/* Permission checkboxes grouped */}
                                                            <div className="border rounded-xl p-3 bg-gray-50/50 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-black text-meteorite-700 uppercase tracking-wider">Permisos</span>
                                                                    <span className="text-[10px] font-bold text-meteorite-400">{editingPermissions.length}/{ALL_PERMISSIONS.length} activos</span>
                                                                </div>
                                                                {PERMISSION_GROUPS.map(group => {
                                                                    const groupPerms = ALL_PERMISSIONS.filter(p => PERMISSION_LABELS[p].group === group);
                                                                    const allChecked = groupPerms.every(p => editingPermissions.includes(p));
                                                                    return (
                                                                        <div key={group}>
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                {getGroupIcon(group)}
                                                                                <span className="text-[10px] font-black text-meteorite-600 uppercase tracking-wider">{group}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (allChecked) {
                                                                                            setEditingPermissions(prev => prev.filter(p => !groupPerms.includes(p)));
                                                                                        } else {
                                                                                            setEditingPermissions(prev => [...new Set([...prev, ...groupPerms])]);
                                                                                        }
                                                                                    }}
                                                                                    className="text-[9px] font-bold text-violet-500 hover:text-violet-700 ml-auto"
                                                                                >
                                                                                    {allChecked ? "Desmarcar todos" : "Marcar todos"}
                                                                                </button>
                                                                            </div>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                                                {groupPerms.map(perm => (
                                                                                    <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-white/60 rounded px-1.5 py-0.5 transition-colors">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={editingPermissions.includes(perm)}
                                                                                            onChange={() => togglePermission(perm)}
                                                                                            className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                                                                        />
                                                                                        <span className="text-[11px] font-medium text-meteorite-700">{PERMISSION_LABELS[perm].label}</span>
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: role.color || "#6366f1" }} />
                                                                <span className="font-black text-meteorite-950 truncate tracking-tight text-lg">{role.name}</span>
                                                                {role.isSystem && (
                                                                    <span title="Rol de Sistema" className="bg-blue-50 text-blue-600 text-[10px] uppercase font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                        <ShieldAlert className="w-3 h-3" /> Sistema
                                                                    </span>
                                                                )}
                                                                <span className="bg-gray-100 text-gray-600 font-bold text-[10px] px-1.5 py-0.5 rounded">
                                                                    Autoridad: {role.hierarchyLevel}
                                                                </span>
                                                                <span className="bg-violet-50 text-violet-700 font-bold text-[10px] px-1.5 py-0.5 rounded">
                                                                    Visual: #{index + 1}
                                                                </span>
                                                            </div>
                                                            {role.description && (
                                                                <p className="text-[11px] text-meteorite-400 font-medium mt-0.5 truncate">{role.description}</p>
                                                            )}
                                                            {renderPermissionSummary(role)}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-1 shrink-0">
                                                        {editingRole?.id === role.id ? (
                                                            <>
                                                                <button onClick={handleUpdateRole} disabled={isPending} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save className="w-4 h-4" /></button>
                                                                <button onClick={() => setEditingRole(null)} className="p-2 text-meteorite-500 hover:text-meteorite-700 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => startEditingRole(role)} disabled={isPending} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                                {!role.isSystem && (
                                                                    <button onClick={() => handleDeleteRole(role.id, role.name)} disabled={isPending} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            )}

            {/* ─── TAB: AREAS ─────────────────────────────────────────────────── */}
            {activeTab === "AREAS" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-meteorite-950">Áreas de Proyecto</h3>
                            <p className="text-sm text-meteorite-500">Configura genéricamente qué divisiones pueden tener los proyectos.</p>
                        </div>
                        <button onClick={() => setIsCreatingArea(true)} disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-meteorite-950 hover:bg-meteorite-800 text-white font-bold rounded-xl transition-all shadow-lg hover:rotate-1">
                            <Plus className="w-4 h-4" /> Nueva Área
                        </button>
                    </div>

                    {isCreatingArea && (
                        <div className="bg-white border-2 border-dashed border-meteorite-200 rounded-2xl p-4 flex gap-3 items-center">
                            <input type="color" value={newArea.color} onChange={e => setNewArea({ ...newArea, color: e.target.value })}
                                className="w-10 h-10 rounded-xl cursor-pointer bg-white" />
                            <input autoFocus type="text" value={newArea.name} onChange={e => setNewArea({ ...newArea, name: e.target.value })}
                                placeholder="Nombre (Ej: Diseño)" className="px-4 py-2 rounded-xl border border-gray-200 outline-none font-bold text-meteorite-950" />
                            <input type="text" value={newArea.description} onChange={e => setNewArea({ ...newArea, description: e.target.value })}
                                placeholder="Descripción" className="flex-1 px-4 py-2 rounded-xl border border-gray-200 outline-none text-sm text-meteorite-950" />
                            <div className="flex gap-1 shrink-0">
                                <button onClick={handleCreateArea} disabled={isPending || !newArea.name} className="px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50"><Save className="w-4 h-4" /></button>
                                <button onClick={() => setIsCreatingArea(false)} className="px-3 py-2 bg-gray-100 text-meteorite-600 rounded-xl hover:bg-gray-200 hover:text-meteorite-800"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}

                    <DragDropContext onDragEnd={onDragEndAreas}>
                        <Droppable droppableId="areas-list">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {areas.map((area, index) => (
                                        <Draggable key={area.id} draggableId={area.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                    className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 transition-all ${snapshot.isDragging ? "shadow-2xl border-violet-400 rotate-2 scale-105" : "shadow-sm border-gray-200 hover:border-violet-300"
                                                        }`}
                                                >
                                                    {editingArea?.id === area.id ? (
                                                        <div className="space-y-3">
                                                            <div className="flex gap-2">
                                                                <input type="color" value={editingArea.color || "#000"} onChange={e => setEditingArea({ ...editingArea, color: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer" />
                                                                <input autoFocus type="text" value={editingArea.name} onChange={e => setEditingArea({ ...editingArea, name: e.target.value })} className="flex-1 px-3 py-1 rounded-lg border text-sm font-bold shadow-inner text-meteorite-950" />
                                                            </div>
                                                            <textarea value={editingArea.description || ""} onChange={e => setEditingArea({ ...editingArea, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-xs resize-none shadow-inner text-meteorite-950" rows={2} />
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => setEditingArea(null)} className="px-3 py-1 bg-gray-100 text-meteorite-600 hover:text-meteorite-800 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors">Cancelar</button>
                                                                <button onClick={handleUpdateArea} disabled={isPending} className="px-3 py-1 bg-violet-600 text-white rounded-lg text-xs font-bold">Guardar</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-xl shadow-inner flex items-center justify-center border border-white/20" style={{ backgroundColor: area.color || "#94a3b8" }}>
                                                                        <span className="text-white font-black text-lg drop-shadow-sm">{area.name.charAt(0).toUpperCase()}</span>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-meteorite-950 text-lg leading-tight">{area.name}</h4>
                                                                        {area.isSystem && <span className="text-[10px] bg-blue-50 text-blue-600 font-black px-1.5 py-0.5 rounded uppercase">Sistema</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1 shrink-0 bg-gray-50 border rounded-lg p-0.5">
                                                                    <button onClick={() => setEditingArea(area)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                    {!area.isSystem && (
                                                                        <button onClick={() => handleDeleteArea(area.id, area.name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-meteorite-500 line-clamp-2 min-h-8">
                                                                {area.description || "Sin descripción proporcionada."}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            )}
        </div>
    );
}
