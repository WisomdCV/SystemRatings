"use client";

import { useMemo, useState, useTransition } from "react";
import type { AccessPreviewBootstrapData, AccessPreviewResult } from "@/server/actions/access-preview.actions";
import { getAccessPreviewAction } from "@/server/actions/access-preview.actions";
import { Eye, ShieldCheck, UserRound, Filter, CalendarDays, FolderKanban, CheckCircle2, XCircle } from "lucide-react";

type Props = {
  bootstrap: AccessPreviewBootstrapData;
};

export default function AccessPreviewView({ bootstrap }: Props) {
  const [mode, setMode] = useState<"USER" | "ROLE">("USER");
  const [selectedUserId, setSelectedUserId] = useState<string>(bootstrap.users[0]?.id || "");
  const [selectedRole, setSelectedRole] = useState<string>(bootstrap.roles[0] || "VOLUNTEER");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [selectedExtraPerms, setSelectedExtraPerms] = useState<string[]>([]);
  const [preview, setPreview] = useState<AccessPreviewResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupedDecisions = useMemo(() => {
    if (!preview) return { events: [], projects: [] };
    return {
      events: preview.endpointDecisions.filter((d) => d.scope === "events"),
      projects: preview.endpointDecisions.filter((d) => d.scope === "projects"),
    };
  }, [preview]);

  const generatePreview = () => {
    setErrorMsg(null);

    startTransition(async () => {
      const result = await getAccessPreviewAction({
        mode,
        userId: mode === "USER" ? selectedUserId : undefined,
        role: mode === "ROLE" ? selectedRole : undefined,
        areaId: selectedAreaId || null,
        extraPermissions: mode === "ROLE" ? selectedExtraPerms : undefined,
      });

      if (!result.success) {
        setPreview(null);
        setErrorMsg(result.error);
        return;
      }

      setPreview(result.data);
    });
  };

  const toggleExtraPerm = (permission: string) => {
    setSelectedExtraPerms((prev) =>
      prev.includes(permission)
        ? prev.filter((item) => item !== permission)
        : [...prev, permission],
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-meteorite-200 bg-white/85 backdrop-blur-sm p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-meteorite-900 uppercase tracking-wide">Configuración de Vista Previa</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block text-xs font-black text-meteorite-700 uppercase tracking-wide">Modo</label>
            <div className="inline-flex rounded-xl border border-meteorite-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("USER")}
                className={`px-4 py-2 text-xs font-black ${mode === "USER" ? "bg-indigo-100 text-indigo-700" : "text-meteorite-500"}`}
              >
                Usuario
              </button>
              <button
                type="button"
                onClick={() => setMode("ROLE")}
                className={`px-4 py-2 text-xs font-black border-l border-meteorite-200 ${mode === "ROLE" ? "bg-indigo-100 text-indigo-700" : "text-meteorite-500"}`}
              >
                Rol Simulado
              </button>
            </div>

            {mode === "USER" ? (
              <div>
                <label className="block text-xs font-bold text-meteorite-700 mb-1">Usuario objetivo</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-meteorite-200 bg-white text-sm text-meteorite-900"
                >
                  {bootstrap.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.name || "Sin nombre")} • {user.email} • {user.role || "SIN_ROL"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-meteorite-700 mb-1">Rol simulado</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-meteorite-200 bg-white text-sm text-meteorite-900"
                  >
                    {bootstrap.roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-meteorite-700 mb-1">Área IISE simulada (opcional)</label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-meteorite-200 bg-white text-sm text-meteorite-900"
                  >
                    <option value="">Sin área</option>
                    {bootstrap.areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-meteorite-700 uppercase tracking-wide">Permisos extra (solo modo rol)</label>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-meteorite-200 bg-white p-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {bootstrap.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-[11px] text-meteorite-700">
                  <input
                    type="checkbox"
                    checked={selectedExtraPerms.includes(permission)}
                    onChange={() => toggleExtraPerm(permission)}
                    disabled={mode !== "ROLE"}
                    className="rounded border-meteorite-300"
                  />
                  <span className={mode !== "ROLE" ? "opacity-40" : ""}>{permission}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setErrorMsg(null);
            }}
            className="px-4 py-2 text-xs font-black rounded-xl border border-meteorite-200 text-meteorite-600 hover:bg-meteorite-50"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={generatePreview}
            disabled={isPending || (mode === "USER" && !selectedUserId) || (mode === "ROLE" && !selectedRole)}
            className="px-4 py-2 text-xs font-black rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPending ? "Generando..." : "Generar vista previa"}
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {errorMsg}
          </div>
        )}
      </div>

      {preview && (
        <>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <p className="text-xs font-black text-emerald-800 uppercase tracking-wide">Contexto Resuelto</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-semibold text-emerald-800">
              <p>Modo: <strong>{preview.context.mode}</strong></p>
              <p>Rol: <strong>{preview.context.role}</strong></p>
              <p>Área: <strong>{preview.context.areaName || "Sin área"}</strong></p>
              <p>Permisos extra: <strong>{preview.context.customPermissionCount}</strong></p>
              <p>Event manage all: <strong>{preview.context.hasGlobalEventManage ? "SI" : "NO"}</strong></p>
              <p>Project manage global: <strong>{preview.context.hasGlobalProjectManage ? "SI" : "NO"}</strong></p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <DecisionCard title="Decisiones de Endpoints (Events)" decisions={groupedDecisions.events} />
            <DecisionCard title="Decisiones de Endpoints (Projects)" decisions={groupedDecisions.projects} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-meteorite-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-meteorite-900">Vista Previa de Events</h4>
              </div>
              <p className="text-xs text-meteorite-500 mb-3">
                Visibles: <strong>{preview.events.visibleCount}</strong> / Evaluados: <strong>{preview.events.totalEvaluated}</strong>
              </p>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-meteorite-100">
                <table className="w-full text-xs">
                  <thead className="bg-meteorite-50 text-meteorite-700 font-black sticky top-0">
                    <tr>
                      <th className="text-left p-2">Evento</th>
                      <th className="text-left p-2">Scope/Type</th>
                      <th className="text-left p-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.events.sample.map((event) => (
                      <tr key={event.id} className="border-t border-meteorite-100">
                        <td className="p-2 align-top">
                          <p className="font-bold text-meteorite-900">{event.title}</p>
                          <p className="text-[11px] text-meteorite-500">{new Date(event.date).toLocaleString("es-PE")}</p>
                        </td>
                        <td className="p-2 align-top">
                          <p className="text-meteorite-700">{event.eventScope || "-"} / {event.eventType || "-"}</p>
                          <p className="text-[11px] text-meteorite-500">{event.targetProject || event.targetArea || "General"}</p>
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex flex-wrap gap-1">
                            <BoolTag ok={event.canEdit} text="EDIT" />
                            <BoolTag ok={event.canDelete} text="DELETE" />
                            <BoolTag ok={event.canTakeAttendance} text="ATT" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-meteorite-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-meteorite-900">Vista Previa de Projects</h4>
              </div>
              <p className="text-xs text-meteorite-500 mb-3">
                Visibles: <strong>{preview.projects.visibleCount}</strong> / Evaluados: <strong>{preview.projects.totalEvaluated}</strong> / Denegados: <strong>{preview.projects.deniedCount}</strong>
              </p>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-meteorite-100">
                <table className="w-full text-xs">
                  <thead className="bg-meteorite-50 text-meteorite-700 font-black sticky top-0">
                    <tr>
                      <th className="text-left p-2">Proyecto</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2">Regla</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.projects.sample.map((project) => (
                      <tr key={project.id} className="border-t border-meteorite-100">
                        <td className="p-2 font-bold text-meteorite-900">{project.name}</td>
                        <td className="p-2 text-meteorite-700">{project.status}</td>
                        <td className="p-2 text-[11px] text-meteorite-500">{project.visibilityRule}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {preview.projectMembershipChecks.length > 0 && (
            <div className="rounded-2xl border border-meteorite-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserRound className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-meteorite-900">Capacidades por membresía de proyecto</h4>
              </div>
              <div className="max-h-96 overflow-y-auto rounded-xl border border-meteorite-100">
                <table className="w-full text-xs">
                  <thead className="bg-meteorite-50 text-meteorite-700 font-black sticky top-0">
                    <tr>
                      <th className="text-left p-2">Proyecto</th>
                      <th className="text-left p-2">Rol/Área</th>
                      <th className="text-left p-2">Events</th>
                      <th className="text-left p-2">Gestión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.projectMembershipChecks.map((row) => (
                      <tr key={`${row.projectId}-${row.projectRole}`} className="border-t border-meteorite-100">
                        <td className="p-2 font-bold text-meteorite-900">{row.projectName}</td>
                        <td className="p-2 text-meteorite-700">{row.projectRole}{row.projectArea ? ` • ${row.projectArea}` : ""}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <BoolTag ok={row.canCreateGeneralEvent} text="GEN" />
                            <BoolTag ok={row.canCreateAreaEvent} text="AREA" />
                            <BoolTag ok={row.canCreateMeetingEvent} text="MEET" />
                            <BoolTag ok={row.canCreateTreasuryEvent} text="TRES" />
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <BoolTag ok={row.canManageEvents} text="MANAGE EVT" />
                            <BoolTag ok={row.canManageMembers} text="MEMBERS" />
                            <BoolTag ok={row.canManageSettings} text="SETTINGS" />
                            <BoolTag ok={row.canManageTasksAny} text="TASK ANY" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BoolTag({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${ok ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
      {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {text}
    </span>
  );
}

type DecisionProps = {
  title: string;
  decisions: Array<{ key: string; label: string; allowed: boolean; reason: string }>;
};

function DecisionCard({ title, decisions }: DecisionProps) {
  return (
    <div className="rounded-2xl border border-meteorite-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-black text-meteorite-900">{title}</h4>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {decisions.map((decision) => (
          <div key={decision.key} className="rounded-xl border border-meteorite-100 bg-meteorite-50/30 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-bold text-meteorite-900">{decision.label}</p>
              <BoolTag ok={decision.allowed} text={decision.allowed ? "ALLOW" : "DENY"} />
            </div>
            <p className="text-[11px] text-meteorite-500 mt-1">{decision.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
