"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Edit, ChevronLeft, ChevronRight, Copy, ArrowUpDown, ArrowUp, ArrowDown, Search, CheckCircle2, XCircle } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import UserEditDrawer from "./UserEditDrawer";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type User = {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string | null;
    firstName: string | null;
    lastName: string | null;
    status: string | null;
    currentAreaId: string | null;
    cui: string | null;
    phone: string | null;
    category: string | null;
    moderationReason: string | null;
    suspendedUntil: Date | null;
    currentArea: {
        id: string;
        name: string;
        code: string | null;
    } | null;
    customRoles?: {
        customRole: {
            id: string;
            name: string;
            color: string;
        }
    }[];
};

type Area = {
    id: string;
    name: string;
    code: string | null;
};

interface UsersTableProps {
    users: User[];
    areas: Area[];
    customRoles: any[];
    canManageRole: boolean;
    canManageData: boolean;
    canModerate: boolean;
    canManageCustomRoles: boolean;
    pagination?: {
        total: number;
        page: number;
        lastPage: number;
    };
}

const getRolePrefix = (role: string | null) => {
    switch (role) {
        case "DIRECTOR": return "D";
        case "SUBDIRECTOR": return "S";
        case "MEMBER": return "M";
        case "VOLUNTEER": return "V";
        case "PRESIDENT": return "P";
        case "VICEPRESIDENT": return "VP";
        case "SECRETARY": return "SCT";
        case "TREASURER": return "T";
        case "DEV": return "X";
        default: return "V";
    }
};

