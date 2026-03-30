"use client";

import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { TASK_STATUSES } from "@/lib/validators/project";
import { getAgingConfig, getTaskAgingLevel, getTaskDuration, getTaskTimeProgress } from "@/lib/task-utils";
import { Clock3, MessageSquare, User } from "lucide-react";

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
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  position: number | null;
  projectArea: { id: string; name: string; color: string | null } | null;
  assignments: TaskAssignment[];
  _commentCount?: number;
}

interface TaskKanbanViewProps {
  tasks: Task[];
  canReorder: boolean;
  onReorder: (updates: { taskId: string; position: number; status?: string }[]) => void;
  onOpenTaskDetail: (taskId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  REVIEW: "Revision",
  DONE: "Hecho",
  BLOCKED: "Bloqueado",
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function TaskKanbanView({
  tasks,
  canReorder,
  onReorder,
  onOpenTaskDetail,
}: TaskKanbanViewProps) {
  const baseColumns = useMemo(() => {
    const cols: Record<string, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
      BLOCKED: [],
    };

    for (const task of tasks) {
      const status = cols[task.status] ? task.status : "TODO";
      cols[status].push(task);
    }

    for (const key of Object.keys(cols)) {
      cols[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }

    return cols;
  }, [tasks]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || !canReorder) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    const sourceColumn = [...(baseColumns[sourceStatus] || [])];
    const destColumn = sourceStatus === destStatus
      ? sourceColumn
      : [...(baseColumns[destStatus] || [])];

    const [moved] = sourceColumn.splice(source.index, 1);
    if (!moved) return;
    destColumn.splice(destination.index, 0, moved);

    const updates: { taskId: string; position: number; status?: string }[] = [];

    if (sourceStatus === destStatus) {
      sourceColumn.forEach((task, idx) => {
        updates.push({ taskId: task.id, position: idx });
      });
    } else {
      sourceColumn.forEach((task, idx) => {
        updates.push({ taskId: task.id, position: idx });
      });

      destColumn.forEach((task, idx) => {
        updates.push({
          taskId: task.id,
          position: idx,
          status: task.id === draggableId ? destStatus : undefined,
        });
      });
    }

    onReorder(updates);
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-gray-500 font-medium">
        Arrastra tareas entre columnas para cambiar estado y prioridad visual.
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {TASK_STATUSES.map((status) => {
            const columnTasks = baseColumns[status] || [];

            return (
              <div key={status} className="rounded-xl border border-gray-200 bg-white min-h-[240px] flex flex-col">
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
                  <span className="text-[11px] font-black text-gray-700 uppercase tracking-wide">
                    {STATUS_LABELS[status] || status}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">
                    {columnTasks.length}
                  </span>
                </div>

                <Droppable droppableId={status} isDropDisabled={!canReorder}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-2 flex-1 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-violet-50/70" : ""}`}
                    >
                      {columnTasks.map((task, index) => {
                        const aging = getTaskAgingLevel(task.status, task.updatedAt);
                        const agingCfg = getAgingConfig(aging);
                        const duration = getTaskDuration(task.startDate, task.dueDate);
                        const timeProgress = getTaskTimeProgress(task.startDate, task.dueDate);

                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canReorder}>
                            {(dragProvided, dragSnapshot) => (
                              <button
                                type="button"
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => onOpenTaskDetail(task.id)}
                                className={`w-full text-left rounded-lg border bg-white p-2.5 transition-all border-l-4 ${agingCfg.borderColor} ${dragSnapshot.isDragging ? "shadow-lg rotate-1" : "hover:shadow-sm"}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_BADGE[task.priority] || "bg-gray-100 text-gray-700"}`}>
                                    {task.priority}
                                  </span>
                                  {task.projectArea && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                                      style={{
                                        color: task.projectArea.color || "#64748b",
                                        borderColor: `${task.projectArea.color || "#64748b"}50`,
                                        backgroundColor: `${task.projectArea.color || "#64748b"}12`,
                                      }}
                                    >
                                      {task.projectArea.name}
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 text-xs font-bold text-meteorite-900 line-clamp-2">
                                  {task.title}
                                </p>

                                {task.startDate && task.dueDate && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-[10px] text-gray-500 font-medium inline-flex items-center gap-1">
                                      <Clock3 className="w-3 h-3" />
                                      {new Date(task.startDate).toLocaleDateString("es", { day: "2-digit", month: "short", timeZone: "UTC" })}
                                      <span>{"->"}</span>
                                      {new Date(task.dueDate).toLocaleDateString("es", { day: "2-digit", month: "short", timeZone: "UTC" })}
                                      {duration !== null ? ` (${duration}d)` : ""}
                                    </div>
                                    {timeProgress !== null && (
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full"
                                          style={{ width: `${Math.max(0, Math.min(100, timeProgress))}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="mt-2 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    {task.assignments.slice(0, 2).map((assignment) => (
                                      <span key={assignment.id} className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[9px] font-black flex items-center justify-center">
                                        {(assignment.user.name || "?").charAt(0).toUpperCase()}
                                      </span>
                                    ))}
                                    {task.assignments.length > 2 && (
                                      <span className="text-[10px] font-bold text-gray-500">+{task.assignments.length - 2}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                    <span className="inline-flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" />
                                      {task._commentCount ?? 0}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {task.assignments.length}
                                    </span>
                                  </div>
                                </div>

                                {aging !== "NONE" && (
                                  <div className={`mt-2 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${agingCfg.bgTint}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${agingCfg.dotColor} ${agingCfg.animate ? "animate-pulse" : ""}`} />
                                    {agingCfg.label}
                                  </div>
                                )}
                              </button>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
