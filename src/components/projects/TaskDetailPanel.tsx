"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTaskCommentAction,
  deleteTaskCommentAction,
  getTaskCommentsAction,
  updateTaskCommentAction,
} from "@/server/actions/task-comments.actions";
import { updateTaskAction } from "@/server/actions/project.actions";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/validators/project";
import { getAgingConfig, getTaskAgingLevel, getTaskDuration, getTaskTimeProgress } from "@/lib/task-utils";
import { MessageSquare, Send, Trash2, X, Edit2, Save, Paperclip } from "lucide-react";

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
  completedAt: Date | string | null;
  projectArea: { id: string; name: string; color: string | null } | null;
  createdBy: { id: string; name: string | null; image: string | null };
  assignments: TaskAssignment[];
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface ResourceLink {
  id: string;
  url: string;
  label: string | null;
}

interface Resource {
  id: string;
  name: string;
  links: ResourceLink[];
}

interface TaskComment {
  id: string;
  content: string;
  parentId: string | null;
  isEdited: boolean | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  user: { id: string; name: string | null; image: string | null };
  replies: Array<{
    id: string;
    content: string;
    parentId: string | null;
    isEdited: boolean | null;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
    user: { id: string; name: string | null; image: string | null };
  }>;
}

interface Props {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  canManage: boolean;
  members: MemberOption[];
  resources: Resource[];
  onAssign: (taskId: string, userId: string) => void;
  onUnassign: (assignmentId: string) => void;
}

function toInputDate(date: Date | string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}

