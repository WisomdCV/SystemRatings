"use client";

import { useState, useTransition } from "react";
import { approveUserAction, rejectUserAction } from "@/server/actions/approval.actions";
import { UserCheck, UserX, Clock, AlertTriangle } from "lucide-react";

type PendingUser = {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    image: string | null;
    createdAt: Date | null;
};

export default function ApprovalsList({ users }: { users: PendingUser[] }) {
    const [pendingUsers, setPendingUsers] = useState(users);
    const [isPending, startTransition] = useTransition();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    function handleApprove(userId: string) {
        setProcessingId(userId);
        setFeedback(null);
        startTransition(async () => {
            const result = await approveUserAction(userId);
            if (result.success) {
                setPendingUsers(prev => prev.filter(u => u.id !== userId));
                setFeedback({ type: "success", message: result.message });
            } else {
                setFeedback({ type: "error", message: result.error });
            }
            setProcessingId(null);
        });
    }

    function handleReject(userId: string) {
        setProcessingId(userId);
        setFeedback(null);
        startTransition(async () => {
            const result = await rejectUserAction(userId);
            if (result.success) {
                setPendingUsers(prev => prev.filter(u => u.id !== userId));
                setFeedback({ type: "success", message: result.message });
            } else {
                setFeedback({ type: "error", message: result.error });
            }
            setProcessingId(null);
        });
    }

    function displayName(user: PendingUser) {
        if (user.firstName || user.lastName) {
            return [user.firstName, user.lastName].filter(Boolean).join(" ");
        }
        return user.name || "Sin nombre";
    }

    function formatDate(date: Date | null) {
        if (!date) return "—";
        return new Date(date).toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    if (pendingUsers.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <UserCheck className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-meteorite-800 mb-2">
                    Sin solicitudes pendientes
                </h3>
                <p className="text-meteorite-500 max-w-md mx-auto">
                    No hay usuarios esperando aprobación en este momento. Las nuevas solicitudes
                    aparecerán aquí automáticamente.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Feedback Toast */}
            {feedback && (
                <div
                    className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium border ${
                        feedback.type === "success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                    }`}
                >
                    {feedback.type === "success" ? (
                        <UserCheck className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    {feedback.message}
                </div>
            )}

            {/* Counter */}
            <div className="flex items-center gap-2 text-sm text-meteorite-500">
                <Clock className="w-4 h-4" />
                <span>{pendingUsers.length} solicitud{pendingUsers.length !== 1 ? "es" : ""} pendiente{pendingUsers.length !== 1 ? "s" : ""}</span>
            </div>

            {/* User Cards */}
            <div className="grid gap-4">
                {pendingUsers.map((user) => {
                    const isProcessing = processingId === user.id && isPending;

                    return (
                        <div
                            key={user.id}
                            className={`bg-white border border-meteorite-100 rounded-2xl p-5 shadow-sm transition-all ${
                                isProcessing ? "opacity-60 pointer-events-none" : "hover:shadow-md"
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                {/* Avatar + Info */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    {user.image ? (
                                        <img
                                            src={user.image}
                                            alt={displayName(user)}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-meteorite-100 flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-meteorite-400 to-meteorite-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                            {(user.name || user.email || "?")[0].toUpperCase()}
                                        </div>
                                    )}

                                    <div className="min-w-0">
                                        <p className="font-bold text-meteorite-900 truncate">
                                            {displayName(user)}
                                        </p>
                                        <p className="text-sm text-meteorite-500 truncate">
                                            {user.email}
                                        </p>
                                        <p className="text-xs text-meteorite-400 mt-0.5">
                                            Registrado: {formatDate(user.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleApprove(user.id)}
                                        disabled={isProcessing}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => handleReject(user.id)}
                                        disabled={isProcessing}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 border border-red-200 disabled:opacity-50 transition-colors"
                                    >
                                        <UserX className="w-4 h-4" />
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
