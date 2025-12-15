"use client";

import { useState } from "react";
import { X, Send, Link as LinkIcon } from "lucide-react";
import { submitJustificationAction } from "@/server/actions/attendance.actions";
import { useRouter } from "next/navigation";

interface JustificationModalProps {
    recordId: string;
    isOpen: boolean;
    onClose: () => void;
    eventName: string;
    eventDate: string;
}

export default function JustificationModal({ recordId, isOpen, onClose, eventName, eventDate }: JustificationModalProps) {
    const router = useRouter();
    const [reason, setReason] = useState("");
    const [link, setLink] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const result = await submitJustificationAction(recordId, reason, link);
            if (result.success) {
                alert("Justificación enviada correctamente.");
                router.refresh(); // Refresh data to show Pending status
                onClose();
            } else {
                alert("Error: " + result.error);
            }
        } catch (error) {
            alert("Error inesperado al enviar.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-float-up">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-meteorite-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-meteorite-900">Justificar Falta</h3>
                        <p className="text-xs text-meteorite-500 font-medium mt-0.5">{eventName} • {eventDate}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Motivo de la ausencia</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-meteorite-500 focus:ring-4 focus:ring-meteorite-500/10 transition-all outline-none text-sm resize-none min-h-[100px]"
                            placeholder="Explica brevemente por qué no pudiste asistir..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                            <LinkIcon className="w-3 h-3 mr-1.5 text-meteorite-500" />
                            Enlace de prueba (Opcional)
                        </label>
                        <input
                            type="url"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-meteorite-500 focus:ring-4 focus:ring-meteorite-500/10 transition-all outline-none text-sm text-gray-600"
                            placeholder="https://drive.google.com/..."
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                        />
                        <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                            Puede ser un enlace a Drive, foto médica, certificado, etc.
                        </p>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting || !reason.trim()}
                            className="w-full py-3 bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/20 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Enviar Justificación
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
