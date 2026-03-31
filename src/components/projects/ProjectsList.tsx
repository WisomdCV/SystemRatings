"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, deleteProjectAction } from "@/server/actions/project.actions";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/validators/project";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
    Plus,
    Loader2,
    FolderKanban,
    CalendarDays,
    Users,
    ListChecks,
    Trash2,
    ChevronRight,
    AlertTriangle,
    Flame,
    Zap,
    Minus,
    CheckCircle2,
    XCircle,
    Clock,
    Pause,
    X,
    Search,
    SlidersHorizontal,
    LayoutGrid,
    List,
    ArrowUpDown,
    Sparkles,
    Target,
    Timer
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
    color: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    deadline: Date | null;
    createdAt: Date | null;
    createdBy: { id: string; name: string | null; image: string | null };
    members: ProjectMember[];
    tasks: ProjectTask[];
    cycles?: {
        id: string;
        status: string;
        semesterId: string;
        semester?: { id: string; name: string };
    }[];
}

interface Props {
    projects: Project[];
    canCreate: boolean;
    currentUserId: string;
    canViewAny?: boolean;
}

// ─── Status/Priority Visual Configs ──────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
    PLANNING: { label: "Planificación", color: "bg-slate-100 text-slate-700", icon: Clock },
    ACTIVE: { label: "Activo", color: "bg-emerald-100 text-emerald-700", icon: Zap },
    PAUSED: { label: "Pausado", color: "bg-amber-100 text-amber-700", icon: Pause },
    COMPLETED: { label: "Completado", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: X },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; chip: string; icon: React.ComponentType<any> }> = {
    LOW: { label: "Baja", color: "text-slate-500", chip: "bg-slate-100 text-slate-700 border-slate-200", icon: Minus },
    MEDIUM: { label: "Media", color: "text-amber-600", chip: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
    HIGH: { label: "Alta", color: "text-orange-600", chip: "bg-orange-100 text-orange-700 border-orange-200", icon: Flame },
    CRITICAL: { label: "Crítica", color: "text-red-600", chip: "bg-red-100 text-red-700 border-red-200", icon: Zap },
};

const PRIORITY_WEIGHT: Record<string, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
};

type ViewMode = "cards" | "list";
type SortMode =
    | "importance_desc"
    | "importance_asc"
    | "deadline_asc"
    | "start_desc"
    | "progress_desc"
    | "members_desc"
    | "created_desc";