function formatRelativeDate(value: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / (1000 * 60));
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return date.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  currentUserId,
  canManage,
  members,
  resources,
  onAssign,
  onUnassign,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [assignUserId, setAssignUserId] = useState("none");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const assignedUserIds = useMemo(() => new Set((task?.assignments || []).map((a) => a.user.id)), [task]);
  const assignableMembers = useMemo(
    () => members.filter((m) => !assignedUserIds.has(m.id)),
    [members, assignedUserIds],
  );

  const reloadComments = () => {
    if (!task?.id) return;
    setCommentsLoading(true);
    startTransition(async () => {
      const result = await getTaskCommentsAction(task.id);
      if (result.success) {
        setComments(result.data as TaskComment[]);
      }
      setCommentsLoading(false);
    });
  };

  useEffect(() => {
    if (!isOpen || !task) return;
    setTitle(task.title || "");
    setDescription(task.description || "");
    setStatus(task.status || "TODO");
    setPriority(task.priority || "MEDIUM");
    setStartDate(toInputDate(task.startDate));
    setDueDate(toInputDate(task.dueDate));
    setNewComment("");
    setReplyText({});
    setEditingCommentId(null);
    setEditingCommentText("");
    reloadComments();
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const aging = getTaskAgingLevel(task.status, task.updatedAt);
  const agingCfg = getAgingConfig(aging);
  const duration = getTaskDuration(startDate || null, dueDate || null);
  const timeProgress = getTaskTimeProgress(startDate || null, dueDate || null);

  const handleSaveTask = () => {
    if (!title.trim()) {
      showFeedback("error", "El titulo es obligatorio.");
      return;
    }

    startTransition(async () => {
      const result = await updateTaskAction({
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        status: status as any,
        priority: priority as any,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
      });

      if (!result.success) {
        showFeedback("error", result.error || "No se pudo actualizar la tarea.");
        return;
      }

      showFeedback("success", result.message || "Tarea actualizada.");
      router.refresh();
    });
  };

  const handleCreateComment = (parentId?: string) => {
    const content = parentId ? (replyText[parentId] || "") : newComment;
    if (!content.trim()) return;

    startTransition(async () => {
      const result = await createTaskCommentAction({
        taskId: task.id,
        content: content.trim(),
        parentId: parentId || null,
      });

      if (!result.success) {
        showFeedback("error", result.error || "No se pudo publicar el comentario.");
        return;
      }

      if (parentId) {
        setReplyText((prev) => ({ ...prev, [parentId]: "" }));
      } else {
        setNewComment("");
      }

      showFeedback("success", result.message || "Comentario agregado.");
      reloadComments();
      router.refresh();
    });
  };

  const handleUpdateComment = () => {
    if (!editingCommentId || !editingCommentText.trim()) return;

    startTransition(async () => {
      const result = await updateTaskCommentAction({
        commentId: editingCommentId,
        content: editingCommentText.trim(),
      });

      if (!result.success) {
        showFeedback("error", result.error || "No se pudo editar el comentario.");
        return;
      }

      showFeedback("success", result.message || "Comentario actualizado.");
      setEditingCommentId(null);
      setEditingCommentText("");
      reloadComments();
      router.refresh();
    });
  };

  const handleDeleteComment = (commentId: string) => {
    startTransition(async () => {
      const result = await deleteTaskCommentAction(commentId);
      if (!result.success) {
        showFeedback("error", result.error || "No se pudo eliminar el comentario.");
        return;
      }
      showFeedback("success", result.message || "Comentario eliminado.");
      reloadComments();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Cerrar" />

      <div className="absolute right-0 top-0 h-full w-full md:max-w-2xl bg-white shadow-2xl border-l border-gray-200 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-violet-600 uppercase tracking-wide">Detalle de tarea</p>
            <p className="text-sm font-bold text-meteorite-900 truncate">{task.title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {feedback && (
            <div className={`text-xs font-bold px-3 py-2 rounded-lg ${feedback.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {feedback.message}
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none font-bold text-meteorite-900"
            />
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion de la tarea"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-2">
            <div className="text-xs text-gray-500 font-medium">
              {startDate && dueDate
                ? `${new Date(startDate).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })} -> ${new Date(dueDate).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}`
                : "Define fecha inicio y fecha limite para ver progreso temporal."}
            </div>
            {duration !== null && <div className="text-xs font-bold text-gray-700">Duracion: {duration} dias</div>}
            {timeProgress !== null && (
              <div className="space-y-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-400 to-violet-700" style={{ width: `${timeProgress}%` }} />
                </div>
                <div className="text-[10px] text-gray-500 font-bold">{timeProgress}% del plazo transcurrido</div>
              </div>
            )}
            {aging !== "NONE" && (
              <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${agingCfg.bgTint}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${agingCfg.dotColor} ${agingCfg.animate ? "animate-pulse" : ""}`} />
                {agingCfg.label}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveTask}
              disabled={isPending}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar tarea
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-black text-meteorite-800 uppercase tracking-wide">Asignados</p>
            <div className="flex flex-wrap items-center gap-2">
              {task.assignments.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
                  {(a.user.name || "?").split(" ")[0]}
                  {(canManage || a.user.id === currentUserId) && (
                    <button type="button" onClick={() => onUnassign(a.id)} className="text-violet-600 hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canManage && (
              <div className="flex gap-2">
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs"
                >
                  <option value="none">Asignar miembro...</option>
                  {assignableMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.name || member.email}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (assignUserId === "none") return;
                    onAssign(task.id, assignUserId);
                    setAssignUserId("none");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Asignar
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-black text-meteorite-800 uppercase tracking-wide">Adjuntos (Fase 4)</p>
            {resources.length === 0 ? (
              <p className="text-xs text-gray-500">No hay recursos vinculados a esta tarea.</p>
            ) : (
              <div className="space-y-2">
                {resources.map((resource) => (
                  <div key={resource.id} className="rounded-md border border-gray-200 p-2">
                    <p className="text-xs font-bold text-gray-800 inline-flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {resource.name}
                    </p>
                    <div className="mt-1 space-y-1">
                      {resource.links.map((link) => (
                        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-violet-700 hover:text-violet-800 truncate">
                          {link.label || link.url}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <p className="text-xs font-black text-meteorite-800 uppercase tracking-wide inline-flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Comentarios ({comments.length})
            </p>

            <div className="flex gap-2">
              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="flex-1 px-2.5 py-2 rounded-lg border border-gray-200 text-xs resize-none"
              />
              <button
                type="button"
                onClick={() => handleCreateComment()}
                disabled={isPending || !newComment.trim()}
                className="px-3 py-2 self-end rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {commentsLoading ? (
              <p className="text-xs text-gray-500">Cargando comentarios...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-500">No hay comentarios aun.</p>
            ) : (
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-gray-200 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-800">
                          {comment.user.name || "Usuario"}
                          <span className="text-gray-400 font-medium"> · {formatRelativeDate(comment.createdAt)}</span>
                          {comment.isEdited && <span className="text-gray-400 font-medium"> · editado</span>}
                        </p>

                        {editingCommentId === comment.id ? (
                          <div className="mt-1 space-y-1">
                            <textarea
                              rows={2}
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
                            />
                            <div className="flex gap-1">
                              <button type="button" onClick={handleUpdateComment} className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 text-white">Guardar</button>
                              <button type="button" onClick={() => setEditingCommentId(null)} className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{comment.content}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {comment.user.id === currentUserId && editingCommentId !== comment.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentText(comment.content);
                            }}
                            className="p-1 rounded text-gray-500 hover:bg-gray-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(comment.user.id === currentUserId || canManage) && (
                          <button type="button" onClick={() => handleDeleteComment(comment.id)} className="p-1 rounded text-red-500 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={replyText[comment.id] || ""}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                        placeholder="Responder..."
                        className="flex-1 px-2 py-1 rounded border border-gray-200 text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateComment(comment.id)}
                        disabled={isPending || !(replyText[comment.id] || "").trim()}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-violet-600 text-white disabled:opacity-50"
                      >
                        Responder
                      </button>
                    </div>

                    {comment.replies.length > 0 && (
                      <div className="mt-2 pl-3 border-l border-gray-200 space-y-1.5">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="text-[11px] text-gray-600">
                            <span className="font-bold text-gray-800">{reply.user.name || "Usuario"}</span>
                            <span className="text-gray-400"> · {formatRelativeDate(reply.createdAt)}</span>
                            {reply.isEdited && <span className="text-gray-400"> · editado</span>}
                            <p className="mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
