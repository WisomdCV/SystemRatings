"use client";

import ReviewJustificationModal from "./ReviewJustificationModal";
import { AlertTriangle, Loader2, Check, X, Clock, Save, User as UserIcon, FileText } from "lucide-react";
import { AttendanceSheetItem, AttendanceStatus } from "@/server/data-access/attendance";
import { saveAttendanceAction } from "@/server/actions/attendance.actions";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AttendanceTrackerProps {
    eventId: string;
    initialSheet: AttendanceSheetItem[];
}

export default function AttendanceTracker({ eventId, initialSheet }: AttendanceTrackerProps) {
    const router = useRouter();
    const [sheet, setSheet] = useState<AttendanceSheetItem[]>(initialSheet);
    const [isPending, startTransition] = useTransition();
    const [hasChanges, setHasChanges] = useState(false);

    // Sync validation from server after refresh
    useEffect(() => {
        setSheet(initialSheet);
    }, [initialSheet]);

    // Review Modal State
    const [reviewRecord, setReviewRecord] = useState<AttendanceSheetItem | null>(null);

    const handleStatusChange = (userId: string, newStatus: AttendanceStatus) => {
        setSheet(prev => prev.map(item => {
            if (item.user.id === userId) {
                return {
                    ...item,
                    record: {
                        id: item.record?.id || "temp",
                        status: newStatus,
                        justificationStatus: item.record?.justificationStatus || "NONE",
                        justificationReason: item.record?.justificationReason,
                        justificationLink: item.record?.justificationLink,
                        adminFeedback: item.record?.adminFeedback // Preserve feedback
                    }
                };
            }
            return item;
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        startTransition(async () => {
            // Filter only legitimate statuses (ignore pending/null if we want, but here we save all current state or just changes)
            // Strategy: Save ALL currently marked users to ensure consistency (snapshot).
            // Actually, better to only send those with status.

            const payload = sheet
                .filter(item => item.record && item.record.status) // Only those with a status set
                .map(item => ({
                    userId: item.user.id,
                    status: item.record!.status as AttendanceStatus
                }));

            const result = await saveAttendanceAction(eventId, payload);

            if (result.success) {
                alert("Asistencia guardada correctamente");
                setHasChanges(false);
                router.refresh();
            } else {
                alert(`Error: ${result.error}`);
            }
        });
    };

    // Counters
    const stats = {
        present: sheet.filter(i => i.record?.status === "PRESENT").length,
        absent: sheet.filter(i => i.record?.status === "ABSENT").length,
        late: sheet.filter(i => i.record?.status === "LATE").length,
        excused: sheet.filter(i => i.record?.status === "EXCUSED").length,
        total: sheet.length
    };

    return (
        <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center">
                    <span className="text-2xl font-black text-meteorite-900">{stats.total}</span>
                    <span className="text-xs text-gray-500 font-bold uppercase">Total</span>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm flex flex-col items-center">
                    <span className="text-2xl font-black text-green-700">{stats.present}</span>
                    <span className="text-xs text-green-600 font-bold uppercase">Presentes</span>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col items-center">
                    <span className="text-2xl font-black text-red-700">{stats.absent}</span>
                    <span className="text-xs text-red-600 font-bold uppercase">Faltas</span>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 shadow-sm flex flex-col items-center">
                    <span className="text-2xl font-black text-yellow-700">{stats.late}</span>
                    <span className="text-xs text-yellow-600 font-bold uppercase">Tardanzas</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center col-span-2 lg:col-span-1">
                    <span className="text-2xl font-black text-blue-700">{stats.excused}</span>
                    <span className="text-xs text-blue-600 font-bold uppercase">Justificados</span>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-4 font-bold text-gray-600">Miembro</th>
                                <th className="p-4 font-bold text-gray-600 hidden md:table-cell">Email</th>
                                <th className="p-4 font-bold text-gray-600 text-center">Estado</th>
                                <th className="p-4 font-bold text-gray-600 text-center">Justificaciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sheet.map((item) => {
                                const status = item.record?.status;
                                const isJustificationPending = item.record?.justificationStatus === "PENDING";

                                return (
                                    <tr key={item.user.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-meteorite-100 flex items-center justify-center overflow-hidden shrink-0">
                                                    {item.user.image ? (
                                                        <img src={item.user.image} alt={item.user.name || "User"} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserIcon className="w-5 h-5 text-meteorite-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{item.user.name || "Sin nombre"}</p>
                                                    <p className="text-xs text-gray-500 md:hidden">{item.user.email}</p>

                                                    {status === "EXCUSED" && (
                                                        <span className="md:hidden inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">Justificado</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-500 hidden md:table-cell">
                                            {item.user.email}
                                        </td>
                                        <td className="p-4 text-center">
                                            {status === "EXCUSED" ? (
                                                <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                                                    Justificado
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* Present */}
                                                    <button
                                                        onClick={() => handleStatusChange(item.user.id, "PRESENT")}
                                                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${status === "PRESENT"
                                                            ? "bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105"
                                                            : "bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600"
                                                            }`}
                                                        title="Presente"
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>

                                                    {/* Late */}
                                                    <button
                                                        onClick={() => handleStatusChange(item.user.id, "LATE")}
                                                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${status === "LATE"
                                                            ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/30 scale-105"
                                                            : "bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600"
                                                            }`}
                                                        title="Tardanza"
                                                    >
                                                        <Clock className="w-5 h-5" />
                                                    </button>

                                                    {/* Absent */}
                                                    <button
                                                        onClick={() => handleStatusChange(item.user.id, "ABSENT")}
                                                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${status === "ABSENT"
                                                            ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105"
                                                            : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
                                                            }`}
                                                        title="Falta"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {item.record?.justificationStatus && item.record.justificationStatus !== "NONE" ? (
                                                <div className="flex flex-col gap-2 min-w-[200px] text-left">
                                                    {/* Card Header: Status & Action */}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${item.record.justificationStatus === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                                                                item.record.justificationStatus === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                                                                    "bg-orange-50 text-orange-700 border-orange-200 animate-pulse"
                                                            }`}>
                                                            {item.record.justificationStatus === "PENDING" ? "Pendiente" :
                                                                item.record.justificationStatus === "APPROVED" ? "Aceptada" : "Rechazada"}
                                                        </span>

                                                        {item.record.justificationStatus === "PENDING" ? (
                                                            <button
                                                                onClick={() => setReviewRecord(item)}
                                                                className="text-[10px] font-bold text-meteorite-600 underline hover:text-meteorite-800"
                                                            >
                                                                Revisar
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setReviewRecord(item)}
                                                                className="text-[10px] text-gray-400 hover:text-gray-600"
                                                            >
                                                                Editar
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Content: Reason */}
                                                    {item.record.justificationReason && (
                                                        <div className="text-[11px] leading-tight text-gray-600">
                                                            <span className="font-bold text-gray-700 block mb-0.5">Motivo:</span>
                                                            "{item.record.justificationReason}"
                                                        </div>
                                                    )}

                                                    {/* Content: Admin Feedback (Only if approved/rejected) */}
                                                    {item.record.adminFeedback && (
                                                        <div className="text-[11px] leading-tight bg-gray-50 p-1.5 rounded border border-gray-100 italic text-gray-500">
                                                            <span className="font-bold text-gray-600 not-italic block mb-0.5">Respuesta:</span>
                                                            "{item.record.adminFeedback}"
                                                        </div>
                                                    )}

                                                    {/* Link */}
                                                    {item.record.justificationLink && (
                                                        <a
                                                            href={item.record.justificationLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center text-[10px] text-blue-500 hover:underline mt-1"
                                                        >
                                                            <FileText className="w-3 h-3 mr-1" />
                                                            Ver Evidencia
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Floating Action Buffer */}
            <div className="h-20"></div>

            {/* Save Floating Bar */}
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-2xl p-4 flex items-center gap-4 transition-transform duration-300 z-40 ${hasChanges ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
                }`}>
                <div className="text-sm font-medium text-gray-600 hidden sm:block">
                    Tienes cambios sin guardar
                </div>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex items-center px-6 py-3 bg-meteorite-900 text-white font-bold rounded-xl hover:bg-meteorite-800 transition-colors shadow-lg shadow-meteorite-900/20 active:scale-95"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5 mr-2" />
                            Guardar Asistencia
                        </>
                    )}
                </button>
            </div>

            {/* Review Modal */}
            {reviewRecord && reviewRecord.record && (
                <ReviewJustificationModal
                    isOpen={!!reviewRecord}
                    onClose={() => setReviewRecord(null)}
                    recordId={reviewRecord.record.id}
                    studentName={reviewRecord.user.name || "Estudiante"}
                    reason={reviewRecord.record.justificationReason || null}
                    link={reviewRecord.record.justificationLink || null}
                />
            )}
        </div>
    );
}
