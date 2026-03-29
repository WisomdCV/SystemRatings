"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
    updateProjectAction, addProjectMemberAction, removeProjectMemberAction,
    updateProjectMemberRoleAction, createTaskAction, updateTaskStatusAction,
    deleteTaskAction, assignTaskAction, unassignTaskAction,
} from "@/server/actions/project.actions";
import { PROJECT_STATUSES, PROJECT_PRIORITIES, TASK_STATUSES, TASK_PRIORITIES } from "@/lib/validators/project";
import {
    Users, ListChecks, Plus, Loader2, Trash2, Crown, UserPlus,
    CheckCircle2, XCircle, Circle, Clock, AlertTriangle, Search,
    ChevronDown, Zap, Flame, Minus, Pause, X, Eye, UserMinus, Shield
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
    createdAt: Date | null;
    dueDate: Date | null;
    position: number | null;
    projectArea: { id: string; name: string; color: string | null } | null;
    createdBy: { id: string; name: string | null; image: string | null };
    assignments: TaskAssignment[];
}

interface Member {
    id: string;
    projectRole: { id: string; name: string; hierarchyLevel: number; color: string | null; isSystem: boolean | null; permissions?: { permission: string }[] };
    projectArea: { id: string; name: string; color: string | null } | null;
    user: { id: string; name: string | null; image: string | null; email: string; role: string | null };
}

interface ProjectRole { id: string; name: string; hierarchyLevel: number; color: string | null; permissions?: { permission: string }[] }
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

