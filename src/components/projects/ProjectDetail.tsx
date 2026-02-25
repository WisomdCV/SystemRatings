"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    updateProjectAction, addProjectMemberAction, removeProjectMemberAction,
    updateProjectMemberRoleAction, createTaskAction, updateTaskStatusAction,
    deleteTaskAction, assignTaskAction, unassignTaskAction,
} from "@/server/actions/project.actions";
import { PROJECT_STATUSES, PROJECT_PRIORITIES, TASK_STATUSES, TASK_PRIORITIES } from "@/lib/validators/project";
import {
    Users, ListChecks, Plus, Loader2, Trash2, Crown, UserPlus,
    CheckCircle2, XCircle, Circle, Clock, AlertTriangle, Search,
    ChevronDown, Zap, Flame, Minus, Pause, X, Eye, UserMinus
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TaskAssignment {
    id: string;
    user: { id: string; name: string | null; image: string | null };
}

interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    position: number | null;
    createdBy: { id: string; name: string | null };
    assignments: TaskAssignment[];
}

interface Member {
    id: string;
    projectRole: { id: string; name: string; hierarchyLevel: number; isSystem: boolean | null };
    projectArea: { id: string; name: string; color: string | null } | null;
    user: { id: string; name: string | null; image: string | null; email: string; role: string | null };
}

interface ProjectRole { id: string; name: string; hierarchyLevel: number; }
interface ProjectArea { id: string; name: string; color: string | null; }

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    deadline: Date | null;
    createdBy: { id: string; name: string | null; image: string | null; email: string };
    semester: { id: string; name: string };
    members: Member[];
    tasks: Task[];
}

interface EligibleUser {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    image: string | null;
}

interface Props {
    project: Project;
    eligibleUsers: EligibleUser[];
    allProjectRoles: ProjectRole[];
    allProjectAreas: ProjectArea[];
    currentUserId: string;
    isSystemAdmin: boolean;
}

