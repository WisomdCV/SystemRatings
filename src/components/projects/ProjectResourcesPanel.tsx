"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Paperclip,
  Loader2,
} from "lucide-react";
import {
  addResourceLinkAction,
  createResourceAction,
  createResourceCategoryAction,
  deleteResourceAction,
  deleteResourceLinkAction,
} from "@/server/actions/project-resources.actions";

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
  createdAt: Date | string | null;
  category: { id: string; name: string; color: string | null; icon: string | null } | null;
  projectArea: { id: string; name: string; color: string | null } | null;
  task: { id: string; title: string } | null;
  createdBy: { id: string; name: string | null; image: string | null } | null;
  links: ResourceLink[];
}

interface TaskOption {
  id: string;
  title: string;
}

interface AreaOption {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  projectId: string;
  currentUserId: string;
  isSystemAdmin: boolean;
  userPermissions: string[];
  categories: ResourceCategory[];
  resources: ProjectResource[];
  tasks: TaskOption[];
  areas: AreaOption[];
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  INACCESSIBLE: "bg-red-100 text-red-700 border-red-200",
  RESTRICTED: "bg-amber-100 text-amber-700 border-amber-200",
  UNKNOWN: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function ProjectResourcesPanel({
  projectId,
  currentUserId,
  isSystemAdmin,
  userPermissions,
  categories,
  resources,
  tasks,
  areas,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6366f1");
  const [resourceName, setResourceName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceCategoryId, setResourceCategoryId] = useState("none");
  const [resourceAreaId, setResourceAreaId] = useState("none");
  const [resourceTaskId, setResourceTaskId] = useState("none");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const [selectedResourceForLink, setSelectedResourceForLink] = useState<string | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");

  const [previewingLinkId, setPreviewingLinkId] = useState<string | null>(null);

  const canCreateResources = isSystemAdmin
    || userPermissions.includes("project:resource_create")
    || userPermissions.includes("project:task_manage_any")
    || userPermissions.includes("project:task_manage_own");

  const canDeleteAny = isSystemAdmin || userPermissions.includes("project:resource_delete_any");
  const canDeleteOwn = isSystemAdmin || userPermissions.includes("project:resource_delete_own");
  const canEditAny = isSystemAdmin || userPermissions.includes("project:resource_edit_any");
  const canEditOwn = isSystemAdmin || userPermissions.includes("project:resource_edit_own");
  const canManageCategories = isSystemAdmin || userPermissions.includes("project:manage_settings");

  const orderedResources = useMemo(
    () => [...resources].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [resources],
  );

  const showMessage = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const resetCreateForm = () => {
    setResourceName("");
    setResourceDescription("");
    setResourceCategoryId("none");
    setResourceAreaId("none");
    setResourceTaskId("none");
    setLinkUrl("");
    setLinkLabel("");
  };

  const handleCreateResource = () => {
    if (!resourceName.trim() || !linkUrl.trim()) {
      showMessage("error", "Nombre y primer link son obligatorios.");
      return;
    }

    startTransition(async () => {
      const result = await createResourceAction({
        projectId,
        name: resourceName.trim(),
        description: resourceDescription.trim() || undefined,
        categoryId: resourceCategoryId === "none" ? undefined : resourceCategoryId,
        projectAreaId: resourceAreaId === "none" ? undefined : resourceAreaId,
        taskId: resourceTaskId === "none" ? undefined : resourceTaskId,
        links: [
          {
            url: linkUrl.trim(),
            label: linkLabel.trim() || undefined,
          },
        ],
      });

      if (!result.success) {
        showMessage("error", result.error || "No se pudo crear el recurso.");
        return;
      }

      showMessage("success", result.message || "Recurso creado.");
      setShowCreate(false);
      resetCreateForm();
      router.refresh();
    });
  };

  const handleCreateCategory = () => {
    if (!categoryName.trim()) {
      showMessage("error", "El nombre de la categoría es obligatorio.");
      return;
    }

    startTransition(async () => {
      const result = await createResourceCategoryAction({
        projectId,
        name: categoryName.trim(),
        color: categoryColor,
      });

      if (!result.success) {
        showMessage("error", result.error || "No se pudo crear la categoría.");
        return;
      }

      showMessage("success", result.message || "Categoría creada.");
      setShowCreateCategory(false);
      setCategoryName("");
      setCategoryColor("#6366f1");
      router.refresh();
    });
  };

  const handleDeleteResource = (resourceId: string) => {
    startTransition(async () => {
      const result = await deleteResourceAction(resourceId);
      if (!result.success) {
        showMessage("error", result.error || "No se pudo eliminar el recurso.");
        return;
      }
      showMessage("success", result.message || "Recurso eliminado.");
      router.refresh();
    });
  };

  const handleAddLink = (resourceId: string) => {
    if (!newLinkUrl.trim()) {
      showMessage("error", "La URL es obligatoria.");
      return;
    }

    startTransition(async () => {
      const result = await addResourceLinkAction({
        resourceId,
        url: newLinkUrl.trim(),
        label: newLinkLabel.trim() || undefined,
      });

      if (!result.success) {
        showMessage("error", result.error || "No se pudo agregar el link.");
        return;
      }

      showMessage("success", result.message || "Link agregado.");
      setSelectedResourceForLink(null);
      setNewLinkUrl("");
      setNewLinkLabel("");
      router.refresh();
    });
  };

  const handleDeleteLink = (linkId: string) => {
    startTransition(async () => {
      const result = await deleteResourceLinkAction({ linkId });
      if (!result.success) {
        showMessage("error", result.error || "No se pudo eliminar el link.");
        return;
      }
      showMessage("success", result.message || "Link eliminado.");
      router.refresh();
    });
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4 space-y-4">
      {feedback && (
        <div className={`px-3 py-2 rounded-xl text-xs font-bold ${feedback.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
          {feedback.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="font-black text-meteorite-950 text-sm flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-violet-500" />
          Recursos ({resources.length})
        </h4>
        <div className="flex items-center gap-2">
          {canManageCategories && (
            <button
              onClick={() => setShowCreateCategory((prev) => !prev)}
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              + Categoría
            </button>
          )}
          {canCreateResources && (
            <button
              onClick={() => setShowCreate((prev) => !prev)}
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Nuevo recurso
            </button>
          )}
        </div>
      </div>

      {showCreateCategory && canManageCategories && (
        <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Nombre de categoría"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="md:col-span-2 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950 placeholder:text-gray-400"
            />
            <input
              type="color"
              value={categoryColor}
              onChange={(e) => setCategoryColor(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white p-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowCreateCategory(false);
                setCategoryName("");
                setCategoryColor("#6366f1");
              }}
              className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateCategory}
              disabled={isPending || !categoryName.trim()}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Crear categoría
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="p-3 rounded-xl border border-violet-200 bg-violet-50/50 space-y-3">
          <input
            type="text"
            placeholder="Nombre del recurso *"
            value={resourceName}
            onChange={(e) => setResourceName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950 placeholder:text-gray-400"
          />
          <textarea
            placeholder="Descripción (opcional)"
            rows={2}
            value={resourceDescription}
            onChange={(e) => setResourceDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none resize-none text-meteorite-950 placeholder:text-gray-400"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={resourceCategoryId}
              onChange={(e) => setResourceCategoryId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950"
            >
              <option value="none">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>

            <select
              value={resourceAreaId}
              onChange={(e) => setResourceAreaId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950"
            >
              <option value="none">Área general</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>

            <select
              value={resourceTaskId}
              onChange={(e) => setResourceTaskId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950"
            >
              <option value="none">No vincular a tarea</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="url"
              placeholder="https://... *"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="md:col-span-2 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950 placeholder:text-gray-400"
            />
            <input
              type="text"
              placeholder="Etiqueta (opcional)"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950 placeholder:text-gray-400"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
              className="px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateResource}
              disabled={isPending || !resourceName.trim() || !linkUrl.trim()}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear"}
            </button>
          </div>
        </div>
      )}

      {orderedResources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500 font-medium">
          Todavía no hay recursos en este proyecto.
        </div>
      ) : (
        <div className="space-y-3">
          {orderedResources.map((resource) => {
            const canDeleteResource = canDeleteAny || (canDeleteOwn && resource.createdById === currentUserId);
            const canManageLinks = canEditAny || (canEditOwn && resource.createdById === currentUserId);

            return (
              <div key={resource.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-meteorite-900 truncate">{resource.name}</p>
                    {resource.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{resource.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {resource.category && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{
                            color: resource.category.color || "#6366f1",
                            borderColor: `${resource.category.color || "#6366f1"}55`,
                            backgroundColor: `${resource.category.color || "#6366f1"}12`,
                          }}
                        >
                          {resource.category.name}
                        </span>
                      )}
                      {resource.projectArea && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                          {resource.projectArea.name}
                        </span>
                      )}
                      {resource.task && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
                          Tarea: {resource.task.title}
                        </span>
                      )}
                    </div>
                  </div>

                  {canDeleteResource && (
                    <button
                      onClick={() => handleDeleteResource(resource.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {resource.links.map((link) => {
                    const canDeleteThisLink = canEditAny || link.addedById === currentUserId;
                    const statusClass = STATUS_CLASS[link.linkStatus] || STATUS_CLASS.UNKNOWN;
                    const isPreviewOpen = previewingLinkId === link.id;

                    return (
                      <div key={link.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                        <div className="flex items-start gap-2">
                          <Link2 className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-violet-700 hover:text-violet-800 inline-flex items-center gap-1 truncate"
                            >
                              {link.label || link.domain || "Abrir link"}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{link.url}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${statusClass}`}>
                            {link.linkStatus}
                          </span>

                          {link.previewUrl && (
                            <button
                              onClick={() => setPreviewingLinkId(isPreviewOpen ? null : link.id)}
                              className="p-1 rounded-md text-blue-500 hover:bg-blue-100"
                              title="Alternar vista previa"
                            >
                              {isPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {canDeleteThisLink && (
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              disabled={isPending}
                              className="p-1 rounded-md text-red-500 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isPreviewOpen && link.previewUrl && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-white">
                            <iframe
                              src={link.previewUrl}
                              title={`Preview ${link.label || link.domain || "resource"}`}
                              className="w-full h-56"
                              loading="lazy"
                              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canManageLinks && (
                  <div className="pt-1">
                    {selectedResourceForLink === resource.id ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                          type="url"
                          placeholder="https://..."
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          className="md:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950 placeholder:text-gray-400"
                        />
                        <input
                          type="text"
                          placeholder="Etiqueta"
                          value={newLinkLabel}
                          onChange={(e) => setNewLinkLabel(e.target.value)}
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white outline-none text-meteorite-950 placeholder:text-gray-400"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddLink(resource.id)}
                            disabled={isPending || !newLinkUrl.trim()}
                            className="flex-1 px-2 py-1.5 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Agregar"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedResourceForLink(null);
                              setNewLinkUrl("");
                              setNewLinkLabel("");
                            }}
                            className="px-2 py-1.5 text-xs font-bold rounded-lg text-gray-500 hover:bg-gray-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedResourceForLink(resource.id)}
                        className="text-[11px] font-bold text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Agregar otro link
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