const TASK_BG_COLORS: Record<string, string> = {
    TODO: "bg-white border-gray-200",
    IN_PROGRESS: "bg-blue-50/50 border-blue-200",
    REVIEW: "bg-purple-50/50 border-purple-200",
    DONE: "bg-emerald-50/50 border-emerald-200",
    BLOCKED: "bg-red-50/50 border-red-200",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectDetail({ project, eligibleUsers, allProjectRoles, allProjectAreas, currentUserId, isSystemAdmin }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Member add
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");
    const [selectedAreaId, setSelectedAreaId] = useState<string>("none"); // 'none' means system/sin area

    // Task create
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskPriority, setTaskPriority] = useState("MEDIUM");
    const [taskDue, setTaskDue] = useState("");
    const [taskAreaId, setTaskAreaId] = useState<string>("none");

    // Task assign
    const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
    const [assignSearch, setAssignSearch] = useState("");

    // Task filter
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [areaFilter, setAreaFilter] = useState<string>("ALL");

    const userMembership = project.members.find(m => m.user.id === currentUserId);
    const userProjectRole = userMembership?.projectRole;
    const userPerms = (userProjectRole?.permissions ?? []).map(p => p.permission);
    const canManage = isSystemAdmin || userPerms.includes("project:manage_settings");
    const userCanCreateTasks = isSystemAdmin || userPerms.includes("project:task_create_any") || userPerms.includes("project:task_create_own_area");
    const userProjectAreaId = userMembership?.projectArea?.id || null;
    const userProjectAreaName = userMembership?.projectArea?.name || null;
    // Only own-area permission = restricted to own area or general tasks
    const isAreaRestricted = !isSystemAdmin && !userPerms.includes("project:task_create_any") && userPerms.includes("project:task_create_own_area");

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    // ── Members ──
    const handleAddMember = (userId: string) => {
        startTransition(async () => {
            const defaultRole = allProjectRoles[allProjectRoles.length - 1] || allProjectRoles[0];
            if (!defaultRole) return;
            const payload: any = {
                projectId: project.id,
                userId,
                projectRoleId: defaultRole.id,
            };
            if (selectedAreaId !== "none") payload.projectAreaId = selectedAreaId;

            const res = await addProjectMemberAction(payload);
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
        const member = project.members.find(m => m.id === memberId);
        startTransition(async () => {
            const res = await updateProjectMemberRoleAction({
                memberId,
                projectRoleId: newRoleId,
                projectAreaId: member?.projectArea?.id || null,
            });
            if (res.success) { showFeedback("success", res.message!); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleChangeArea = (memberId: string, newAreaId: string) => {
        const member = project.members.find(m => m.id === memberId);
        startTransition(async () => {
            const res = await updateProjectMemberRoleAction({
                memberId,
                projectRoleId: member?.projectRole.id || "",
                projectAreaId: newAreaId === "none" ? null : newAreaId,
            });
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
                projectAreaId: taskAreaId !== "none" ? taskAreaId : undefined,
            });
            if (res.success) {
                showFeedback("success", res.message!);
                setShowCreateTask(false); setTaskTitle(""); setTaskDescription(""); setTaskPriority("MEDIUM"); setTaskDue(""); setTaskAreaId("none");
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
    const filteredTasks = project.tasks.filter(t => {
        const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
        const matchArea = areaFilter === "ALL" || (areaFilter === "GENERAL" ? !t.projectArea : t.projectArea?.id === areaFilter);
        return matchStatus && matchArea;
    });

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
                            Deadline: {new Date(project.deadline).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
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
                        {userCanCreateTasks && (
                            <button onClick={() => setShowCreateTask(!showCreateTask)} disabled={isPending}
                                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm shadow-lg transition-all disabled:opacity-50">
                                <Plus className="w-4 h-4" /> Nueva Tarea
                            </button>
                        )}
                    </div>

                    {/* Create Task Form */}
                    {showCreateTask && (
                        <div className="bg-white border border-violet-200 rounded-2xl p-4 space-y-3">
                            {/* Task Capability Banner */}
                            <div className="p-3 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/60 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-3.5 h-3.5 text-violet-500" />
                                    <span className="text-[11px] font-black text-violet-600 uppercase tracking-wider">
                                        Tus capacidades
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-100 text-violet-700 border-violet-200">
                                        Crear tareas
                                    </span>
                                    {isAreaRestricted ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-100 text-indigo-700 border-indigo-200">
                                            {userProjectAreaName ? `Solo: ${userProjectAreaName}` : "Tu área + General"}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
                                            Cualquier área
                                        </span>
                                    )}
                                    {canManage && (
                                        <>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200">
                                                Asignar miembros
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
                                                Eliminar tareas
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

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
                                <select value={taskAreaId} onChange={e => setTaskAreaId(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 outline-none bg-white text-meteorite-950 text-sm">
                                    {isAreaRestricted ? (
                                        <>
                                            <option value="none">Área General</option>
                                            {userProjectAreaId && allProjectAreas.filter(a => a.id === userProjectAreaId).map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            <option value="none">Área General</option>
                                            {allProjectAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </>
                                    )}
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

                    {/* Area Filter */}
                    <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setAreaFilter("ALL")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${areaFilter === "ALL" ? "bg-violet-100 text-violet-700 border-violet-200 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                            Todas las Áreas
                        </button>
                        <button onClick={() => setAreaFilter("GENERAL")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${areaFilter === "GENERAL" ? "bg-violet-100 text-violet-700 border-violet-200 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                            General
                        </button>
                        {allProjectAreas.map(a => (
                            <button key={a.id} onClick={() => setAreaFilter(a.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${areaFilter === a.id ? "bg-violet-100 text-violet-700 border-violet-200 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                                {a.name}
                            </button>
                        ))}
                    </div>

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
                                const bgClass = TASK_BG_COLORS[task.status] || TASK_BG_COLORS.TODO;
                                return (
                                    <div key={task.id} className={`border rounded-xl p-3 hover:shadow-md transition-all ${bgClass}`}>
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
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className={`font-bold text-sm leading-tight flex items-center gap-1.5 ${task.status === "DONE" ? "line-through text-gray-400" : "text-meteorite-950"}`}>
                                                            {task.priority === "CRITICAL" && <span className="inline-block shrink-0 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]" title="Prioridad Crítica" />}
                                                            {task.priority === "HIGH" && <span className="inline-block shrink-0 w-2 h-2 rounded-full bg-orange-500" title="Prioridad Alta" />}
                                                            {task.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1 mb-1.5">
                                                            {task.projectArea ? (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border" style={{ backgroundColor: `${task.projectArea.color || "#e2e8f0"}15`, color: task.projectArea.color || "#64748b", borderColor: `${task.projectArea.color || "#e2e8f0"}40` }}>
                                                                    {task.projectArea.name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-gray-50 border-gray-200 text-gray-500">
                                                                    General
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                                                                Por:
                                                                {task.createdBy?.image ? (
                                                                    <UserAvatar src={task.createdBy.image} name={task.createdBy.name} className="w-3.5 h-3.5 rounded-full inline-block" />
                                                                ) : (
                                                                    <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[7px] font-bold text-gray-500 shrink-0">
                                                                        {task.createdBy?.name?.charAt(0) || "?"}
                                                                    </div>
                                                                )}
                                                                <strong className="text-gray-600 truncate max-w-[80px]">{task.createdBy?.name?.split(" ")[0]}</strong>
                                                            </span>
                                                        </div>
                                                        {task.description && (
                                                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-snug">{task.description}</p>
                                                        )}
                                                    </div>

                                                    {/* Task actions (Delete) */}
                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                        {canManage && (
                                                            <button onClick={() => handleDeleteTask(task.id)} disabled={isPending}
                                                                className="p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Meta details (Dates + Assignments) */}
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">

                                                    {/* Dates */}
                                                    <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400 shrink-0">
                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100" title="Fecha de creación">
                                                            <Plus className="w-3 h-3 text-gray-400" />
                                                            {new Date(task.createdAt || new Date()).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                                                        </span>

                                                        {task.dueDate && (
                                                            <>
                                                                <span className="text-gray-300">→</span>
                                                                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                                                                    ? "bg-red-50 text-red-600 border-red-100"
                                                                    : "bg-orange-50 text-orange-600 border-orange-100"
                                                                    }`} title="Fecha límite">
                                                                    <ListChecks className="w-3 h-3" />
                                                                    {new Date(task.dueDate).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Assignments list */}
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {task.assignments.map(a => (
                                                            <div key={a.id} className="group relative flex items-center">
                                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black border border-white shadow-sm ring-1 ring-violet-50 z-10" title={a.user.name || "?"}>
                                                                    {(a.user.name || "?").charAt(0).toUpperCase()}
                                                                </span>
                                                                {canManage && (
                                                                    <button onClick={() => handleUnassign(a.id)} disabled={isPending}
                                                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full items-center justify-center text-[8px] z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm  disabled:opacity-50 flex">
                                                                        <X className="w-2.5 h-2.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}

                                                        {canManage && (
                                                            <div className="relative">
                                                                <button onClick={() => { setAssigningTaskId(assigningTaskId === task.id ? null : task.id); setAssignSearch(""); }}
                                                                    disabled={isPending}
                                                                    className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition-colors disabled:opacity-50 ml-1">
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                </button>

                                                                {/* Assign dropdown inline */}
                                                                {assigningTaskId === task.id && (
                                                                    <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-48 w-max">
                                                                        <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                                                                            <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                                                                                placeholder="Buscar miembro…" autoFocus
                                                                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-violet-500 transition-colors bg-white shadow-sm" />
                                                                        </div>
                                                                        <div className="max-h-32 overflow-y-auto p-1">
                                                                            {filteredAssignUsers.length === 0 ? (
                                                                                <div className="px-2 py-3 text-center text-xs text-gray-400 font-medium">Sin coincidencias</div>
                                                                            ) : (
                                                                                filteredAssignUsers.map(m => (
                                                                                    <button key={m.user.id} onClick={() => handleAssignTask(task.id, m.user.id)}
                                                                                        disabled={isPending || task.assignments.some(a => a.user.id === m.user.id)}
                                                                                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-violet-50 rounded-lg text-left text-xs disabled:opacity-40 transition-colors group">
                                                                                        <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-[9px] font-black text-gray-600 group-disabled:bg-gray-50 shrink-0">
                                                                                            {m.user.name?.charAt(0).toUpperCase() || "?"}
                                                                                        </div>
                                                                                        <span className="font-bold text-gray-900 truncate flex-1">{m.user.name || m.user.email}</span>
                                                                                        {task.assignments.some(a => a.user.id === m.user.id) && (
                                                                                            <span className="text-[9px] font-bold text-emerald-600 shrink-0">Asignado</span>
                                                                                        )}
                                                                                    </button>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                                <div className="p-2 border-b border-gray-100 flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedAreaId}
                                            onChange={e => setSelectedAreaId(e.target.value)}
                                            className="px-2 py-1.5 text-xs font-bold rounded-lg border border-gray-200 outline-none flex-1 text-gray-700 bg-white"
                                        >
                                            <option value="none">Sin Área Específica</option>
                                            {allProjectAreas.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                        placeholder="Buscar usuario…" autoFocus
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none" />
                                </div>
                                <div className="max-h-32 overflow-y-auto">
                                    {filteredEligible.slice(0, 10).map(u => (
                                        <button key={u.id} onClick={() => handleAddMember(u.id)}
                                            disabled={isPending}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white text-left text-xs disabled:opacity-50 transition-colors">
                                            <span className="font-medium text-gray-900 truncate flex-1">{u.name || u.email}</span>
                                            <span className="text-[9px] font-bold px-1 py-0.5 bg-gray-100 text-gray-500 rounded">{u.role}</span>
                                        </button>
                                    ))}
                                    {filteredEligible.length === 0 && (
                                        <div className="p-3 text-center text-xs text-gray-500">No hay usuarios disponibles.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Member List Grouped by Area */}
                        <div className="space-y-4 mt-2">
                            {(() => {
                                const sortedMembers = [...project.members].sort((a, b) => b.projectRole.hierarchyLevel - a.projectRole.hierarchyLevel);
                                const grouped = sortedMembers.reduce((acc, current) => {
                                    const areaName = current.projectArea?.name || "Gestión de Proyecto";
                                    if (!acc[areaName]) acc[areaName] = { members: [], color: current.projectArea?.color || "#94a3b8" };
                                    acc[areaName].members.push(current);
                                    return acc;
                                }, {} as Record<string, { members: typeof project.members, color: string }>);

                                const sortedAreaNames = Object.keys(grouped).sort((a, b) => {
                                    if (a === "Gestión de Proyecto") return -1;
                                    if (b === "Gestión de Proyecto") return 1;
                                    return a.localeCompare(b);
                                });

                                return sortedAreaNames.map(areaName => {
                                    const data = grouped[areaName];
                                    return (
                                        <div key={areaName} className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: data.color }} />
                                                <h5 className="text-xs font-black text-meteorite-900 uppercase tracking-wider">{areaName}</h5>
                                                <div className="flex-1 h-px bg-gray-100" />
                                            </div>
                                            <div className="space-y-1.5 ml-1">
                                                {data.members.map(m => (
                                                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                                        <div className="relative shrink-0">
                                                            {m.user.image ? (
                                                                <UserAvatar src={m.user.image} name={m.user.name} alt={m.user.name || ""} className="w-8 h-8 rounded-xl shadow-sm bg-gray-100" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm"
                                                                    style={{ backgroundColor: `${data.color}20`, color: data.color }}>
                                                                    {m.user.name?.charAt(0).toUpperCase() || "?"}
                                                                </div>
                                                            )}
                                                            {m.projectRole.isSystem && (
                                                                <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 shadow-sm" title="Rol Maestro">
                                                                    <Crown className="w-2.5 h-2.5" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                            <p className="text-xs font-bold text-meteorite-950 truncate leading-tight">{m.user.name || m.user.email}</p>
                                                            <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">{m.user.email}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            {canManage ? (
                                                                <>
                                                                    <select
                                                                        value={m.projectRole.id}
                                                                        onChange={e => handleChangeRole(m.id, e.target.value)}
                                                                        disabled={isPending}
                                                                        className="text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer bg-white text-gray-700 border-gray-200 shadow-sm focus:border-violet-500 hover:border-gray-300 transition-colors"
                                                                    >
                                                                        {allProjectRoles.map(r => (
                                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                                        ))}
                                                                    </select>
                                                                    <select
                                                                        value={m.projectArea?.id || "none"}
                                                                        onChange={e => handleChangeArea(m.id, e.target.value)}
                                                                        disabled={isPending}
                                                                        className="text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer bg-white text-gray-500 border-gray-200 shadow-sm focus:border-violet-500 hover:border-gray-300 transition-colors"
                                                                    >
                                                                        <option value="none">Sin Área</option>
                                                                        {allProjectAreas.map(a => (
                                                                            <option key={a.id} value={a.id}>{a.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg border shadow-sm" style={{ backgroundColor: `${m.projectRole.color || "#e2e8f0"}15`, color: m.projectRole.color || "#64748b", borderColor: `${m.projectRole.color || "#e2e8f0"}40` }}>
                                                                        {m.projectRole.name}
                                                                    </span>
                                                                    {m.projectArea && (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ backgroundColor: `${m.projectArea.color || "#e2e8f0"}10`, color: m.projectArea.color || "#64748b", borderColor: `${m.projectArea.color || "#e2e8f0"}30` }}>
                                                                            {m.projectArea.name}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                            {canManage && m.user.id !== currentUserId && (
                                                                <button onClick={() => handleRemoveMember(m.id)} disabled={isPending}
                                                                    className="text-[10px] flex items-center gap-1 text-red-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                                                    Quitar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
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