// ─── Visual Configs ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    PLANNING: { label: "Planificación", color: "bg-slate-100 text-slate-700" },
    ACTIVE: { label: "Activo", color: "bg-emerald-100 text-emerald-700" },
    PAUSED: { label: "Pausado", color: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "Completado", color: "bg-blue-100 text-blue-700" },
    CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const TASK_STATUS_ICON: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
    TODO: { icon: Circle, color: "text-gray-400", label: "Por hacer" },
    IN_PROGRESS: { icon: Loader2, color: "text-blue-500", label: "En progreso" },
    REVIEW: { icon: Eye, color: "text-purple-500", label: "Revisión" },
    DONE: { icon: CheckCircle2, color: "text-emerald-500", label: "Hecho" },
    BLOCKED: { icon: X, color: "text-red-500", label: "Bloqueado" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectDetail({ project, eligibleUsers, allProjectRoles, allProjectAreas, currentUserId, isSystemAdmin }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Member add
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");

    // Task create
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskPriority, setTaskPriority] = useState("MEDIUM");
    const [taskDue, setTaskDue] = useState("");

    // Task assign
    const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
    const [assignSearch, setAssignSearch] = useState("");

    // Task filter
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    const userProjectRole = project.members.find(m => m.user.id === currentUserId)?.projectRole;
    const canManage = isSystemAdmin || (userProjectRole?.hierarchyLevel ?? 0) >= 80;

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    // ── Members ──
    const handleAddMember = (userId: string) => {
        startTransition(async () => {
            const defaultRole = allProjectRoles.find(r => r.hierarchyLevel === 10) || allProjectRoles[allProjectRoles.length - 1];
            if (!defaultRole) return;
            const res = await addProjectMemberAction({
                projectId: project.id,
                userId,
                projectRoleId: defaultRole.id,
            });
            if (res.success) { showFeedback("success", res.message!); setShowAddMember(false); setMemberSearch(""); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleRemoveMember = (memberId: string) => {
        startTransition(async () => {
            const res = await removeProjectMemberAction(memberId);
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleChangeRole = (memberId: string, newRoleId: string) => {
        startTransition(async () => {
            const res = await updateProjectMemberRoleAction({ memberId, projectRoleId: newRoleId });
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    // ── Tasks ──
    const handleCreateTask = () => {
        if (!taskTitle.trim()) return;
        startTransition(async () => {
            const res = await createTaskAction({
                projectId: project.id,
                title: taskTitle,
                description: taskDescription || null,
                priority: taskPriority as any,
                dueDate: taskDue ? new Date(taskDue) : null,
            });
            if (res.success) {
                showFeedback("success", res.message!);
                setShowCreateTask(false); setTaskTitle(""); setTaskDescription(""); setTaskPriority("MEDIUM"); setTaskDue("");
                router.refresh();
            } else showFeedback("error", res.error!);
        });
    };

    const handleStatusChange = (taskId: string, newStatus: string) => {
        startTransition(async () => {
            const res = await updateTaskStatusAction({ id: taskId, status: newStatus as any });
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleDeleteTask = (taskId: string) => {
        startTransition(async () => {
            const res = await deleteTaskAction(taskId);
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleAssignTask = (taskId: string, userId: string) => {
        startTransition(async () => {
            const res = await assignTaskAction({ taskId, userId });
            if (res.success) { showFeedback("success", res.message!); setAssigningTaskId(null); setAssignSearch(""); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleUnassign = (assignmentId: string) => {
        startTransition(async () => {
            const res = await unassignTaskAction(assignmentId);
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    // Filters
    const filteredTasks = statusFilter === "ALL"
        ? project.tasks
        : project.tasks.filter(t => t.status === statusFilter);

    const filteredEligible = eligibleUsers.filter(u => {
        if (!memberSearch) return true;
        const term = memberSearch.toLowerCase();
        return u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    });

    const filteredAssignUsers = project.members.filter(m => {
        if (!assignSearch) return true;
        const term = assignSearch.toLowerCase();
        return m.user.name?.toLowerCase().includes(term) || m.user.email.toLowerCase().includes(term);
    });

    // Stats
    const taskStats = {
        total: project.tasks.length,
        done: project.tasks.filter(t => t.status === "DONE").length,
        inProgress: project.tasks.filter(t => t.status === "IN_PROGRESS").length,
        blocked: project.tasks.filter(t => t.status === "BLOCKED").length,
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

            {/* Project Info Bar */}
            <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${STATUS_BADGE[project.status]?.color || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_BADGE[project.status]?.label || project.status}
                    </span>
                    <span className="text-xs text-gray-500">
                        Creado por <strong>{project.createdBy.name || project.createdBy.email}</strong>
                    </span>
                    {project.deadline && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Deadline: {new Date(project.deadline).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                    )}
                </div>
                <div className="flex gap-3 text-xs font-bold">
                    <span className="text-gray-600"><Users className="w-3.5 h-3.5 inline mr-1" />{project.members.length}</span>
                    <span className="text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />{taskStats.done}/{taskStats.total}</span>
                    {taskStats.blocked > 0 && <span className="text-red-500"><X className="w-3.5 h-3.5 inline mr-1" />{taskStats.blocked} bloq.</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── LEFT COLUMN: Tasks ── */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Task Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-meteorite-950 flex items-center gap-2">
                            <ListChecks className="w-5 h-5 text-violet-500" />
                            Tareas
                        </h3>
                        {canManage && (
                            <button onClick={() => setShowCreateTask(!showCreateTask)} disabled={isPending}
                                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm shadow-lg transition-all disabled:opacity-50">
                                <Plus className="w-4 h-4" /> Nueva Tarea
                            </button>
                        )}
                    </div>

                    {/* Create Task Form */}
                    {showCreateTask && (
                        <div className="bg-white border border-violet-200 rounded-2xl p-4 space-y-3">
                            <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                                placeholder="Título de la tarea *"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 outline-none bg-white font-medium text-meteorite-950" />
                            <textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} rows={2}
                                placeholder="Descripción (opcional)"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium text-meteorite-950 resize-none" />
                            <div className="flex gap-3 flex-wrap">
                                <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 outline-none bg-white text-meteorite-950 text-sm">
                                    {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 outline-none bg-white text-meteorite-950 text-sm" />
                                <div className="ml-auto flex gap-2">
                                    <button onClick={() => setShowCreateTask(false)} className="px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl">Cancelar</button>
                                    <button onClick={handleCreateTask} disabled={isPending || !taskTitle.trim()}
                                        className="px-4 py-2 text-sm font-bold bg-violet-600 text-white rounded-xl disabled:opacity-50">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status Filter */}
                    <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setStatusFilter("ALL")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === "ALL" ? "bg-meteorite-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                            Todas ({project.tasks.length})
                        </button>
                        {(Object.keys(TASK_STATUS_ICON) as string[]).map(s => {
                            const cfg = TASK_STATUS_ICON[s];
                            const count = project.tasks.filter(t => t.status === s).length;
                            if (count === 0) return null;
                            return (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-meteorite-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                    {cfg.label} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Task List */}
                    {filteredTasks.length === 0 ? (
                        <div className="bg-white/60 border border-gray-100 rounded-2xl p-8 text-center">
                            <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400 font-bold">Sin tareas{statusFilter !== "ALL" ? " en este filtro" : ""}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTasks.map(task => {
                                const statusCfg = TASK_STATUS_ICON[task.status] || TASK_STATUS_ICON.TODO;
                                const StatusIcon = statusCfg.icon;
                                return (
                                    <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-all">
                                        <div className="flex items-start gap-3">
                                            {/* Status toggle */}
                                            <div className="mt-0.5">
                                                <select
                                                    value={task.status}
                                                    onChange={e => handleStatusChange(task.id, e.target.value)}
                                                    disabled={isPending}
                                                    className={`text-xs font-bold rounded-lg px-1 py-0.5 border-none outline-none cursor-pointer ${statusCfg.color} bg-transparent`}
                                                >
                                                    {TASK_STATUSES.map(s => (
                                                        <option key={s} value={s}>{TASK_STATUS_ICON[s]?.label || s}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm ${task.status === "DONE" ? "line-through text-gray-400" : "text-meteorite-950"}`}>
                                                    {task.title}
                                                </p>
                                                {task.description && (
                                                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{task.description}</p>
                                                )}

                                                {/* Assignments */}
                                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                    {task.assignments.map(a => (
                                                        <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded-md text-[10px] font-bold">
                                                            {a.user.name || "?"}
                                                            {canManage && (
                                                                <button onClick={() => handleUnassign(a.id)} disabled={isPending}
                                                                    className="hover:text-red-500 ml-0.5">
                                                                    <X className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ))}
                                                    {canManage && (
                                                        <button onClick={() => { setAssigningTaskId(assigningTaskId === task.id ? null : task.id); setAssignSearch(""); }}
                                                            disabled={isPending}
                                                            className="p-1 text-gray-400 hover:text-violet-600 rounded transition-colors disabled:opacity-50">
                                                            <UserPlus className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Assign dropdown */}
                                                {assigningTaskId === task.id && (
                                                    <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-w-xs">
                                                        <div className="p-2 border-b border-gray-100">
                                                            <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                                                                placeholder="Buscar miembro…" autoFocus
                                                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none" />
                                                        </div>
                                                        <div className="max-h-28 overflow-y-auto">
                                                            {filteredAssignUsers.map(m => (
                                                                <button key={m.user.id} onClick={() => handleAssignTask(task.id, m.user.id)}
                                                                    disabled={isPending || task.assignments.some(a => a.user.id === m.user.id)}
                                                                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-50 text-left text-xs disabled:opacity-30">
                                                                    <span className="font-medium text-gray-900 truncate">{m.user.name || m.user.email}</span>
                                                                    <span className={`ml-auto text-[9px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-700`}>
                                                                        {m.projectRole.name}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Task actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {task.dueDate && (
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(task.dueDate).toLocaleDateString("es", { day: "numeric", month: "short" })}
                                                    </span>
                                                )}
                                                {canManage && (
                                                    <button onClick={() => handleDeleteTask(task.id)} disabled={isPending}
                                                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors disabled:opacity-50">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: Members + Info ── */}
                <div className="space-y-4">
                    {/* Members */}
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-black text-meteorite-950 text-sm flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-violet-500" />
                                Equipo ({project.members.length})
                            </h4>
                            {canManage && (
                                <button onClick={() => setShowAddMember(!showAddMember)} disabled={isPending}
                                    className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors disabled:opacity-50">
                                    <UserPlus className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Add Member Dropdown */}
                        {showAddMember && (
                            <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                <div className="p-2 border-b border-gray-100">
                                    <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                        placeholder="Buscar usuario…" autoFocus
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none" />
                                </div>
                                <div className="max-h-32 overflow-y-auto">
                                    {filteredEligible.slice(0, 10).map(u => (
                                        <button key={u.id} onClick={() => handleAddMember(u.id)}
                                            disabled={isPending}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white text-left text-xs disabled:opacity-50">
                                            <span className="font-medium text-gray-900 truncate flex-1">{u.name || u.email}</span>
                                            <span className="text-[9px] font-bold px-1 py-0.5 bg-gray-100 text-gray-500 rounded">{u.role}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Member List */}
                        <div className="space-y-1.5">
                            {project.members.map(m => {
                                return (
                                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-[10px] font-black text-violet-700 shrink-0">
                                            {m.user.name?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-meteorite-950 truncate">{m.user.name || m.user.email}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{m.user.email}</p>
                                        </div>
                                        {canManage ? (
                                            <select
                                                value={m.projectRole.id}
                                                onChange={e => handleChangeRole(m.id, e.target.value)}
                                                disabled={isPending}
                                                className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 border outline-none cursor-pointer bg-gray-100 text-gray-700 border-gray-200`}
                                            >
                                                {allProjectRoles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border bg-gray-100 text-gray-700 border-gray-200`}>
                                                {m.projectRole.name}
                                            </span>
                                        )}
                                        {canManage && m.user.id !== currentUserId && (
                                            <button onClick={() => handleRemoveMember(m.id)} disabled={isPending}
                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                                <UserMinus className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Project Description */}
                    {project.description && (
                        <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4">
                            <h4 className="font-black text-meteorite-950 text-sm mb-2">Descripción</h4>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{project.description}</p>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4">
                        <h4 className="font-black text-meteorite-950 text-sm mb-3">Resumen</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Tareas", value: taskStats.total, color: "text-meteorite-700" },
                                { label: "Completadas", value: taskStats.done, color: "text-emerald-600" },
                                { label: "En progreso", value: taskStats.inProgress, color: "text-blue-600" },
                                { label: "Bloqueadas", value: taskStats.blocked, color: "text-red-600" },
                            ].map(s => (
                                <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] text-gray-500 font-bold">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
