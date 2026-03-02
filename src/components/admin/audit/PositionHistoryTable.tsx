"use client";

import { useState, useMemo } from "react";
import type { AuditHistoryEntry } from "@/server/actions/audit.actions";
import { RoleBadge } from "./AuditView";
import { Search, ArrowRight, Calendar, MapPin, FileText } from "lucide-react";

function formatDate(d: Date | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-GT", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

interface PositionHistoryTableProps {
    history: AuditHistoryEntry[];
}

export default function PositionHistoryTable({ history }: PositionHistoryTableProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const filtered = useMemo(() => {
        if (!searchTerm) return history;
        const lower = searchTerm.toLowerCase();
        return history.filter(
            (h) =>
                h.userName?.toLowerCase().includes(lower) ||
                h.userEmail?.toLowerCase().includes(lower) ||
                h.role?.toLowerCase().includes(lower) ||
                h.areaName?.toLowerCase().includes(lower) ||
                h.reason?.toLowerCase().includes(lower)
        );
    }, [history, searchTerm]);

    if (history.length === 0) {
        return (
            <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-meteorite-300 mx-auto mb-3" />
                <p className="text-meteorite-500 font-medium">No hay cambios de posición registrados.</p>
                <p className="text-meteorite-400 text-sm mt-1">
                    Los cambios de rol aparecerán aquí cuando se asignen desde Gestión de Usuarios.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-meteorite-400" />
                <input
                    type="text"
                    placeholder="Buscar en historial..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-meteorite-50 border border-meteorite-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-meteorite-300"
                />
            </div>

            {/* Timeline */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {filtered.map((entry) => (
                    <div
                        key={entry.id}
                        className="bg-white rounded-xl border border-meteorite-100 p-4 hover:shadow-sm transition-shadow"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            {/* User */}
                            <div className="flex items-center gap-2 min-w-0 sm:w-[200px] flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-meteorite-200 to-meteorite-300 flex items-center justify-center text-xs font-bold text-meteorite-700 flex-shrink-0">
                                    {(entry.userName?.[0] ?? "?").toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-meteorite-900 truncate">
                                        {entry.userName || "Usuario desconocido"}
                                    </p>
                                    <p className="text-xs text-meteorite-400 truncate">{entry.userEmail}</p>
                                </div>
                            </div>

                            {/* Change */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <ArrowRight className="w-4 h-4 text-meteorite-300 flex-shrink-0" />
                                {entry.role && <RoleBadge role={entry.role} />}
                                {entry.areaName && (
                                    <span className="text-xs font-semibold text-meteorite-600 bg-meteorite-100 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                                        <MapPin className="w-3 h-3" />
                                        {entry.areaName}
                                    </span>
                                )}
                            </div>

                            {/* Dates */}
                            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-meteorite-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(entry.startDate)}
                                </span>
                                {entry.endDate && (
                                    <>
                                        <span className="text-meteorite-300">→</span>
                                        <span>{formatDate(entry.endDate)}</span>
                                    </>
                                )}
                                {!entry.endDate && (
                                    <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                                        Activo
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Reason */}
                        {entry.reason && (
                            <div className="mt-2 flex items-start gap-2 pl-10">
                                <FileText className="w-3.5 h-3.5 text-meteorite-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-meteorite-500 italic">
                                    &quot;{entry.reason}&quot;
                                </p>
                            </div>
                        )}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center py-8 text-meteorite-400 text-sm">
                        No se encontraron resultados para &quot;{searchTerm}&quot;.
                    </div>
                )}
            </div>

            <p className="text-xs text-meteorite-400 text-right">
                Mostrando {filtered.length} de {history.length} registros
            </p>
        </div>
    );
}
