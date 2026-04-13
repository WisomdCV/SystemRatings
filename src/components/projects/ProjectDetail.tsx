"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
    updateProjectAction, removeProjectMemberAction,
    updateProjectMemberRoleAction, createTaskAction, updateTaskStatusAction,
    deleteTaskAction, assignTaskAction, unassignTaskAction, reorderTasksAction,
    extendProjectCycleAction, archiveProjectCycleAction,
} from "@/server/actions/project.actions";
import { createProjectInvitationAction, cancelProjectInvitationAction } from "@/server/actions/project-invitations.actions";
import { PROJECT_STATUSES, PROJECT_PRIORITIES, TASK_STATUSES, TASK_PRIORITIES } from "@/lib/validators/project";
import {
    Users, ListChecks, Plus, Loader2, Trash2, Crown, UserPlus,
    CheckCircle2, XCircle, Circle, Clock, AlertTriangle, Search,
    ChevronDown, Zap, Flame, Minus, Pause, X, Eye, UserMinus, Shield,
    Settings, CalendarDays, Timer, Sparkles, Filter
} from "lucide-react";
import ProjectResourcesPanel from "@/components/projects/ProjectResourcesPanel";
import TaskKanbanView from "@/components/projects/TaskKanbanView";
import TaskDetailPanel from "@/components/projects/TaskDetailPanel";
import {
    DEFAULT_TASK_FILTERS,
    getAgingConfig,
    getTaskAgingLevel,
    getTaskDuration,
    getTaskTimeProgress,
    loadTaskFilters,
    saveTaskFilters,
} from "@/lib/task-utils";

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
    updatedAt: Date | null;
    startDate: Date | null;
    dueDate: Date | null;
    completedAt: Date | null;
    position: number | null;
    projectArea: { id: string; name: string; color: string | null } | null;
    createdBy: { id: string; name: string | null; image: string | null };
    assignments: TaskAssignment[];
    _commentCount?: number;
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
    color: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    deadline: Date | null;
    createdBy: { id: string; name: string | null; image: string | null; email: string };
    semester: { id: string; name: string };
    isWritable?: boolean;
    cycles?: { id: string; status: string; semesterId: string; semester?: { id: string; name: string } }[];
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

interface ProjectInvitation {
    id: string;
    status: string;
    message: string | null;
    expiresAt: Date | null;
    createdAt: Date | null;
    user: { id: string; name: string | null; email: string; image: string | null };
    invitedBy: { id: string; name: string | null; image: string | null };
    projectRole: { id: string; name: string; color: string | null };
    projectArea: { id: string; name: string } | null;
}

interface ResourceCategory {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    projectId: string | null;
}

interface ResourceLink {
    id: string;
    url: string;
    previewUrl: string | null;
    label: string | null;
    domain: string | null;
    linkStatus: string;
    addedById: string;
    addedBy: { id: string; name: string | null; image: string | null } | null;
}

interface ProjectResource {
    id: string;
    name: string;
    description: string | null;
    projectAreaId: string | null;
    taskId: string | null;
    createdById: string;
    createdAt: Date | null;
    category: { id: string; name: string; color: string | null; icon: string | null } | null;
    projectArea: { id: string; name: string; color: string | null } | null;
    task: { id: string; title: string } | null;
    createdBy: { id: string; name: string | null; image: string | null } | null;
    links: ResourceLink[];
}

