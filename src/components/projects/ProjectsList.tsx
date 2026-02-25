"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, deleteProjectAction } from "@/server/actions/project.actions";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/validators/project";
import {
    Plus, Loader2, FolderKanban, CalendarDays, Users, ListChecks,
    Trash2, ChevronRight, AlertTriangle, Flame, Zap, Minus,
    CheckCircle2, XCircle, Clock, Pause, X
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectMember {
    id: string;
    projectRole: { id: string; name: string };
    projectArea: { id: string; name: string; color: string | null } | null;
    user: { id: string; name: string | null; image: string | null; role: string | null };
}

interface ProjectTask {
    id: string;
    status: string;
}

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    deadline: Date | null;
    createdAt: Date | null;
    createdBy: { id: string; name: string | null; image: string | null };
    members: ProjectMember[];
    tasks: ProjectTask[];
}

interface Props {
    projects: Project[];
    canCreate: boolean;
    currentUserId: string;
}

// ─── Status/Priority Visual Configs ──────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
    PLANNING: { label: "Planificación", color: "bg-slate-100 text-slate-700", icon: Clock },
    ACTIVE: { label: "Activo", color: "bg-emerald-100 text-emerald-700", icon: Zap },
    PAUSED: { label: "Pausado", color: "bg-amber-100 text-amber-700", icon: Pause },
    COMPLETED: { label: "Completado", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: X },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
    LOW: { label: "Baja", color: "text-slate-500", icon: Minus },
    MEDIUM: { label: "Media", color: "text-amber-600", icon: AlertTriangle },
    HIGH: { label: "Alta", color: "text-orange-600", icon: Flame },
    CRITICAL: { label: "Crítica", color: "text-red-600", icon: Zap },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectsList({ projects, canCreate, currentUserId }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Form
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<string>("MEDIUM");
    const [startDate, setStartDate] = useState("");
    const [deadline, setDeadline] = useState("");

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleCreate = () => {
        if (!name.trim()) {
            showFeedback("error", "El nombre es obligatorio.");
            return;
        }
        startTransition(async () => {
            const res = await createProjectAction({
                name,
                description: description || null,
                priority: priority as any,
                startDate: startDate ? new Date(startDate) : null,
                deadline: deadline ? new Date(deadline) : null,
            });
            if (res.success) {
                showFeedback("success", res.message || "Proyecto creado.");
                setShowCreate(false);
                setName(""); setDescription(""); setPriority("MEDIUM"); setStartDate(""); setDeadline("");
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error.");
            }
        });
    };

    const handleDelete = (projectId: string, projectName: string) => {
        if (!confirm(`¿Eliminar el proyecto "${projectName}"? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            const res = await deleteProjectAction(projectId);
            if (res.success) {
                showFeedback("success", res.message || "Eliminado.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error.");
            }
        });
    };

    const getTaskStats = (tasks: ProjectTask[]) => {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === "DONE").length;
        return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    };

    return (
        <div className="space-y-6">
            {/* Feedback */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 ${feedback.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Actions */}
            {canCreate && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-violet-600/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Proyecto
                    </button>
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="bg-white/80 backdrop-blur-md border border-violet-200 rounded-2xl p-5 shadow-xl space-y-4">
                    <h3 className="text-lg font-black text-meteorite-950">Crear Proyecto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Nombre *</label>
                            <input
                                type="text" value={name} onChange={e => setName(e.target.value)}
                                placeholder="Ej: Campaña de Marketing"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none bg-white font-medium text-meteorite-950"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Prioridad</label>
                            <select
                                value={priority} onChange={e => setPriority(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 outline-none bg-white font-medium text-meteorite-950"
                            >
                                {PROJECT_PRIORITIES.map(p => (
                                    <option key={p} value={p}>{PRIORITY_CONFIG[p]?.label || p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-meteorite-700 mb-1">Descripción</label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)} rows={2}
                            placeholder="Describe el objetivo del proyecto..."
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 outline-none bg-white font-medium text-meteorite-950 resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Inicio</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium text-meteorite-950" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Deadline</label>
                            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium text-meteorite-950" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowCreate(false)}
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl">
                            Cancelar
                        </button>
                        <button onClick={handleCreate} disabled={isPending || !name.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Crear
                        </button>
                    </div>
                </div>
            )}

            {/* Projects Grid */}
            {projects.length === 0 ? (
                <div className="bg-white/60 border border-meteorite-100 rounded-2xl p-12 text-center">
                    <FolderKanban className="w-16 h-16 text-meteorite-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-meteorite-950 mb-1">Sin proyectos</h3>
                    <p className="text-meteorite-500 text-sm">Crea tu primer proyecto para comenzar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {projects.map(project => {
                        const stats = getTaskStats(project.tasks);
                        const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
                        const prioConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.MEDIUM;
                        const StatusIcon = status.icon;
                        const PrioIcon = prioConfig.icon;
                        const isMember = project.members.some(m => m.user.id === currentUserId);

                        return (
                            <div key={project.id} className="group bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-violet-300 transition-all">
                                {/* Card Header */}
                                <div className="p-4 border-b border-gray-100">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <Link href={`/dashboard/projects/${project.id}`}
                                            className="text-lg font-black text-meteorite-950 hover:text-violet-700 transition-colors leading-tight line-clamp-2 flex-1">
                                            {project.name}
                                        </Link>
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${status.color} shrink-0`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {status.label}
                                        </span>
                                    </div>
                                    {project.description && (
                                        <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
                                    )}
                                </div>

                                {/* Stats */}
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3.5 h-3.5 text-violet-500" />
                                            {project.members.length}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
                                            {stats.done}/{stats.total}
                                        </span>
                                        <span className={`flex items-center gap-1 ${prioConfig.color}`}>
                                            <PrioIcon className="w-3.5 h-3.5" />
                                            {prioConfig.label}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    {stats.total > 0 && (
                                        <div>
                                            <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                                <span>Progreso</span>
                                                <span>{stats.pct}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${stats.pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Deadline */}
                                    {project.deadline && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                            <CalendarDays className="w-3.5 h-3.5" />
                                            <span>
                                                Deadline: {new Date(project.deadline).toLocaleDateString("es", {
                                                    day: "numeric", month: "short", timeZone: "UTC"
                                                })}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-4 pb-3 flex items-center justify-between">
                                    {isMember && (
                                        <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-bold rounded-md">
                                            Miembro
                                        </span>
                                    )}
                                    <div className="flex items-center gap-2 ml-auto">
                                        <button
                                            onClick={() => handleDelete(project.id, project.name)}
                                            disabled={isPending}
                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <Link href={`/dashboard/projects/${project.id}`}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
                                            Ver <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