function formatShortDate(value: Date | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function toRgba(hex: string | null | undefined, alpha: number) {
    const fallback = { r: 99, g: 102, b: 241 };
    if (!hex || !/^#([0-9a-fA-F]{6})$/.test(hex)) {
        return `rgba(${fallback.r}, ${fallback.g}, ${fallback.b}, ${alpha})`;
    }
    const clean = hex.slice(1);
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getUniqueMembers(members: ProjectMember[]) {
    const seen = new Set<string>();
    const unique: ProjectMember[] = [];
    for (const member of members) {
        const id = member.user.id;
        if (seen.has(id)) continue;
        seen.add(id);
        unique.push(member);
    }
    return unique;
}

function MemberBubbles({ members, max = 4 }: { members: ProjectMember[]; max?: number }) {
    const uniqueMembers = getUniqueMembers(members);
    const visible = uniqueMembers.slice(0, max);
    const remaining = uniqueMembers.length - visible.length;

    if (uniqueMembers.length === 0) {
        return <span className="text-xs text-gray-400">Sin miembros</span>;
    }

    return (
        <div className="flex items-center">
            <div className="flex -space-x-2">
                {visible.map((member) => (
                    <div key={member.user.id} className="h-8 w-8 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white" title={member.user.name || "Miembro"}>
                        <UserAvatar
                            src={member.user.image}
                            name={member.user.name}
                            className="h-full w-full"
                            fallbackClassName="bg-meteorite-100 text-[10px] text-meteorite-700"
                        />
                    </div>
                ))}
                {remaining > 0 && (
                    <div className="h-8 w-8 rounded-full border-2 border-white shadow-sm bg-meteorite-900 text-white text-[11px] font-black flex items-center justify-center" title={`${remaining} miembros más`}>
                        +{remaining}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectsList({ projects, canCreate, currentUserId, canViewAny = false }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>("cards");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [sortMode, setSortMode] = useState<SortMode>("importance_desc");

    // Form
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<string>("MEDIUM");
    const [color, setColor] = useState("#6366f1");
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
                color,
                startDate: startDate ? new Date(startDate) : null,
                deadline: deadline ? new Date(deadline) : null,
            });
            if (res.success) {
                showFeedback("success", res.message || "Proyecto creado.");
                setShowCreate(false);
                setName(""); setDescription(""); setPriority("MEDIUM"); setColor("#6366f1"); setStartDate(""); setDeadline("");
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

    const enrichedProjects = useMemo(() => {
        return projects.map((project) => {
            const stats = getTaskStats(project.tasks);
            const priorityWeight = PRIORITY_WEIGHT[project.priority] || 0;
            const uniqueMemberCount = getUniqueMembers(project.members).length;
            const isMember = project.members.some((member) => member.user.id === currentUserId);
            const isMultiCycle = (project.cycles?.length ?? 0) > 1;
            const isReadOnly = (project.cycles?.length ?? 0) > 0
                ? !project.cycles!.some((cycle) => cycle.status === "ACTIVE")
                : false;

            return {
                ...project,
                stats,
                priorityWeight,
                uniqueMemberCount,
                isMember,
                isMultiCycle,
                isReadOnly,
            };
        });
    }, [projects, currentUserId]);

    const filteredAndSortedProjects = useMemo(() => {
        const text = search.trim().toLowerCase();

        const filtered = enrichedProjects.filter((project) => {
            const matchesSearch = !text
                || project.name.toLowerCase().includes(text)
                || (project.description || "").toLowerCase().includes(text);

            const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
            const matchesPriority = priorityFilter === "ALL" || project.priority === priorityFilter;

            return matchesSearch && matchesStatus && matchesPriority;
        });

        filtered.sort((a, b) => {
            if (sortMode === "importance_desc") return b.priorityWeight - a.priorityWeight;
            if (sortMode === "importance_asc") return a.priorityWeight - b.priorityWeight;
            if (sortMode === "deadline_asc") {
                const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                return aTime - bTime;
            }
            if (sortMode === "start_desc") {
                const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
                const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
                return bTime - aTime;
            }
            if (sortMode === "progress_desc") return b.stats.pct - a.stats.pct;
            if (sortMode === "members_desc") return b.uniqueMemberCount - a.uniqueMemberCount;

            const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bCreated - aCreated;
        });

        return filtered;
    }, [enrichedProjects, search, statusFilter, priorityFilter, sortMode]);

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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <div>
                            <label className="block text-sm font-bold text-meteorite-700 mb-1">Color</label>
                            <div className="h-[42px] px-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                                />
                                <span className="text-xs font-bold text-gray-500">{color.toUpperCase()}</span>
                            </div>
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
                        <button onClick={() => {
                            setShowCreate(false);
                            setColor("#6366f1");
                        }}
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

            {/* Listing Controls */}
            <div className="bg-white/75 backdrop-blur-md border border-meteorite-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-meteorite-500" />
                        <p className="text-xs font-black text-meteorite-700 uppercase tracking-wider">
                            {canViewAny ? "Vista completa de proyectos" : "Tus proyectos visibles"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                            {filteredAndSortedProjects.length} resultado{filteredAndSortedProjects.length === 1 ? "" : "s"}
                        </span>
                        <div className="bg-white border border-meteorite-200 rounded-xl p-1 flex items-center">
                            <button
                                onClick={() => setViewMode("cards")}
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === "cards" ? "bg-meteorite-100 text-meteorite-700" : "text-meteorite-400 hover:text-meteorite-600"}`}
                                title="Vista tarjetas"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-meteorite-100 text-meteorite-700" : "text-meteorite-400 hover:text-meteorite-600"}`}
                                title="Vista lista"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="relative xl:col-span-2">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-meteorite-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nombre o descripción..."
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-meteorite-900 placeholder:text-gray-400 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none"
                        />
                    </div>

                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none"
                    >
                        <option value="ALL">Prioridad: Todas</option>
                        {PROJECT_PRIORITIES.map((item) => (
                            <option key={item} value={item}>
                                Prioridad: {PRIORITY_CONFIG[item]?.label || item}
                            </option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-meteorite-900 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none"
                    >
                        <option value="ALL">Estado: Todos</option>
                        {PROJECT_STATUSES.map((item) => (
                            <option key={item} value={item}>
                                Estado: {STATUS_CONFIG[item]?.label || item}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-meteorite-500" />
                    <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as SortMode)}
                        className="w-full md:w-auto px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-meteorite-700 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none"
                    >
                        <option value="importance_desc">Importancia: Crítica -&gt; Baja</option>
                        <option value="importance_asc">Importancia: Baja -&gt; Crítica</option>
                        <option value="deadline_asc">Deadline más próximo</option>
                        <option value="start_desc">Inicio más reciente</option>
                        <option value="progress_desc">Mayor progreso</option>
                        <option value="members_desc">Más miembros</option>
                        <option value="created_desc">Creación más reciente</option>
                    </select>
                </div>
            </div>

            {filteredAndSortedProjects.length === 0 ? (
                <div className="bg-white/60 border border-meteorite-100 rounded-2xl p-12 text-center">
                    <FolderKanban className="w-16 h-16 text-meteorite-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-meteorite-950 mb-1">Sin resultados</h3>
                    <p className="text-meteorite-500 text-sm">Ajusta los filtros o crea un nuevo proyecto.</p>
                </div>
            ) : (
                <>
                    {viewMode === "cards" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredAndSortedProjects.map((project) => {
                                const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
                                const prioConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.MEDIUM;
                                const StatusIcon = status.icon;
                                const PrioIcon = prioConfig.icon;
                                const accent = project.color || "#6366f1";

                                return (
                                    <article
                                        key={project.id}
                                        className="group rounded-3xl border border-white/70 bg-white/85 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300"
                                        style={{
                                            backgroundImage: `radial-gradient(140% 120% at 100% 0%, ${toRgba(accent, 0.16)} 0%, rgba(255,255,255,0.86) 45%, rgba(255,255,255,0.95) 100%)`,
                                        }}
                                    >
                                        <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${toRgba(accent, 0.95)} 0%, ${toRgba(accent, 0.45)} 70%, rgba(255,255,255,0.2) 100%)` }} />

                                        <div className="p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-2 min-w-0">
                                                    <Link
                                                        href={`/dashboard/projects/${project.id}`}
                                                        className="block text-xl font-black text-meteorite-950 hover:text-violet-700 transition-colors leading-tight line-clamp-2"
                                                    >
                                                        {project.name}
                                                    </Link>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black ${status.color}`}>
                                                            <StatusIcon className="w-3.5 h-3.5" />
                                                            {status.label}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border ${prioConfig.chip}`}>
                                                            <PrioIcon className="w-3.5 h-3.5" />
                                                            Prioridad {prioConfig.label}
                                                        </span>
                                                        {project.isMultiCycle && (
                                                            <span className="px-2 py-1 rounded-lg text-[11px] font-black bg-indigo-100 text-indigo-700">
                                                                Multi-ciclo
                                                            </span>
                                                        )}
                                                        {project.isReadOnly && (
                                                            <span className="px-2 py-1 rounded-lg text-[11px] font-black bg-rose-100 text-rose-700">
                                                                Solo lectura
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-meteorite-400">Progreso</p>
                                                    <p className="text-lg font-black text-meteorite-900">{project.stats.pct}%</p>
                                                </div>
                                            </div>

                                            {project.description && (
                                                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                                    {project.description}
                                                </p>
                                            )}

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-xl border border-white/60 bg-white/75 px-3 py-2">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                                        <Timer className="w-3 h-3" />
                                                        Inicio
                                                    </p>
                                                    <p className="text-xs font-bold text-meteorite-800 mt-1">{formatShortDate(project.startDate)}</p>
                                                </div>
                                                <div className="rounded-xl border border-white/60 bg-white/75 px-3 py-2">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                                        <CalendarDays className="w-3 h-3" />
                                                        Deadline
                                                    </p>
                                                    <p className="text-xs font-bold text-meteorite-800 mt-1">{formatShortDate(project.deadline)}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                                                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Tareas</span>
                                                    <span>{project.stats.done}/{project.stats.total}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-white/80 border border-white/70 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${project.stats.pct}%`,
                                                            background: `linear-gradient(90deg, ${toRgba(accent, 0.95)} 0%, ${toRgba(accent, 0.6)} 100%)`,
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Equipo</p>
                                                    <MemberBubbles members={project.members} max={4} />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {project.isMember && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-violet-100 text-violet-700">
                                                            <Sparkles className="w-3 h-3" />
                                                            Miembro
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(project.id, project.name)}
                                                        disabled={isPending}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Eliminar proyecto"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <Link
                                                        href={`/dashboard/projects/${project.id}`}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 rounded-lg transition-colors"
                                                    >
                                                        Ver <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAndSortedProjects.map((project) => {
                                const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
                                const prioConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.MEDIUM;
                                const StatusIcon = status.icon;
                                const PrioIcon = prioConfig.icon;
                                const accent = project.color || "#6366f1";

                                return (
                                    <article
                                        key={project.id}
                                        className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-md p-4 hover:shadow-lg transition-all"
                                        style={{ borderLeftColor: accent, borderLeftWidth: "6px" }}
                                    >
                                        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                                            <div className="min-w-0 xl:flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <Link href={`/dashboard/projects/${project.id}`} className="text-lg font-black text-meteorite-950 hover:text-violet-700 transition-colors line-clamp-1">
                                                        {project.name}
                                                    </Link>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${status.color}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {status.label}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${prioConfig.chip}`}>
                                                        <PrioIcon className="w-3 h-3" />
                                                        {prioConfig.label}
                                                    </span>
                                                    {project.isReadOnly && (
                                                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700">
                                                            Solo lectura
                                                        </span>
                                                    )}
                                                </div>
                                                {project.description && (
                                                    <p className="text-sm text-gray-500 line-clamp-1">{project.description}</p>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 xl:min-w-[560px] items-center">
                                                <div className="text-xs">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Inicio</p>
                                                    <p className="font-bold text-meteorite-800">{formatShortDate(project.startDate)}</p>
                                                </div>
                                                <div className="text-xs">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Deadline</p>
                                                    <p className="font-bold text-meteorite-800">{formatShortDate(project.deadline)}</p>
                                                </div>
                                                <div className="text-xs">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Tareas</p>
                                                    <p className="font-bold text-meteorite-800">{project.stats.done}/{project.stats.total}</p>
                                                </div>
                                                <div className="text-xs">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Avance</p>
                                                    <p className="font-black text-meteorite-900">{project.stats.pct}%</p>
                                                </div>
                                                <div className="col-span-2 md:col-span-4 xl:col-span-1">
                                                    <MemberBubbles members={project.members} max={5} />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 xl:ml-auto">
                                                <button
                                                    onClick={() => handleDelete(project.id, project.name)}
                                                    disabled={isPending}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Eliminar proyecto"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <Link
                                                    href={`/dashboard/projects/${project.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                                                >
                                                    Ver <ChevronRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
