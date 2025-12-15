"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, HelpCircle, FileText } from "lucide-react";
import JustificationModal from "./JustificationModal";

interface AttendanceRecord {
    id: string;
    status: string;
    justificationStatus: string | null;
    justificationReason: string | null;
    adminFeedback: string | null;
    event: {
        id: string;
        title: string;
        date: Date;
        startTime: string | null;
        isVirtual: boolean | null;
    };
}

const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
    "PRESENT": { label: "Presente", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
    "ABSENT": { label: "Falta", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
    "LATE": { label: "Tardanza", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
    "EXCUSED": { label: "Justificado", color: "bg-blue-100 text-blue-700 border-blue-200", icon: FileText },
};

export default function AttendanceList({ records }: { records: AttendanceRecord[] }) {
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

    return (
        <>
            <div className="space-y-4">
                {records.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-gray-500">No tienes registros de asistencia aún.</p>
                    </div>
                ) : (
                    records.map((item) => {
                        const config = statusConfig[item.status] || { label: item.status, color: "bg-gray-100", icon: HelpCircle };
                        const StatusIcon = config.icon;

                        // Logic to show "Justify" button:
                        // Status is ABSENT or LATE
                        // AND justificationStatus is NOT APPROVED (PENDING IS OK TO SHOW "PENDING" BADGE instad of button)
                        const canJustify = ["ABSENT", "LATE"].includes(item.status) && (!item.justificationStatus || item.justificationStatus === "NONE" || item.justificationStatus === "REJECTED");
                        const isPending = item.justificationStatus === "PENDING";
                        const isRejected = item.justificationStatus === "REJECTED";
                        const isApproved = item.justificationStatus === "APPROVED" || item.status === "EXCUSED";

                        return (
                            <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:shadow-md transition-shadow gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] bg-meteorite-50 rounded-xl border border-meteorite-100">
                                        <span className="text-[10px] font-bold text-meteorite-400 uppercase">{new Date(item.event.date).toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })}</span>
                                        <span className="text-xl font-black text-meteorite-800">{new Date(item.event.date).toLocaleDateString('es-ES', { day: '2-digit', timeZone: 'UTC' })}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-meteorite-950 text-base">{item.event.title}</h4>
                                        <p className="text-sm text-gray-500 flex items-center mt-1">
                                            {item.event.startTime || "00:00"} • {item.event.isVirtual ? "Virtual" : "Presencial"}
                                        </p>

                                        {/* Status Feedback Section */}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${config.color}`}>
                                                <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
                                                {config.label}
                                            </div>

                                            {isPending && (
                                                <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100">
                                                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                                                    Justificación Pendiente
                                                </div>
                                            )}
                                            {isRejected && (
                                                <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-100" title={item.adminFeedback || "Sin comentarios"}>
                                                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                                    Justificación Rechazada
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end">
                                    {canJustify && (
                                        <button
                                            onClick={() => setSelectedRecord(item)}
                                            className="px-4 py-2 bg-meteorite-600 hover:bg-meteorite-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-meteorite-600/20 active:scale-95 transition-all flex items-center"
                                        >
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                            Justificar
                                        </button>
                                    )}
                                    {isPending && (
                                        <span className="text-xs text-gray-400 italic">Esperando revisión...</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedRecord && (
                <JustificationModal
                    recordId={selectedRecord.id}
                    isOpen={!!selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                    eventName={selectedRecord.event.title}
                    eventDate={new Date(selectedRecord.event.date).toLocaleDateString('es-ES', { dateStyle: 'full', timeZone: 'UTC' })}
                />
            )}
        </>
    );
}
