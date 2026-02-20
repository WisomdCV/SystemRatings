"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "@/server/actions/user.actions";
import {
    Crown, Shield, User, ChevronDown, CheckCircle2,
    XCircle, Loader2, Users
} from "lucide-react";

interface Leader {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    currentAreaId: string | null;
    image: string | null;
}

interface AreaWithLeaders {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    director: Leader | null;
    subdirector: Leader | null;
}

interface EligibleUser {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    currentAreaId: string | null;
    image: string | null;
}

interface Props {
    areasWithLeaders: AreaWithLeaders[];
    eligibleUsers: EligibleUser[];
}

export default function AreaLeadershipAssigner({ areasWithLeaders, eligibleUsers }: Props) {
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [assigningSlot, setAssigningSlot] = useState<{ areaId: string; role: "DIRECTOR" | "SUBDIRECTOR" } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleAssign = (userId: string, areaId: string, role: "DIRECTOR" | "SUBDIRECTOR") => {
        startTransition(async () => {
            const result = await updateUserRoleAction({
                userId,
                role,
                areaId,
                reason: `Asignado como ${role === "DIRECTOR" ? "Director" : "Subdirector"} desde panel de áreas`,
            });

            if (result.success) {
                showFeedback("success", `${role === "DIRECTOR" ? "Director" : "Subdirector"} asignado correctamente.`);
                setAssigningSlot(null);
                setSearchTerm("");
            } else {
                showFeedback("error", result.error || "Error al asignar.");
            }
        });
    };

    const handleRemoveLeader = (userId: string) => {
        if (!confirm("¿Quitar este líder de su posición? Se cambiará a MEMBER.")) return;
        startTransition(async () => {
            const result = await updateUserRoleAction({
                userId,
                role: "MEMBER",
                areaId: null,
                reason: "Removido de liderazgo desde panel de áreas",
            });
            if (result.success) {
                showFeedback("success", "Líder removido correctamente.");
            } else {
                showFeedback("error", result.error || "Error al remover.");
            }
        });
    };

    // Filter users for assignment dropdown
    const filteredUsers = eligibleUsers.filter(u => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
    });

    return (
        <div className="space-y-4">
            {/* Feedback Toast */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${feedback.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-meteorite-600" />
                <h3 className="text-xl font-black text-meteorite-950">Directorio de Liderazgo</h3>
            </div>

            {/* Areas Leadership Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {areasWithLeaders.map(area => (
                    <div
                        key={area.id}
                        className="bg-white/80 backdrop-blur-md border border-meteorite-200/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
                    >
                        {/* Area Header */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-xl bg-meteorite-100 flex items-center justify-center font-black text-sm text-meteorite-700">
                                {area.code || area.name.substring(0, 2).toUpperCase()}
                            </div>
                            <h4 className="font-bold text-meteorite-950">{area.name}</h4>
                        </div>

                        {/* Director Slot */}
                        <LeaderSlot
                            label="Director"
                            icon={<Crown className="w-4 h-4" />}
                            leader={area.director}
                            colorClass="amber"
                            isAssigning={assigningSlot?.areaId === area.id && assigningSlot?.role === "DIRECTOR"}
                            isPending={isPending}
                            onAssignClick={() => {
                                setAssigningSlot({ areaId: area.id, role: "DIRECTOR" });
                                setSearchTerm("");
                            }}
                            onRemove={area.director ? () => handleRemoveLeader(area.director!.id) : undefined}
                            onCancelAssign={() => setAssigningSlot(null)}
                        />

                        {/* Assignment Dropdown for Director */}
                        {assigningSlot?.areaId === area.id && assigningSlot?.role === "DIRECTOR" && (
                            <UserSelector
                                users={filteredUsers}
                                searchTerm={searchTerm}
                                onSearch={setSearchTerm}
                                onSelect={(userId) => handleAssign(userId, area.id, "DIRECTOR")}
                                isPending={isPending}
                            />
                        )}

                        {/* Subdirector Slot */}
                        <div className="mt-3">
                            <LeaderSlot
                                label="Subdirector"
                                icon={<Shield className="w-4 h-4" />}
                                leader={area.subdirector}
                                colorClass="blue"
                                isAssigning={assigningSlot?.areaId === area.id && assigningSlot?.role === "SUBDIRECTOR"}
                                isPending={isPending}
                                onAssignClick={() => {
                                    setAssigningSlot({ areaId: area.id, role: "SUBDIRECTOR" });
                                    setSearchTerm("");
                                }}
                                onRemove={area.subdirector ? () => handleRemoveLeader(area.subdirector!.id) : undefined}
                                onCancelAssign={() => setAssigningSlot(null)}
                            />

                            {/* Assignment Dropdown for Subdirector */}
                            {assigningSlot?.areaId === area.id && assigningSlot?.role === "SUBDIRECTOR" && (
                                <UserSelector
                                    users={filteredUsers}
                                    searchTerm={searchTerm}
                                    onSearch={setSearchTerm}
                                    onSelect={(userId) => handleAssign(userId, area.id, "SUBDIRECTOR")}
                                    isPending={isPending}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Sub-components ---

function LeaderSlot({
    label,
    icon,
    leader,
    colorClass,
    isAssigning,
    isPending,
    onAssignClick,
    onRemove,
    onCancelAssign,
}: {
    label: string;
    icon: React.ReactNode;
    leader: Leader | null;
    colorClass: "amber" | "blue";
    isAssigning: boolean;
    isPending: boolean;
    onAssignClick: () => void;
    onRemove?: () => void;
    onCancelAssign: () => void;
}) {
    const colorMap = {
        amber: {
            bg: "bg-amber-50",
            text: "text-amber-700",
            border: "border-amber-200",
            badge: "bg-amber-100 text-amber-700",
        },
        blue: {
            bg: "bg-blue-50",
            text: "text-blue-700",
            border: "border-blue-200",
            badge: "bg-blue-100 text-blue-700",
        },
    };
    const c = colorMap[colorClass];

    return (
        <div className={`flex items-center justify-between p-3 rounded-xl ${c.bg} border ${c.border}`}>
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${c.badge} flex items-center justify-center`}>
                    {icon}
                </div>
                {leader ? (
                    <div>
                        <p className="font-bold text-sm text-gray-900">{leader.name || leader.email}</p>
                        <p className="text-xs text-gray-500">{leader.email}</p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 italic">Sin {label.toLowerCase()} asignado</p>
                )}
            </div>

            <div className="flex items-center gap-1.5">
                {leader && onRemove && (
                    <button
                        onClick={onRemove}
                        disabled={isPending}
                        className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                    >
                        Quitar
                    </button>
                )}
                {isAssigning ? (
                    <button
                        onClick={onCancelAssign}
                        className="px-2.5 py-1 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                ) : (
                    <button
                        onClick={onAssignClick}
                        disabled={isPending}
                        className={`px-2.5 py-1 text-xs font-bold ${c.text} ${c.badge} hover:opacity-80 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1`}
                    >
                        <ChevronDown className="w-3 h-3" />
                        {leader ? "Cambiar" : "Asignar"}
                    </button>
                )}
            </div>
        </div>
    );
}

function UserSelector({
    users,
    searchTerm,
    onSearch,
    onSelect,
    isPending,
}: {
    users: EligibleUser[];
    searchTerm: string;
    onSearch: (term: string) => void;
    onSelect: (userId: string) => void;
    isPending: boolean;
}) {
    return (
        <div className="mt-2 bg-white border border-meteorite-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-gray-100">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => onSearch(e.target.value)}
                    placeholder="Buscar usuario..."
                    autoFocus
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-meteorite-400 focus:ring-1 focus:ring-meteorite-200 outline-none transition-all"
                />
            </div>
            <div className="max-h-48 overflow-y-auto">
                {users.length === 0 && (
                    <p className="p-4 text-sm text-gray-400 text-center">No se encontraron usuarios</p>
                )}
                {users.slice(0, 20).map(user => (
                    <button
                        key={user.id}
                        onClick={() => onSelect(user.id)}
                        disabled={isPending}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-meteorite-50 transition-all text-left disabled:opacity-50"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin text-meteorite-400" />
                        ) : (
                            <User className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{user.name || "Sin nombre"}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                            {user.role}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
