"use client";

import { useState } from "react";
import { X, Check, XCircle, FileText, ExternalLink } from "lucide-react";
import { reviewJustificationAction } from "@/server/actions/attendance.actions";
import { useRouter } from "next/navigation";

interface ReviewJustificationModalProps {
    recordId: string;
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    reason: string | null;
    link: string | null;
}

export default function ReviewJustificationModal({ recordId, isOpen, onClose, studentName, reason, link }: ReviewJustificationModalProps) {
    const router = useRouter();
    const [feedback, setFeedback] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleVerdict = async (verdict: "APPROVED" | "REJECTED") => {
        if (!confirm(`¿Estás seguro de que deseas ${verdict === "APPROVED" ? "APROBAR" : "RECHAZAR"} esta justificación?`)) return;

        setIsSubmitting(true);
        try {
            const result = await reviewJustificationAction(recordId, verdict, feedback);
            if (result.success) {
                // alert(result.message);
                router.refresh();
                onClose();
            } else {
                alert("Error: " + result.error);
            }
        } catch (error) {
            alert("Error al procesar.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-meteorite-950/70 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-float-up">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-meteorite-50">
                    <div>
                        <h3 className="text-lg font-bold text-meteorite-900">Revisar Justificación</h3>
                        <p className="text-sm text-meteorite-600 font-medium">{studentName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Student Content */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex items-start gap-3 mb-3">
                            <FileText className="w-5 h-5 text-meteorite-500 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Motivo del estudiante</h4>
                                <p className="text-gray-800 text-sm leading-relaxed">{reason || "Sin motivo especificado."}</p>
                            </div>
                        </div>

                        {link && (
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200/50">
                                <ExternalLink className="w-5 h-5 text-blue-500" />
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Prueba Adjunta</h4>
                                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all block">
                                        {link}
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Feedback Form */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Comentarios del Director (Opcional)</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-meteorite-500 focus:ring-4 focus:ring-meteorite-500/10 transition-all outline-none text-sm resize-none h-[80px] text-gray-900"
                            placeholder="Feedback para el estudiante..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <button
                            onClick={() => handleVerdict("REJECTED")}
                            disabled={isSubmitting}
                            className="py-3 px-4 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold rounded-xl transition-all flex items-center justify-center disabled:opacity-50"
                        >
                            <XCircle className="w-5 h-5 mr-2" />
                            Rechazar
                        </button>
                        <button
                            onClick={() => handleVerdict("APPROVED")}
                            disabled={isSubmitting}
                            className="py-3 px-4 bg-green-600 text-white hover:bg-green-700 font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all flex items-center justify-center disabled:opacity-50"
                        >
                            <Check className="w-5 h-5 mr-2" />
                            Aprobar Justificación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