interface Props {
    project: Project;
    eligibleUsers: EligibleUser[];
    allProjectRoles: ProjectRole[];
    allProjectAreas: ProjectArea[];
    currentUserId: string;
    isSystemAdmin: boolean;
    currentUserHierarchyLevel: number;
    projectInvitations: ProjectInvitation[];
    resourceCategories: ResourceCategory[];
    projectResources: ProjectResource[];
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

const PRIORITY_LABEL: Record<string, string> = {
    LOW: "Baja",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Crítica",
};

const PRIORITY_TONE: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-700 border-slate-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

const toDateInput = (value: Date | null) => {
    if (!value) return "";
    return new Date(value).toISOString().split("T")[0];
};

const normalizeHexColor = (value: string) => {
    const text = value.trim().toUpperCase();
    if (!text) return null;
    const withHash = text.startsWith("#") ? text : `#${text}`;
    return HEX_COLOR_REGEX.test(withHash) ? withHash : null;
};

const colorToRgba = (hex: string | null | undefined, alpha: number) => {
    const normalized = normalizeHexColor(hex || "") || "#6366F1";
    const clean = normalized.slice(1);
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatShortDate = (value: Date | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectDetail({ project, eligibleUsers, allProjectRoles, allProjectAreas, currentUserId, isSystemAdmin, currentUserHierarchyLevel, projectInvitations, resourceCategories, projectResources }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Member add
    const [showAddMember, setShowAddMember] = useState(false);
    const [showAddMemberMobileSheet, setShowAddMemberMobileSheet] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");
    const [selectedAreaId, setSelectedAreaId] = useState<string>("none"); // 'none' means system/sin area
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");
    const [invitationMessage, setInvitationMessage] = useState("");

    // Task create
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskPriority, setTaskPriority] = useState("MEDIUM");
    const [taskStart, setTaskStart] = useState("");
    const [taskDue, setTaskDue] = useState("");
    const [taskAreaId, setTaskAreaId] = useState<string>("none");

    // Task assign
    const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
    const [assignSearch, setAssignSearch] = useState("");

    // Project edit
    const [showEditProject, setShowEditProject] = useState(false);
    const [editName, setEditName] = useState(project.name);
    const [editDescription, setEditDescription] = useState(project.description || "");
    const [editColor, setEditColor] = useState(project.color || "#6366f1");
    const [editColorText, setEditColorText] = useState((project.color || "#6366f1").toUpperCase());
    const [editPriority, setEditPriority] = useState(project.priority);
    const [editStatus, setEditStatus] = useState(project.status);
    const [editStartDate, setEditStartDate] = useState(toDateInput(project.startDate));
    const [editDeadline, setEditDeadline] = useState(toDateInput(project.deadline));

    // Task filter
    const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_TASK_FILTERS.statusFilter);
    const [areaFilter, setAreaFilter] = useState<string>(DEFAULT_TASK_FILTERS.areaFilter);
    const [priorityFilter, setPriorityFilter] = useState<string>(DEFAULT_TASK_FILTERS.priorityFilter);
    const [assigneeFilter, setAssigneeFilter] = useState<string>(DEFAULT_TASK_FILTERS.assigneeFilter);
    const [agingFilter, setAgingFilter] = useState<string>(DEFAULT_TASK_FILTERS.agingFilter);
    const [viewMode, setViewMode] = useState<"list" | "kanban">(DEFAULT_TASK_FILTERS.viewMode);
    const [sortBy, setSortBy] = useState<"position" | "priority" | "dueDate" | "aging" | "createdAt">(DEFAULT_TASK_FILTERS.sortBy);
    const [showTaskFilters, setShowTaskFilters] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [teamSearch, setTeamSearch] = useState("");
    const [collapsedAreaGroups, setCollapsedAreaGroups] = useState<Record<string, boolean>>({});
    const [expandedAreaGroups, setExpandedAreaGroups] = useState<Record<string, boolean>>({});

    const userMembership = project.members.find(m => m.user.id === currentUserId);
    const userProjectRole = userMembership?.projectRole;
    const userPerms = (userProjectRole?.permissions ?? []).map(p => p.permission);
    const projectWritable = project.isWritable ?? true;
    const hasCycleStatusPerm = isSystemAdmin || userPerms.includes("project:manage_status");
    const canManage = isSystemAdmin || userPerms.includes("project:manage_settings");
    const canManageMembers = (isSystemAdmin || userPerms.includes("project:manage_members")) && projectWritable;
    const canChangeStatus = isSystemAdmin || userPerms.includes("project:manage_status");
    const userCanCreateTasks = (isSystemAdmin || userPerms.includes("project:task_create_any") || userPerms.includes("project:task_create_own_area")) && projectWritable;
    const canReorderTasks = (isSystemAdmin || userPerms.includes("project:task_manage_any") || userPerms.includes("project:task_update_status")) && projectWritable;
    const canArchiveCycle = hasCycleStatusPerm && projectWritable;
    const canExtendCycle = hasCycleStatusPerm && !projectWritable && ["ACTIVE", "PAUSED", "PLANNING"].includes(project.status);
    const userProjectAreaId = userMembership?.projectArea?.id || null;
    const userProjectAreaName = userMembership?.projectArea?.name || null;
    const assignableRoles = isSystemAdmin
        ? allProjectRoles
        : allProjectRoles.filter(r => r.hierarchyLevel <= currentUserHierarchyLevel);
    const defaultAssignableRole = assignableRoles.reduce<ProjectRole | null>((lowest, role) => {
        if (!lowest) return role;
        return role.hierarchyLevel < lowest.hierarchyLevel ? role : lowest;
    }, null);
    const defaultAssignableRoleId = defaultAssignableRole?.id || "";
    // Only own-area permission = restricted to own area or general tasks
    const isAreaRestricted = !isSystemAdmin && !userPerms.includes("project:task_create_any") && userPerms.includes("project:task_create_own_area");

    useEffect(() => {
        if (!showAddMember && !showAddMemberMobileSheet) return;
        if (!selectedRoleId && defaultAssignableRoleId) {
            setSelectedRoleId(defaultAssignableRoleId);
        }
    }, [showAddMember, showAddMemberMobileSheet, selectedRoleId, defaultAssignableRoleId]);

    useEffect(() => {
        const saved = loadTaskFilters(project.id);
        if (!saved) return;
        setAreaFilter(saved.areaFilter);
        setStatusFilter(saved.statusFilter);
        setPriorityFilter(saved.priorityFilter);
        setAssigneeFilter(saved.assigneeFilter);
        setAgingFilter(saved.agingFilter);
        setViewMode(saved.viewMode);
        setSortBy(saved.sortBy);
    }, [project.id]);

    useEffect(() => {
        saveTaskFilters(project.id, {
            areaFilter,
            statusFilter,
            priorityFilter,
            assigneeFilter,
            agingFilter,
            viewMode,
            sortBy,
        });
    }, [project.id, areaFilter, statusFilter, priorityFilter, assigneeFilter, agingFilter, viewMode, sortBy]);

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const resetAddMemberFields = () => {
        setMemberSearch("");
        setSelectedAreaId("none");
        setSelectedRoleId("");
        setInvitationMessage("");
    };

    const closeAddMemberPanels = () => {
        setShowAddMember(false);
        setShowAddMemberMobileSheet(false);
        resetAddMemberFields();
    };

    const openEditProject = () => {
        setEditName(project.name);
        setEditDescription(project.description || "");
        const nextColor = normalizeHexColor(project.color || "") || "#6366F1";
        setEditColor(nextColor);
        setEditColorText(nextColor);
        setEditPriority(project.priority);
        setEditStatus(project.status);
        setEditStartDate(toDateInput(project.startDate));
        setEditDeadline(toDateInput(project.deadline));
        setShowEditProject(true);
    };

    const handleUpdateProject = () => {
        if (!editName.trim()) {
            showFeedback("error", "El nombre del proyecto es obligatorio.");
            return;
        }

        const normalizedColor = normalizeHexColor(editColorText) || normalizeHexColor(editColor) || "#6366F1";

        startTransition(async () => {
            const res = await updateProjectAction({
                id: project.id,
                name: editName.trim(),
                description: editDescription.trim() ? editDescription : null,
                color: normalizedColor,
                priority: editPriority as any,
                status: (canChangeStatus ? editStatus : project.status) as any,
                startDate: editStartDate ? new Date(editStartDate) : null,
                deadline: editDeadline ? new Date(editDeadline) : null,
            });

            if (res.success) {
                showFeedback("success", res.message || "Proyecto actualizado.");
                setShowEditProject(false);
                router.refresh();
            } else {
                showFeedback("error", res.error || "Error al actualizar proyecto.");
            }
        });
    };

    const handleArchiveCycle = () => {
        startTransition(async () => {
            const res = await archiveProjectCycleAction(project.id);
            if (res.success) {
                showFeedback("success", res.message || "Ciclo archivado.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "No se pudo archivar el ciclo.");
            }
        });
    };

    const handleExtendCycle = () => {
        startTransition(async () => {
            const res = await extendProjectCycleAction(project.id);
            if (res.success) {
                showFeedback("success", res.message || "Proyecto extendido al ciclo activo.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "No se pudo extender el proyecto.");
            }
        });
    };

    // ── Members ──
    const handleAddMember = (userId: string) => {
        startTransition(async () => {
            const roleId = selectedRoleId || defaultAssignableRoleId;
            if (!roleId) {
                showFeedback("error", "No tienes roles asignables disponibles.");
                return;
            }
            const payload: any = {
                projectId: project.id,
                userId,
                projectRoleId: roleId,
                message: invitationMessage.trim() ? invitationMessage.trim() : null,
            };
            if (selectedAreaId !== "none") payload.projectAreaId = selectedAreaId;

            const res = await createProjectInvitationAction(payload);
            if (res.success) { showFeedback("success", res.message!); closeAddMemberPanels(); router.refresh(); }
            else showFeedback("error", res.error!);
        });
    };

    const handleCancelInvitation = (invitationId: string) => {
        startTransition(async () => {
            const res = await cancelProjectInvitationAction({ invitationId });
            if (res.success) {
                showFeedback("success", res.message || "Invitación cancelada.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "No se pudo cancelar la invitación.");
            }
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
                startDate: taskStart ? new Date(taskStart) : null,
                dueDate: taskDue ? new Date(taskDue) : null,
                projectAreaId: taskAreaId !== "none" ? taskAreaId : undefined,
            });
            if (res.success) {
                showFeedback("success", res.message!);
                setShowCreateTask(false); setTaskTitle(""); setTaskDescription(""); setTaskPriority("MEDIUM"); setTaskStart(""); setTaskDue(""); setTaskAreaId("none");
                router.refresh();
            } else showFeedback("error", res.error!);
        });
    };

    const handleReorderTasks = (updates: { taskId: string; position: number; status?: string }[]) => {
        startTransition(async () => {
            const res = await reorderTasksAction({ projectId: project.id, updates });
            if (res.success) {
                showFeedback("success", res.message || "Tareas reordenadas.");
                router.refresh();
            } else {
                showFeedback("error", res.error || "No se pudo reordenar.");
            }
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

    const filteredTasks = useMemo(() => {
        let result = [...project.tasks];

        if (areaFilter === "GENERAL") {
            result = result.filter((t) => !t.projectArea);
        } else if (areaFilter !== "ALL") {
            result = result.filter((t) => t.projectArea?.id === areaFilter);
        }

        if (statusFilter !== "ALL") {
            result = result.filter((t) => t.status === statusFilter);
        }

        if (priorityFilter !== "ALL") {
            result = result.filter((t) => t.priority === priorityFilter);
        }

        if (assigneeFilter === "UNASSIGNED") {
            result = result.filter((t) => t.assignments.length === 0);
        } else if (assigneeFilter !== "ALL") {
            result = result.filter((t) => t.assignments.some((a) => a.user.id === assigneeFilter));
        }

        if (agingFilter !== "ALL") {
            result = result.filter((t) => {
                const level = getTaskAgingLevel(t.status, t.updatedAt);
                if (agingFilter === "WARNING") return level !== "NONE";
                if (agingFilter === "DANGER") return level === "DANGER" || level === "CRITICAL";
                if (agingFilter === "CRITICAL") return level === "CRITICAL";
                return true;
            });
        }

        result.sort((a, b) => {
            switch (sortBy) {
                case "priority": {
                    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as Record<string, number>;
                    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
                }
                case "dueDate":
                    return (a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY)
                        - (b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY);
                case "aging": {
                    const agingOrder = { CRITICAL: 0, DANGER: 1, WARNING: 2, NONE: 3 } as Record<string, number>;
                    const aLevel = getTaskAgingLevel(a.status, a.updatedAt);
                    const bLevel = getTaskAgingLevel(b.status, b.updatedAt);
                    return (agingOrder[aLevel] ?? 3) - (agingOrder[bLevel] ?? 3);
                }
                case "createdAt":
                    return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                default:
                    return (a.position ?? 0) - (b.position ?? 0);
            }
        });

        return result;
    }, [project.tasks, areaFilter, statusFilter, priorityFilter, assigneeFilter, agingFilter, sortBy]);

    const filteredEligible = eligibleUsers.filter(u => {
        if (!memberSearch) return true;
        const term = memberSearch.toLowerCase();
        return u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    });

    const pendingProjectInvitations = projectInvitations.filter((inv) => inv.status === "PENDING");

    const filteredAssignUsers = project.members.filter(m => {
        if (!assignSearch) return true;
        const term = assignSearch.toLowerCase();
        return m.user.name?.toLowerCase().includes(term) || m.user.email.toLowerCase().includes(term);
    });

    const groupedMembers = useMemo(() => {
        const sortedMembers = [...project.members]
            .filter((member) => {
                if (!teamSearch.trim()) return true;
                const term = teamSearch.trim().toLowerCase();
                const areaName = member.projectArea?.name || "Gestión de Proyecto";
                return (member.user.name || "").toLowerCase().includes(term)
                    || member.user.email.toLowerCase().includes(term)
                    || member.projectRole.name.toLowerCase().includes(term)
                    || areaName.toLowerCase().includes(term);
            })
            .sort((a, b) => b.projectRole.hierarchyLevel - a.projectRole.hierarchyLevel);

        const grouped = sortedMembers.reduce((acc, current) => {
            const areaId = current.projectArea?.id || "general";
            const areaName = current.projectArea?.name || "Gestión de Proyecto";
            if (!acc[areaId]) {
                acc[areaId] = {
                    id: areaId,
                    label: areaName,
                    color: current.projectArea?.color || "#94a3b8",
                    members: [],
                };
            }
            acc[areaId].members.push(current);
            return acc;
        }, {} as Record<string, { id: string; label: string; color: string; members: Member[] }>);

        return Object.values(grouped).sort((a, b) => {
            if (a.id === "general") return -1;
            if (b.id === "general") return 1;
            return a.label.localeCompare(b.label);
        });
    }, [project.members, teamSearch]);

    // Stats
    const taskStats = {
        total: project.tasks.length,
        done: project.tasks.filter(t => t.status === "DONE").length,
        inProgress: project.tasks.filter(t => t.status === "IN_PROGRESS").length,
        blocked: project.tasks.filter(t => t.status === "BLOCKED").length,
    };
    const progressPercent = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;
    const selectedTask = project.tasks.find((task) => task.id === selectedTaskId) || null;
    const canReorderInCurrentView = canReorderTasks
        && viewMode === "kanban"
        && sortBy === "position"
        && areaFilter === "ALL"
        && statusFilter === "ALL"
        && priorityFilter === "ALL"
        && assigneeFilter === "ALL"
        && agingFilter === "ALL";
    const selectedTaskResources = selectedTask
        ? projectResources
            .filter((resource) => resource.taskId === selectedTask.id)
            .map((resource) => ({
                id: resource.id,
                name: resource.name,
                links: resource.links.map((link) => ({ id: link.id, url: link.url, label: link.label })),
            }))
        : [];
    const accentColor = normalizeHexColor(project.color || "") || "#6366F1";
    const projectCode = project.id.split("-")[0].toUpperCase();
    const reviewCount = project.tasks.filter((task) => task.status === "REVIEW").length;
    const addMemberCandidates = filteredEligible.slice(0, 14);

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

            {/* Hero Banner */}
            <div
                className="relative overflow-hidden rounded-3xl border border-white/70 shadow-xl"
                style={{
                    backgroundImage: `radial-gradient(140% 120% at 100% 0%, ${colorToRgba(accentColor, 0.26)} 0%, rgba(255,255,255,0.88) 48%, rgba(255,255,255,0.97) 100%)`,
                }}
            >
                <div
                    className="absolute inset-x-0 top-0 h-2"
                    style={{
                        background: `linear-gradient(90deg, ${colorToRgba(accentColor, 0.98)} 0%, ${colorToRgba(accentColor, 0.5)} 65%, rgba(255,255,255,0.2) 100%)`,
                    }}
                />

                <div className="p-5 md:p-6">
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                        <div className="min-w-0 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase bg-white/90 border border-white/80 text-meteorite-700">
                                    COD {projectCode}
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${PRIORITY_TONE[project.priority] || PRIORITY_TONE.MEDIUM}`}>
                                    Prioridad {PRIORITY_LABEL[project.priority] || project.priority}
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${STATUS_BADGE[project.status]?.color || "bg-gray-100 text-gray-600"}`}>
                                    {STATUS_BADGE[project.status]?.label || project.status}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-meteorite-950 leading-tight">{project.name}</h3>
                                {project.description && (
                                    <p className="mt-1 text-sm text-meteorite-600 max-w-3xl line-clamp-2">{project.description}</p>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-meteorite-600">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/80 border border-white/80">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Ciclo: {project.semester.name}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/80 border border-white/80">
                                    <Timer className="w-3.5 h-3.5" />
                                    Inicio: {formatShortDate(project.startDate)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/80 border border-white/80">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Deadline: {formatShortDate(project.deadline)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/80 border border-white/80">
                                    <Users className="w-3.5 h-3.5" />
                                    Equipo: {project.members.length}
                                </span>
                            </div>
                        </div>

                        <div className="w-full xl:max-w-sm space-y-3">
                            <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-md p-3">
                                <div className="flex items-center justify-between text-[11px] font-black text-meteorite-600 mb-1">
                                    <span>Progreso del proyecto</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-white/80 border border-white/70 overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${progressPercent}%`,
                                            background: `linear-gradient(90deg, ${colorToRgba(accentColor, 0.98)} 0%, ${colorToRgba(accentColor, 0.65)} 100%)`,
                                        }}
                                    />
                                </div>
                                <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                                    <div className="rounded-lg bg-white/80 px-1 py-1">
                                        <p className="text-[10px] text-gray-500 font-bold">Total</p>
                                        <p className="text-sm font-black text-meteorite-800">{taskStats.total}</p>
                                    </div>
                                    <div className="rounded-lg bg-emerald-50 px-1 py-1">
                                        <p className="text-[10px] text-emerald-600 font-bold">Hecho</p>
                                        <p className="text-sm font-black text-emerald-700">{taskStats.done}</p>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 px-1 py-1">
                                        <p className="text-[10px] text-blue-600 font-bold">Rev.</p>
                                        <p className="text-sm font-black text-blue-700">{reviewCount}</p>
                                    </div>
                                    <div className="rounded-lg bg-red-50 px-1 py-1">
                                        <p className="text-[10px] text-red-600 font-bold">Bloq.</p>
                                        <p className="text-sm font-black text-red-700">{taskStats.blocked}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {canArchiveCycle && (
                                    <button
                                        onClick={handleArchiveCycle}
                                        disabled={isPending}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                    >
                                        Archivar ciclo
                                    </button>
                                )}
                                {canExtendCycle && (
                                    <button
                                        onClick={handleExtendCycle}
                                        disabled={isPending}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                    >
                                        Extender ciclo activo
                                    </button>
                                )}
                                {canManage && (
                                    <button
                                        onClick={() => showEditProject ? setShowEditProject(false) : openEditProject()}
                                        disabled={isPending}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                                        title="Editar proyecto"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        Editar proyecto
                                    </button>
                                )}
                                <span className="ml-auto text-[11px] text-gray-500 font-medium self-center">
                                    Creado por <strong>{project.createdBy.name || project.createdBy.email}</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {!projectWritable && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm text-rose-700 font-semibold">
                    Este proyecto está en modo solo lectura para este ciclo. No se permiten altas ni cambios operativos.
                </div>
            )}

            {showEditProject && canManage && (
                <div className="fixed inset-0 z-40">
                    <button
                        aria-label="Cerrar edición"
                        className="absolute inset-0 bg-meteorite-950/40 backdrop-blur-[2px]"
                        onClick={() => setShowEditProject(false)}
                    />

                    <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white/95 backdrop-blur-md border-l border-violet-100 shadow-2xl overflow-y-auto">
                        <div className="sticky top-0 z-10 px-5 py-4 border-b border-violet-100 bg-white/90 backdrop-blur-md flex items-center justify-between">
                            <h4 className="text-sm font-black text-meteorite-950 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-violet-600" />
                                Editar Proyecto
                            </h4>
                            <button
                                onClick={() => setShowEditProject(false)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-meteorite-800 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-meteorite-700 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none bg-white font-medium text-meteorite-950"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-meteorite-700 mb-1">Prioridad</label>
                                    <select
                                        value={editPriority}
                                        onChange={e => setEditPriority(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 outline-none bg-white font-medium text-meteorite-950"
                                    >
                                        {PROJECT_PRIORITIES.map(p => (
                                            <option key={p} value={p}>{PRIORITY_LABEL[p] || p}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-meteorite-700 mb-1">Color</label>
                                    <div className="rounded-xl border border-gray-200 bg-white p-2.5 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <input
                                                type="color"
                                                value={normalizeHexColor(editColor) || "#6366F1"}
                                                onChange={e => {
                                                    const next = (e.target.value || "#6366f1").toUpperCase();
                                                    setEditColor(next);
                                                    setEditColorText(next);
                                                }}
                                                className="w-9 h-9 rounded cursor-pointer border-none bg-transparent"
                                            />
                                            <input
                                                type="text"
                                                value={editColorText}
                                                onChange={(e) => setEditColorText(e.target.value.toUpperCase())}
                                                onBlur={() => {
                                                    const normalized = normalizeHexColor(editColorText);
                                                    if (normalized) {
                                                        setEditColor(normalized);
                                                        setEditColorText(normalized);
                                                    } else {
                                                        const fallback = normalizeHexColor(editColor) || "#6366F1";
                                                        setEditColor(fallback);
                                                        setEditColorText(fallback);
                                                        showFeedback("error", "Color inválido. Usa formato hexadecimal #RRGGBB.");
                                                    }
                                                }}
                                                placeholder="#6366F1"
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-violet-500 text-sm font-black uppercase tracking-wide"
                                            />
                                        </div>
                                        <div className="h-2.5 rounded-full" style={{ backgroundColor: normalizeHexColor(editColorText) || normalizeHexColor(editColor) || "#6366F1" }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-meteorite-700 mb-1">Estado</label>
                                    {canChangeStatus ? (
                                        <select
                                            value={editStatus}
                                            onChange={e => setEditStatus(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 outline-none bg-white font-medium text-meteorite-950"
                                        >
                                            {PROJECT_STATUSES.map(status => (
                                                <option key={status} value={status}>
                                                    {STATUS_BADGE[status]?.label || status}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="h-[42px] px-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${STATUS_BADGE[project.status]?.color || "bg-gray-100 text-gray-600"}`}>
                                                {STATUS_BADGE[project.status]?.label || project.status}
                                            </span>
                                            <span className="text-[11px] text-gray-500 font-medium">Sin permiso para cambiar estado</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-meteorite-700 mb-1">Descripción</label>
                                <textarea
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    rows={4}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-violet-500 outline-none bg-white font-medium text-meteorite-950 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-meteorite-700 mb-1">Inicio</label>
                                    <input
                                        type="date"
                                        value={editStartDate}
                                        onChange={e => setEditStartDate(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium text-meteorite-950"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-meteorite-700 mb-1">Deadline</label>
                                    <input
                                        type="date"
                                        value={editDeadline}
                                        onChange={e => setEditDeadline(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium text-meteorite-950"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowEditProject(false)}
                                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdateProject}
                                    disabled={isPending || !editName.trim()}
                                    className="px-4 py-2 text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {isPending ? "Guardando..." : "Guardar cambios"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddMemberMobileSheet && canManageMembers && (
                <div className="fixed inset-0 z-40 sm:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-meteorite-950/45 backdrop-blur-[2px]"
                        onClick={closeAddMemberPanels}
                        aria-label="Cerrar agregar miembro"
                    />
                    <div className="absolute inset-0 bg-white flex flex-col">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-violet-600">Equipo</p>
                                <h4 className="text-sm font-black text-meteorite-900">Agregar miembro</h4>
                            </div>
                            <button
                                type="button"
                                onClick={closeAddMemberPanels}
                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3">
                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={selectedRoleId || defaultAssignableRoleId}
                                    onChange={e => setSelectedRoleId(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-gray-200 outline-none focus:border-violet-500 text-meteorite-900 bg-white"
                                >
                                    {assignableRoles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} (Nv. {r.hierarchyLevel})</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedAreaId}
                                    onChange={e => setSelectedAreaId(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-gray-200 outline-none focus:border-violet-500 text-meteorite-900 bg-white"
                                >
                                    <option value="none">Sin Área Específica</option>
                                    {allProjectAreas.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>

                            {assignableRoles.length === 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                                    No tienes roles asignables para invitar miembros en este proyecto.
                                </div>
                            )}

                            <textarea
                                value={invitationMessage}
                                onChange={e => setInvitationMessage(e.target.value)}
                                rows={3}
                                placeholder="Mensaje opcional para la invitación..."
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none resize-none focus:border-violet-500 text-meteorite-950 placeholder:text-gray-400"
                            />
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                placeholder="Buscar usuario..."
                                autoFocus
                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-violet-500 text-meteorite-950 placeholder:text-gray-400"
                            />

                            <div className="rounded-xl border border-gray-200 bg-white max-h-[50vh] overflow-y-auto overscroll-contain">
                                {assignableRoles.length === 0 && (
                                    <div className="p-3 text-center text-xs text-gray-500">No tienes roles asignables.</div>
                                )}
                                {assignableRoles.length > 0 && addMemberCandidates.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleAddMember(u.id)}
                                        disabled={isPending}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-violet-50 text-left text-xs disabled:opacity-50 transition-colors border-b border-gray-100 last:border-0"
                                    >
                                        <span className="font-semibold text-gray-900 truncate flex-1">{u.name || u.email}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{u.role}</span>
                                    </button>
                                ))}
                                {filteredEligible.length === 0 && (
                                    <div className="p-3 text-center text-xs text-gray-500">No hay usuarios disponibles.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                <input type="date" value={taskStart} onChange={e => setTaskStart(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 outline-none bg-white text-meteorite-950 text-sm" />
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

                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden bg-white">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("list")}
                                    className={`px-3 py-1.5 text-xs font-black ${viewMode === "list" ? "bg-violet-100 text-violet-700" : "bg-white text-gray-500"}`}
                                >
                                    Lista
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("kanban")}
                                    className={`px-3 py-1.5 text-xs font-black border-l border-gray-200 ${viewMode === "kanban" ? "bg-violet-100 text-violet-700" : "bg-white text-gray-500"}`}
                                >
                                    Kanban
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowTaskFilters((prev) => !prev)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-meteorite-700 hover:bg-gray-50 transition-colors"
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {showTaskFilters ? "Ocultar filtros" : "Mostrar filtros"}
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${progressPercent}%`,
                                            background: `linear-gradient(90deg, ${colorToRgba(accentColor, 0.95)} 0%, ${colorToRgba(accentColor, 0.62)} 100%)`,
                                        }}
                                    />
                                </div>
                                <span className="text-[11px] font-bold text-gray-500">
                                    {taskStats.done}/{taskStats.total} ({progressPercent}%)
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                                <span className="text-[10px] font-bold text-gray-600 px-2 py-1 rounded-lg bg-gray-100">TODO {project.tasks.filter((task) => task.status === "TODO").length}</span>
                                <span className="text-[10px] font-bold text-blue-700 px-2 py-1 rounded-lg bg-blue-50">En progreso {taskStats.inProgress}</span>
                                <span className="text-[10px] font-bold text-violet-700 px-2 py-1 rounded-lg bg-violet-50">Revisión {reviewCount}</span>
                                <span className="text-[10px] font-bold text-emerald-700 px-2 py-1 rounded-lg bg-emerald-50">Hecho {taskStats.done}</span>
                                <span className="text-[10px] font-bold text-red-700 px-2 py-1 rounded-lg bg-red-50">Bloqueado {taskStats.blocked}</span>
                            </div>
                        </div>

                        {showTaskFilters && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                                    <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-meteorite-900">
                                        <option value="ALL">Prioridad: Todas</option>
                                        {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                                    </select>

                                    <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-meteorite-900">
                                        <option value="ALL">Asignado: Todos</option>
                                        <option value="UNASSIGNED">Sin asignar</option>
                                        {project.members.map((member) => (
                                            <option key={member.user.id} value={member.user.id}>{member.user.name || member.user.email}</option>
                                        ))}
                                    </select>

                                    <select value={agingFilter} onChange={(e) => setAgingFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-meteorite-900">
                                        <option value="ALL">Aging: Todos</option>
                                        <option value="WARNING">3+ días</option>
                                        <option value="DANGER">7+ días</option>
                                        <option value="CRITICAL">14+ días</option>
                                    </select>

                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-meteorite-900">
                                        <option value="position">Orden: Posición</option>
                                        <option value="priority">Orden: Prioridad</option>
                                        <option value="dueDate">Orden: Fecha límite</option>
                                        <option value="aging">Orden: Aging</option>
                                        <option value="createdAt">Orden: Creación</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
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
                                </div>
                            </>
                        )}
                    </div>

                    {/* Task List / Kanban */}
                    {filteredTasks.length === 0 ? (
                        <div className="bg-white/60 border border-gray-100 rounded-2xl p-8 text-center">
                            <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400 font-bold">Sin tareas en este filtro</p>
                        </div>
                    ) : viewMode === "kanban" ? (
                        <TaskKanbanView
                            tasks={filteredTasks as any}
                            canReorder={canReorderInCurrentView}
                            onReorder={handleReorderTasks}
                            onOpenTaskDetail={(taskId) => setSelectedTaskId(taskId)}
                        />
                    ) : (
                        <div className="space-y-2">
                            {filteredTasks.map(task => {
                                const statusCfg = TASK_STATUS_ICON[task.status] || TASK_STATUS_ICON.TODO;
                                const bgClass = TASK_BG_COLORS[task.status] || TASK_BG_COLORS.TODO;
                                const aging = getTaskAgingLevel(task.status, task.updatedAt);
                                const agingCfg = getAgingConfig(aging);
                                const duration = getTaskDuration(task.startDate, task.dueDate);
                                const timeProgress = getTaskTimeProgress(task.startDate, task.dueDate);

                                return (
                                    <div key={task.id} className={`border rounded-xl p-3 hover:shadow-md transition-all border-l-4 ${agingCfg.borderColor} ${bgClass}`}>
                                        <div className="flex items-start gap-3">
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
                                                <div className="flex items-start justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTaskId(task.id)}
                                                        className="text-left"
                                                    >
                                                        <p className={`font-bold text-sm leading-tight flex items-center gap-1.5 ${task.status === "DONE" ? "line-through text-gray-400" : "text-meteorite-950"}`}>
                                                            {task.priority === "CRITICAL" && <span className="inline-block shrink-0 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]" title="Prioridad Critica" />}
                                                            {task.priority === "HIGH" && <span className="inline-block shrink-0 w-2 h-2 rounded-full bg-orange-500" title="Prioridad Alta" />}
                                                            {task.title}
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">💬 {task._commentCount ?? 0}</span>
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
                                                        </div>
                                                        {task.description && (
                                                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-snug">{task.description}</p>
                                                        )}
                                                    </button>

                                                    {canManage && (
                                                        <button onClick={() => handleDeleteTask(task.id)} disabled={isPending}
                                                            className="p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50 shrink-0">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="mt-2 space-y-2">
                                                    {(task.startDate || task.dueDate) && (
                                                        <div className="text-[10px] text-gray-500 font-medium flex items-center gap-2 flex-wrap">
                                                            {task.startDate && <span>{new Date(task.startDate).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span>}
                                                            {(task.startDate && task.dueDate) && <span>→</span>}
                                                            {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span>}
                                                            {duration !== null && <span>({duration}d)</span>}
                                                        </div>
                                                    )}

                                                    {timeProgress !== null && (
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full"
                                                                style={{ width: `${timeProgress}%` }}
                                                            />
                                                        </div>
                                                    )}

                                                    {aging !== "NONE" && (
                                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${agingCfg.bgTint}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${agingCfg.dotColor} ${agingCfg.animate ? "animate-pulse" : ""}`} />
                                                            {agingCfg.label}
                                                        </span>
                                                    )}

                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {task.assignments.map(a => (
                                                            <div key={a.id} className="group relative flex items-center">
                                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black border border-white shadow-sm ring-1 ring-violet-50 z-10" title={a.user.name || "?"}>
                                                                    {(a.user.name || "?").charAt(0).toUpperCase()}
                                                                </span>
                                                                {canManage && (
                                                                    <button onClick={() => handleUnassign(a.id)} disabled={isPending}
                                                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full items-center justify-center text-[8px] z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm disabled:opacity-50 flex">
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
                                                                {assigningTaskId === task.id && (
                                                                    <div className="absolute top-8 right-0 sm:left-0 sm:right-auto z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-48 w-max max-w-[min(92vw,20rem)]">
                                                                        <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                                                                            <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                                                                                placeholder="Buscar miembro..." autoFocus
                                                                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-violet-500 transition-colors bg-white shadow-sm text-meteorite-950 placeholder:text-gray-400" />
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

                    <ProjectResourcesPanel
                        projectId={project.id}
                        currentUserId={currentUserId}
                        isSystemAdmin={isSystemAdmin}
                        userPermissions={userPerms}
                        categories={resourceCategories}
                        resources={projectResources}
                        tasks={project.tasks.map((task) => ({
                            id: task.id,
                            title: task.title,
                            isAssignedToCurrentUser: task.assignments.some((assignment) => assignment.user.id === currentUserId),
                        }))}
                        areas={allProjectAreas.map((area) => ({ id: area.id, name: area.name, color: area.color || null }))}
                    />
                </div>

                {/* ── RIGHT COLUMN: Members + Info ── */}
                <div className="space-y-4 lg:sticky lg:top-4 self-start">
                    {/* Members */}
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl">
                        <div className="px-4 py-3 bg-meteorite-900 text-white flex items-center justify-between">
                            <h4 className="font-black text-sm flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-violet-300" />
                                Equipo ({project.members.length})
                            </h4>
                            {canManageMembers && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            setShowAddMember(false);
                                            setShowAddMemberMobileSheet(true);
                                        }}
                                        disabled={isPending}
                                        className="sm:hidden p-1.5 text-violet-200 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Agregar miembro"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const next = !showAddMember;
                                            setShowAddMember(next);
                                            setShowAddMemberMobileSheet(false);
                                            if (!next) {
                                                resetAddMemberFields();
                                            }
                                        }}
                                        disabled={isPending}
                                        className="hidden sm:inline-flex p-1.5 text-violet-200 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Agregar miembro"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-4">

                        {/* Add Member Dropdown */}
                        {showAddMember && (
                            <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl relative z-20">
                                <div className="p-2 border-b border-gray-100 flex flex-col gap-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <select
                                            value={selectedRoleId || defaultAssignableRoleId}
                                            onChange={e => setSelectedRoleId(e.target.value)}
                                            className="w-full px-2 py-2 text-xs font-bold rounded-lg border border-gray-200 outline-none text-meteorite-900 bg-white"
                                        >
                                            {assignableRoles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name} (Nv. {r.hierarchyLevel})</option>
                                            ))}
                                        </select>
                                        <select
                                            value={selectedAreaId}
                                            onChange={e => setSelectedAreaId(e.target.value)}
                                            className="w-full px-2 py-2 text-xs font-bold rounded-lg border border-gray-200 outline-none text-meteorite-900 bg-white"
                                        >
                                            <option value="none">Sin Área Específica</option>
                                            {allProjectAreas.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {assignableRoles.length === 0 && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700">
                                            No tienes roles asignables para invitar miembros en este proyecto.
                                        </div>
                                    )}
                                    <textarea
                                        value={invitationMessage}
                                        onChange={e => setInvitationMessage(e.target.value)}
                                        rows={2}
                                        placeholder="Mensaje opcional para la invitación..."
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none resize-none focus:border-violet-500 text-meteorite-950 placeholder:text-gray-400"
                                    />
                                    <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                        placeholder="Buscar usuario…" autoFocus
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-violet-500 text-meteorite-950 placeholder:text-gray-400" />
                                </div>
                                <div className="max-h-56 overflow-y-auto overscroll-contain">
                                    {assignableRoles.length === 0 && (
                                        <div className="p-3 text-center text-xs text-gray-500">No tienes roles asignables.</div>
                                    )}
                                    {assignableRoles.length > 0 && addMemberCandidates.map(u => (
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

                        {canManageMembers && pendingProjectInvitations.length > 0 && (
                            <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                                <p className="text-[11px] font-black text-indigo-800 uppercase tracking-wider mb-2">
                                    Invitaciones pendientes ({pendingProjectInvitations.length})
                                </p>
                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                    {pendingProjectInvitations.map((invitation) => (
                                        <div key={invitation.id} className="rounded-lg border border-indigo-100 bg-white p-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-meteorite-900 truncate">
                                                        {invitation.user.name || invitation.user.email}
                                                    </p>
                                                    <p className="text-[10px] text-indigo-700">
                                                        Rol: <strong>{invitation.projectRole.name}</strong>
                                                        {invitation.projectArea ? ` • Área: ${invitation.projectArea.name}` : ""}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        Expira: {invitation.expiresAt
                                                            ? new Date(invitation.expiresAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
                                                            : "sin fecha"}
                                                    </p>
                                                    {invitation.message && (
                                                        <p className="text-[10px] text-gray-500 italic mt-1 line-clamp-2">&quot;{invitation.message}&quot;</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleCancelInvitation(invitation.id)}
                                                    disabled={isPending}
                                                    className="text-[10px] font-bold px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-3">
                            <input
                                type="text"
                                value={teamSearch}
                                onChange={(e) => setTeamSearch(e.target.value)}
                                placeholder="Buscar miembro, rol o área..."
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 outline-none focus:border-violet-500 text-meteorite-950 placeholder:text-gray-400"
                            />
                        </div>

                        {/* Member List Grouped by Area */}
                        <div className="space-y-2 mt-2">
                            {groupedMembers.length === 0 ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 text-center">
                                    No hay miembros que coincidan con la búsqueda.
                                </div>
                            ) : groupedMembers.map((group, index) => {
                                const isCollapsed = collapsedAreaGroups[group.id] ?? index > 0;
                                const isExpanded = expandedAreaGroups[group.id] ?? false;
                                const visibleMembers = isExpanded ? group.members : group.members.slice(0, 4);
                                const hiddenCount = group.members.length - visibleMembers.length;

                                return (
                                    <div key={group.id} className="rounded-xl border border-gray-200 bg-white">
                                        <button
                                            type="button"
                                            onClick={() => setCollapsedAreaGroups((prev) => ({ ...prev, [group.id]: !isCollapsed }))}
                                            className="w-full px-3 py-2.5 flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                                        >
                                            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
                                            <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: group.color }} />
                                            <span className="text-[11px] font-black text-meteorite-900 uppercase tracking-wider text-left">{group.label}</span>
                                            <span className="ml-auto text-[10px] font-black text-gray-500">{group.members.length}</span>
                                        </button>

                                        {!isCollapsed && (
                                            <div className="p-2 space-y-1.5">
                                                {visibleMembers.map((m) => {
                                                    const canModifyThisMember = isSystemAdmin || m.projectRole.hierarchyLevel < currentUserHierarchyLevel;

                                                    return (
                                                        <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                                            <div className="relative shrink-0">
                                                                {m.user.image ? (
                                                                    <UserAvatar src={m.user.image} name={m.user.name} alt={m.user.name || ""} className="w-8 h-8 rounded-lg shadow-sm bg-gray-100" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm"
                                                                        style={{ backgroundColor: `${group.color}20`, color: group.color }}>
                                                                        {m.user.name?.charAt(0).toUpperCase() || "?"}
                                                                    </div>
                                                                )}
                                                                {m.projectRole.isSystem && (
                                                                    <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 shadow-sm" title="Rol Maestro">
                                                                        <Crown className="w-2.5 h-2.5" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-meteorite-950 truncate leading-tight">{m.user.name || m.user.email}</p>
                                                                <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">{m.user.email}</p>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-1">
                                                                {canManageMembers && canModifyThisMember ? (
                                                                    <>
                                                                        <select
                                                                            value={m.projectRole.id}
                                                                            onChange={e => handleChangeRole(m.id, e.target.value)}
                                                                            disabled={isPending}
                                                                            className="text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer bg-white text-meteorite-900 border-gray-200 shadow-sm focus:border-violet-500 hover:border-gray-300 transition-colors"
                                                                        >
                                                                            {assignableRoles.map(r => (
                                                                                <option key={r.id} value={r.id}>{r.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <select
                                                                            value={m.projectArea?.id || "none"}
                                                                            onChange={e => handleChangeArea(m.id, e.target.value)}
                                                                            disabled={isPending}
                                                                            className="text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer bg-white text-meteorite-900 border-gray-200 shadow-sm focus:border-violet-500 hover:border-gray-300 transition-colors"
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

                                                                {canManageMembers && canModifyThisMember && m.user.id !== currentUserId && (
                                                                    <button onClick={() => handleRemoveMember(m.id)} disabled={isPending}
                                                                        className="text-[10px] flex items-center gap-1 text-red-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                                                        Quitar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {hiddenCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedAreaGroups((prev) => ({ ...prev, [group.id]: !isExpanded }))}
                                                        className="w-full mt-1 py-1.5 text-[11px] font-black text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
                                                    >
                                                        {isExpanded ? "Mostrar menos" : `Mostrar ${hiddenCount} más`}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    </div>

                    {/* Project Description */}
                    {project.description && (
                        <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4">
                            <h4 className="font-black text-meteorite-950 text-sm mb-2">Descripción</h4>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{project.description}</p>
                        </div>
                    )}

                    {/* Interaction Guide */}
                    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4">
                        <h4 className="font-black text-meteorite-950 text-sm mb-3">Guía rápida</h4>
                        <div className="space-y-2 text-[11px] text-gray-600 font-medium">
                            <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                En <strong>Kanban</strong>, abre detalle con clic en la tarjeta y arrastra solo desde el <strong>asa de arrastre</strong>.
                            </p>
                            <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                En <strong>Equipo</strong>, cada área se puede plegar/desplegar para reducir ruido visual.
                            </p>
                            <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                El botón de <strong>engranaje</strong> del banner abre la edición avanzada del proyecto.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <TaskDetailPanel
                task={selectedTask as any}
                isOpen={Boolean(selectedTask)}
                onClose={() => setSelectedTaskId(null)}
                currentUserId={currentUserId}
                canManage={canManage}
                members={project.members.map((member) => ({
                    id: member.user.id,
                    name: member.user.name,
                    email: member.user.email,
                }))}
                resources={selectedTaskResources}
                onAssign={handleAssignTask}
                onUnassign={handleUnassign}
            />
        </div>
    );
}
