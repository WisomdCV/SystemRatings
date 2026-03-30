/**
 * Task Utilities
 *
 * Aging indicators, duration calculations, and filter persistence.
 */

export const AGING_THRESHOLDS = {
  WARNING: 3,
  DANGER: 7,
  CRITICAL: 14,
} as const;

export type AgingLevel = "NONE" | "WARNING" | "DANGER" | "CRITICAL";

export function getTaskAgingLevel(
  status: string,
  updatedAt: Date | string | null,
): AgingLevel {
  if (status === "DONE") return "NONE";
  if (!updatedAt) return "NONE";

  const now = new Date();
  const lastUpdate = new Date(updatedAt);
  if (Number.isNaN(lastUpdate.getTime())) return "NONE";

  const daysSinceUpdate = Math.floor(
    (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceUpdate >= AGING_THRESHOLDS.CRITICAL) return "CRITICAL";
  if (daysSinceUpdate >= AGING_THRESHOLDS.DANGER) return "DANGER";
  if (daysSinceUpdate >= AGING_THRESHOLDS.WARNING) return "WARNING";
  return "NONE";
}

export function getAgingConfig(level: AgingLevel) {
  switch (level) {
    case "WARNING":
      return {
        label: "3+ dias inactiva",
        dotColor: "bg-amber-400",
        borderColor: "border-l-amber-400",
        bgTint: "bg-amber-50/30",
        animate: false,
      };
    case "DANGER":
      return {
        label: "7+ dias inactiva",
        dotColor: "bg-orange-500",
        borderColor: "border-l-orange-500",
        bgTint: "bg-orange-50/30",
        animate: false,
      };
    case "CRITICAL":
      return {
        label: "14+ dias inactiva",
        dotColor: "bg-red-500",
        borderColor: "border-l-red-500",
        bgTint: "bg-red-50/30",
        animate: true,
      };
    default:
      return {
        label: "",
        dotColor: "",
        borderColor: "border-l-transparent",
        bgTint: "",
        animate: false,
      };
  }
}

export function getTaskDuration(
  startDate: Date | string | null,
  dueDate: Date | string | null,
): number | null {
  if (!startDate || !dueDate) return null;
  const start = new Date(startDate);
  const end = new Date(dueDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getTaskTimeProgress(
  startDate: Date | string | null,
  dueDate: Date | string | null,
): number | null {
  if (!startDate || !dueDate) return null;

  const start = new Date(startDate).getTime();
  const end = new Date(dueDate).getTime();
  const now = Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  if (now <= start) return 0;
  if (now >= end) return 100;

  return Math.round(((now - start) / (end - start)) * 100);
}

export interface TaskFilters {
  areaFilter: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  agingFilter: string;
  viewMode: "list" | "kanban";
  sortBy: "position" | "priority" | "dueDate" | "aging" | "createdAt";
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  areaFilter: "ALL",
  statusFilter: "ALL",
  priorityFilter: "ALL",
  assigneeFilter: "ALL",
  agingFilter: "ALL",
  viewMode: "list",
  sortBy: "position",
};

export function getFilterStorageKey(projectId: string): string {
  return `task-filters-${projectId}`;
}

export function saveTaskFilters(projectId: string, filters: TaskFilters): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getFilterStorageKey(projectId), JSON.stringify(filters));
}

export function loadTaskFilters(projectId: string): TaskFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(getFilterStorageKey(projectId));
    if (!stored) return null;
    return JSON.parse(stored) as TaskFilters;
  } catch {
    return null;
  }
}