const getRoleColor = (role: string | null) => {
    switch (role) {
        case "DEV": return "bg-purple-100 text-purple-800 border-purple-200";
        case "PRESIDENT": return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case "VICEPRESIDENT": return "bg-orange-100 text-orange-800 border-orange-200";
        case "DIRECTOR": return "bg-blue-100 text-blue-800 border-blue-200";
        case "SUBDIRECTOR": return "bg-sky-100 text-sky-800 border-sky-200";
        case "SECRETARY": return "bg-pink-100 text-pink-800 border-pink-200";
        case "TREASURER": return "bg-emerald-100 text-emerald-800 border-emerald-200";
        case "MEMBER": return "bg-indigo-100 text-indigo-800 border-indigo-200";
        case "VOLUNTEER": return "bg-gray-100 text-gray-800 border-gray-200";
        default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
};

const getRoleCardStyle = (role: string | null) => {
    switch (role) {
        case "DEV":
            return "border-purple-200 bg-gradient-to-br from-purple-50 via-white to-white";
        case "PRESIDENT":
            return "border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-white";
        case "VICEPRESIDENT":
            return "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white";
        case "DIRECTOR":
            return "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white";
        case "SUBDIRECTOR":
            return "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white";
        case "SECRETARY":
            return "border-pink-200 bg-gradient-to-br from-pink-50 via-white to-white";
        case "TREASURER":
            return "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white";
        case "MEMBER":
            return "border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white";
        default:
            return "border-gray-200 bg-gradient-to-br from-gray-50 via-white to-white";
    }
};

const getAreaChipStyle = (areaCode: string | null | undefined) => {
    if (!areaCode) return "bg-gray-100 text-gray-700 border-gray-200";
    const palette = [
        "bg-cyan-100 text-cyan-800 border-cyan-200",
        "bg-teal-100 text-teal-800 border-teal-200",
        "bg-lime-100 text-lime-800 border-lime-200",
        "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
        "bg-rose-100 text-rose-800 border-rose-200",
        "bg-violet-100 text-violet-800 border-violet-200",
    ];
    const idx = areaCode
        .split("")
        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % palette.length;
    return palette[idx];
};

const getRoleLabel = (role: string | null) => {
    if (!role) return "Voluntario";
    const labels: Record<string, string> = {
        "DEV": "Desarrollador",
        "PRESIDENT": "Presidente",
        "VICEPRESIDENT": "Vicepresidente",
        "SECRETARY": "Secretario",
        "TREASURER": "Tesorero",
        "DIRECTOR": "Director",
        "SUBDIRECTOR": "Subdirector",
        "MEMBER": "Miembro",
        "VOLUNTEER": "Voluntario"
    };
    return labels[role] || role;
};

const formatCUI = (user: User) => {
    if (!user.cui) return "Sin CUI";
    const rolePrefix = getRolePrefix(user.role);
    const areaCode = user.currentArea?.code || "GEN";
    const last4 = user.cui.length > 4 ? user.cui.slice(-4) : user.cui;
    return `${rolePrefix}${areaCode}-${last4}`;
};

type ModerationMeta = {
    show: boolean;
    label: string;
    detail: string | null;
    badgeClass: string;
    dotClass: string;
    stripClass: string;
    avatarBorderClass: string;
};

const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const getRemainingTimeLabel = (suspendedUntil: Date | string | null | undefined): string | null => {
    const endDate = toDate(suspendedUntil);
    if (!endDate) return null;

    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    if (diffMs <= 0) return "suspensión vencida";

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    if (totalMinutes < 24 * 60) {
        const isSameDay = endDate.toDateString() === now.toDateString();
        const dayLabel = isSameDay ? "hoy" : "mañana";
        const hourLabel = endDate.toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        return `vence ${dayLabel} a las ${hourLabel}`;
    }

    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h restantes`;
    if (hours > 0) return `${hours}h ${minutes}m restantes`;
    return `${Math.max(minutes, 1)}m restantes`;
};

const getModerationMeta = (user: User): ModerationMeta => {
    const status = (user.status || "").toUpperCase();

    if (status === "ACTIVE") {
        return {
            show: true,
            label: "Activo",
            detail: "Sin restricciones",
            badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
            dotClass: "bg-emerald-500",
            stripClass: "bg-emerald-500",
            avatarBorderClass: "border-emerald-200",
        };
    }

    if (status === "SUSPENDED") {
        const remaining = getRemainingTimeLabel(user.suspendedUntil);
        return {
            show: true,
            label: "Suspendido",
            detail: remaining ? `Tiempo: ${remaining}` : "Sin fecha límite definida",
            badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
            dotClass: "bg-yellow-500",
            stripClass: "bg-yellow-500",
            avatarBorderClass: "border-yellow-200",
        };
    }

    if (status === "BANNED") {
        return {
            show: true,
            label: "Baneado",
            detail: user.moderationReason ? `Motivo: ${user.moderationReason}` : "Acceso bloqueado",
            badgeClass: "bg-red-100 text-red-800 border-red-200",
            dotClass: "bg-red-500",
            stripClass: "bg-red-500",
            avatarBorderClass: "border-red-200",
        };
    }

    if (status === "WARNED") {
        return {
            show: true,
            label: "Advertido",
            detail: user.moderationReason ? `Motivo: ${user.moderationReason}` : "Advertencia registrada",
            badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
            dotClass: "bg-orange-500",
            stripClass: "bg-orange-500",
            avatarBorderClass: "border-orange-200",
        };
    }

    return {
        show: false,
        label: "",
        detail: null,
        badgeClass: "",
        dotClass: "bg-meteorite-300",
        stripClass: "bg-meteorite-200",
        avatarBorderClass: "border-white group-hover:border-meteorite-200",
    };
};

export default function UsersTable({
    users,
    areas,
    customRoles,
    canManageRole,
    canManageData,
    canModerate,
    canManageCustomRoles,
    pagination,
}: UsersTableProps) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [mobileActionUser, setMobileActionUser] = useState<User | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const feedbackTimeout = useRef<NodeJS.Timeout | null>(null);

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        feedbackTimeout.current = setTimeout(() => setFeedback(null), 4000);
    };

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const currentSort = searchParams.get('sort') || '';
    const currentOrder = searchParams.get('order') || 'asc';

    const handleSort = (field: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (currentSort === field) {
            params.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
        } else {
            params.set('sort', field);
            params.set('order', 'asc');
        }
        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (currentSort !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return currentOrder === 'asc'
            ? <ArrowUp className="w-3 h-3 ml-1 text-meteorite-600" />
            : <ArrowDown className="w-3 h-3 ml-1 text-meteorite-600" />;
    };

    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setIsDrawerOpen(true);
        setActiveMenu(null);
    };

    const handleCopy = async (text: string, label: string) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const temp = document.createElement("textarea");
                temp.value = text;
                temp.style.position = "fixed";
                temp.style.opacity = "0";
                document.body.appendChild(temp);
                temp.focus();
                temp.select();
                document.execCommand("copy");
                document.body.removeChild(temp);
            }
            setActiveMenu(null);
            showFeedback("success", `${label} copiado al portapapeles.`);
        } catch {
            showFeedback("error", `No se pudo copiar ${label}.`);
        }
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedUser(null);
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", newPage.toString());
        router.push(`?${params.toString()}`);
    };

    const toggleMenu = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === id ? null : id);
    };

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-user-actions-menu="true"]')) {
                return;
            }
            setActiveMenu(null);
        };

        document.addEventListener("pointerdown", handleDocumentClick);
        return () => {
            document.removeEventListener("pointerdown", handleDocumentClick);
        };
    }, []);

    return (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-meteorite-100 overflow-visible flex flex-col relative">

            {/* Feedback Snackbar */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 animate-fade-in ${feedback.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-meteorite-900 uppercase bg-meteorite-50/80 border-b border-meteorite-100">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider cursor-pointer group select-none" onClick={() => handleSort('name')}>
                                <div className="flex items-center">Nombre / Email <SortIcon field="name" /></div>
                            </th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider cursor-pointer group select-none" onClick={() => handleSort('cui')}>
                                <div className="flex items-center">Identificación <SortIcon field="cui" /></div>
                            </th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider cursor-pointer group select-none" onClick={() => handleSort('role')}>
                                <div className="flex items-center">Jerarquía & Área <SortIcon field="role" /></div>
                            </th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider cursor-pointer group select-none" onClick={() => handleSort('category')}>
                                <div className="flex items-center">Categoría <SortIcon field="category" /></div>
                            </th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider cursor-pointer group select-none" onClick={() => handleSort('status')}>
                                <div className="flex items-center">Estado <SortIcon field="status" /></div>
                            </th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-meteorite-50 relative">
                        {users.map((user) => {
                            const moderation = getModerationMeta(user);
                            return (
                            <tr key={user.id} className="hover:bg-meteorite-50/50 transition-colors group">
                                <th scope="row" className="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap">
                                    <div className="relative">
                                        <div className={`w-11 h-11 rounded-full overflow-hidden bg-meteorite-100 flex items-center justify-center text-meteorite-600 font-bold border-2 shadow-sm ${moderation.avatarBorderClass} transition-all`}>
                                            {user.image ? (
                                                <UserAvatar src={user.image} name={user.name || user.email} alt={user.name || "User"} className="w-full h-full" />
                                            ) : (
                                                <span>{(user.name || user.email || "?").charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        {moderation.show && (
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 ${moderation.dotClass} border-2 border-white rounded-full`}></div>
                                        )}
                                    </div>
                                    <div className="pl-4">
                                        <div className="text-sm font-bold text-meteorite-950">{user.name || "Sin Nombre"}</div>
                                        <div className="text-xs font-normal text-gray-500 hover:text-meteorite-600 transition-colors cursor-pointer" onClick={() => handleCopy(user.email, "Email")}>{user.email}</div>
                                    </div>
                                </th>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span
                                            className="font-mono font-bold text-meteorite-700 bg-meteorite-50/80 px-2 py-1 rounded text-xs w-fit mb-1 border border-meteorite-100 hover:bg-meteorite-100 cursor-copy transition-colors"
                                            onClick={() => handleCopy(user.cui || "", "CUI")}
                                            title="Click para copiar CUI"
                                        >
                                            {formatCUI(user)}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                                            {user.phone || "Sin Celular"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1.5 items-start">
                                        <span className={`px-2.5 py-1 text-xs font-bold leading-none rounded-full border ${getRoleColor(user.role)}`}>
                                            {getRoleLabel(user.role)}
                                        </span>
                                        <div className="text-xs font-semibold text-meteorite-600/80">
                                            {user.currentArea?.name || "Sin Área"}
                                        </div>
                                        {/* Custom Roles Badges */}
                                        {user.customRoles && user.customRoles.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {user.customRoles.map((ur) => (
                                                    <span
                                                        key={ur.customRole.id}
                                                        className="px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap shadow-sm"
                                                        style={{
                                                            backgroundColor: `${ur.customRole.color}15`,
                                                            color: ur.customRole.color,
                                                            borderColor: `${ur.customRole.color}30`
                                                        }}
                                                    >
                                                        {ur.customRole.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-gray-100/80 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200">
                                        {user.category || "Trainee"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {moderation.show ? (
                                        <div className="space-y-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${moderation.badgeClass}`}>
                                                {moderation.label}
                                            </span>
                                            {moderation.detail && (
                                                <p className="text-[11px] text-meteorite-600 max-w-[220px] truncate" title={moderation.detail}>
                                                    {moderation.detail}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-semibold text-meteorite-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="relative inline-block text-left" data-user-actions-menu="true">
                                        <button
                                            type="button"
                                            onClick={(e) => toggleMenu(user.id, e)}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-meteorite-400 hover:text-meteorite-700 hover:bg-meteorite-100 transition-all focus:outline-none focus:ring-2 focus:ring-meteorite-500"
                                        >
                                            <MoreVertical className="w-5 h-5" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {activeMenu === user.id && (
                                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 py-1 divide-y divide-gray-100">
                                                <div className="py-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(user); }}
                                                        type="button"
                                                        className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-meteorite-50 hover:text-meteorite-900 w-full text-left font-medium transition-colors"
                                                    >
                                                        <Edit className="mr-3 h-4 w-4 text-gray-400 group-hover:text-meteorite-500" />
                                                        Editar Usuario
                                                    </button>
                                                </div>
                                                <div className="py-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); void handleCopy(user.email, "Email"); }}
                                                        type="button"
                                                        className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-meteorite-50 hover:text-meteorite-900 w-full text-left transition-colors"
                                                    >
                                                        <Copy className="mr-3 h-4 w-4 text-gray-400 group-hover:text-meteorite-500" />
                                                        Copiar Email
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); void handleCopy(formatCUI(user), "CUI"); }}
                                                        type="button"
                                                        className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-meteorite-50 hover:text-meteorite-900 w-full text-left transition-colors"
                                                    >
                                                        <Copy className="mr-3 h-4 w-4 text-gray-400 group-hover:text-meteorite-500" />
                                                        Copiar CUI
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );})}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-meteorite-50 rounded-full flex items-center justify-center mb-4">
                                            <Search className="w-8 h-8 text-meteorite-300" />
                                        </div>
                                        <p className="font-medium text-meteorite-900">No se encontraron usuarios</p>
                                        <p className="text-sm mt-1">Ajusta los filtros o intenta una nueva búsqueda.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden flex flex-col gap-4 p-4 bg-gray-50/50">
                {/* Mobile Sort Helper */}
                <div className="flex items-center justify-between px-2 bg-white p-3 rounded-xl border border-gray-200">
                    <span className="text-xs font-bold text-gray-500">Ordenar por:</span>
                    <select
                        className="text-sm font-semibold text-meteorite-800 bg-transparent border-none focus:ring-0 p-0"
                        value={currentSort}
                        onChange={(e) => handleSort(e.target.value)}
                    >
                        <option value="name">Nombre / Email</option>
                        <option value="cui">Identificación</option>
                        <option value="role">Jerarquía</option>
                        <option value="status">Estado</option>
                    </select>
                </div>

                {users.map((user) => {
                    const moderation = getModerationMeta(user);
                    return (
                    <div key={user.id} className={`rounded-2xl border shadow-sm p-4 relative flex flex-col overflow-visible ${getRoleCardStyle(user.role)}`}>
                        {/* Status Indicator Strip */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${moderation.stripClass}`}></div>

                        <div className="flex justify-between items-start mb-3 pl-2">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-meteorite-100 flex items-center justify-center text-meteorite-600 font-bold border-2 border-white shadow-sm">
                                        {user.image ? (
                                            <UserAvatar src={user.image} name={user.name || user.email} alt={user.name || "User"} className="w-full h-full" />
                                        ) : (
                                            <span>{(user.name || user.email || "?").charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-meteorite-950 leading-tight">{user.name || "Sin Nombre"}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5 break-all pr-2">{user.email}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {moderation.show && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${moderation.badgeClass}`}>
                                                {moderation.label}
                                            </span>
                                        )}
                                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black border bg-meteorite-100 text-meteorite-700 border-meteorite-200">
                                            {user.category || "Trainee"}
                                        </span>
                                        {user.currentArea?.code && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${getAreaChipStyle(user.currentArea.code)}`}>
                                                {user.currentArea.code}
                                            </span>
                                        )}
                                    </div>
                                    {moderation.show && moderation.detail && (
                                        <p className="text-[10px] text-meteorite-500 mt-1 max-w-[220px] truncate" title={moderation.detail}>
                                            {moderation.detail}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Actions */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMobileActionUser(user);
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="p-1.5 text-gray-400 hover:text-meteorite-600 bg-gray-50 rounded-lg"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="pl-2 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-medium mb-1">Rol y Área</span>
                                <span className={`w-fit px-2 py-0.5 text-[11px] font-bold rounded border ${getRoleColor(user.role)} mb-1`}>
                                    {getRoleLabel(user.role)}
                                </span>
                                <span className={`w-fit text-[11px] font-bold px-2 py-0.5 rounded border ${getAreaChipStyle(user.currentArea?.code)}`}>
                                    {user.currentArea?.name || "Sin Área"}
                                </span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-medium mb-1">Identificación</span>
                                <span className="font-mono font-bold text-meteorite-800 text-xs mb-1">{formatCUI(user)}</span>
                                <span className="text-xs text-gray-500 font-medium">{user.phone || "Sin celular"}</span>
                            </div>
                        </div>

                        {user.customRoles && user.customRoles.length > 0 && (
                            <div className="pl-2 mt-3 flex flex-wrap gap-1.5">
                                {user.customRoles.slice(0, 3).map((ur) => (
                                    <span
                                        key={ur.customRole.id}
                                        className="px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap shadow-sm"
                                        style={{
                                            backgroundColor: `${ur.customRole.color}15`,
                                            color: ur.customRole.color,
                                            borderColor: `${ur.customRole.color}30`,
                                        }}
                                    >
                                        {ur.customRole.name}
                                    </span>
                                ))}
                                {user.customRoles.length > 3 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-meteorite-200 text-meteorite-600 bg-white">
                                        +{user.customRoles.length - 3}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );})}

                {users.length === 0 && (
                    <div className="py-8 text-center text-gray-500 bg-white rounded-2xl border border-meteorite-100">
                        <p className="font-medium">No se encontraron usuarios</p>
                    </div>
                )}
            </div>

            {/* Mobile Actions Bottom Sheet */}
            {mobileActionUser && (
                <div className="md:hidden fixed inset-0 z-[250]" data-user-actions-menu="true">
                    <div
                        className="absolute inset-0 bg-black/35"
                        onPointerDown={() => setMobileActionUser(null)}
                    />
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl border-t border-meteorite-200 shadow-2xl p-4 space-y-2"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 bg-meteorite-200 rounded-full mx-auto mb-2" />
                        <p className="text-sm font-black text-meteorite-900 px-1">
                            {mobileActionUser.name || "Sin Nombre"}
                        </p>
                        <p className="text-xs text-meteorite-500 px-1 pb-1">
                            {mobileActionUser.email}
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                handleEditClick(mobileActionUser);
                                setMobileActionUser(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-meteorite-200 text-left font-bold text-meteorite-800 hover:bg-meteorite-50"
                        >
                            <Edit className="w-4 h-4" />
                            Editar usuario
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                void handleCopy(mobileActionUser.email, "Email");
                                setMobileActionUser(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-meteorite-200 text-left font-semibold text-meteorite-700 hover:bg-meteorite-50"
                        >
                            <Copy className="w-4 h-4" />
                            Copiar email
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                void handleCopy(formatCUI(mobileActionUser), "CUI");
                                setMobileActionUser(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-meteorite-200 text-left font-semibold text-meteorite-700 hover:bg-meteorite-50"
                        >
                            <Copy className="w-4 h-4" />
                            Copiar CUI
                        </button>

                        <button
                            type="button"
                            onClick={() => setMobileActionUser(null)}
                            className="w-full px-4 py-3 rounded-xl bg-meteorite-900 text-white font-bold"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Pagination Helper */}
            {pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 md:px-6 border-t border-meteorite-100 bg-meteorite-50/50 gap-4">
                    <span className="text-xs md:text-sm font-medium text-meteorite-600">
                        Página <span className="font-bold text-meteorite-900">{pagination.page}</span> de <span className="font-bold text-meteorite-900">{pagination.lastPage}</span>
                        <span className="mx-2">•</span>
                        Total: <span className="font-bold">{pagination.total}</span> usuarios
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="flex items-center justify-center px-4 py-2 text-sm font-bold text-meteorite-700 bg-white border border-meteorite-200 rounded-xl hover:bg-meteorite-50 hover:border-meteorite-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm group"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                            Anterior
                        </button>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.lastPage}
                            className="flex items-center justify-center px-4 py-2 text-sm font-bold text-meteorite-700 bg-white border border-meteorite-200 rounded-xl hover:bg-meteorite-50 hover:border-meteorite-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm group"
                        >
                            Siguiente
                            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            <UserEditDrawer
                user={selectedUser}
                areas={areas}
                customRoles={customRoles}
                canManageRole={canManageRole}
                canManageData={canManageData}
                canModerate={canModerate}
                canManageCustomRoles={canManageCustomRoles}
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                onShowFeedback={showFeedback}
            />
        </div>
    );
}
