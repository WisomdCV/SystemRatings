"use client";

import { useState } from "react";
import Image from "next/image";
import { MoreVertical, Edit, ChevronLeft, ChevronRight, Copy, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
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

export default function UsersTable({ users, areas, customRoles, pagination }: UsersTableProps) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

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

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setActiveMenu(null);
        // Simple visual feedback instead of heavy toast library for now
        alert(`${label} copiado al portapapeles.`);
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

    // Close menu when clicking outside
    if (typeof window !== 'undefined') {
        window.onclick = () => {
            if (activeMenu) setActiveMenu(null);
        }
    }

    return (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-meteorite-100 overflow-visible flex flex-col">

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
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-meteorite-50/50 transition-colors group">
                                <th scope="row" className="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap">
                                    <div className="relative">
                                        <div className={`w-11 h-11 rounded-full overflow-hidden bg-meteorite-100 flex items-center justify-center text-meteorite-600 font-bold border-2 shadow-sm ${user.status === 'SUSPENDED' ? 'border-red-200' : 'border-white group-hover:border-meteorite-200'} transition-all`}>
                                            {user.image ? (
                                                <img className="w-full h-full object-cover" src={user.image} alt={user.name || "User"} />
                                            ) : (
                                                <span>{(user.name || user.email || "?").charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        {user.status === 'ACTIVE' && (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
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
                                    <div className="flex items-center">
                                        <div className={`h-2.5 w-2.5 rounded-full mr-2 ${user.status === 'ACTIVE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : user.status === 'SUSPENDED' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                                        <span className={`text-xs font-bold ${user.status === 'ACTIVE' ? 'text-green-700' : user.status === 'SUSPENDED' ? 'text-orange-700' : 'text-red-700'}`}>
                                            {user.status || "UNKNOWN"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="relative inline-block text-left">
                                        <button
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
                                                        className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-meteorite-50 hover:text-meteorite-900 w-full text-left font-medium transition-colors"
                                                    >
                                                        <Edit className="mr-3 h-4 w-4 text-gray-400 group-hover:text-meteorite-500" />
                                                        Editar Usuario
                                                    </button>
                                                </div>
                                                <div className="py-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleCopy(user.email, "Email"); }}
                                                        className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-meteorite-50 hover:text-meteorite-900 w-full text-left transition-colors"
                                                    >
                                                        <Copy className="mr-3 h-4 w-4 text-gray-400 group-hover:text-meteorite-500" />
                                                        Copiar Email
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleCopy(formatCUI(user), "CUI"); }}
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
                        ))}
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

                {users.map((user) => (
                    <div key={user.id} className="bg-white rounded-2xl border border-meteorite-100 shadow-sm p-4 relative flex flex-col overflow-hidden">
                        {/* Status Indicator Strip */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${user.status === 'ACTIVE' ? 'bg-green-500' : user.status === 'SUSPENDED' ? 'bg-orange-500' : 'bg-red-500'}`}></div>

                        <div className="flex justify-between items-start mb-3 pl-2">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-meteorite-100 flex items-center justify-center text-meteorite-600 font-bold border-2 border-white shadow-sm">
                                        {user.image ? (
                                            <img className="w-full h-full object-cover" src={user.image} alt={user.name || "User"} />
                                        ) : (
                                            <span>{(user.name || user.email || "?").charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-meteorite-950 leading-tight">{user.name || "Sin Nombre"}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5 break-all pr-2">{user.email}</p>
                                </div>
                            </div>

                            {/* Mobile Actions */}
                            <div className="relative">
                                <button
                                    onClick={(e) => toggleMenu(`mobile-${user.id}`, e)}
                                    className="p-1.5 text-gray-400 hover:text-meteorite-600 bg-gray-50 rounded-lg"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>

                                {/* Dropdown Menu */}
                                {activeMenu === `mobile-${user.id}` && (
                                    <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 py-1 divide-y divide-gray-100 border border-gray-100">
                                        <div className="py-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(user); }}
                                                className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-meteorite-50 w-full text-left font-bold"
                                            >
                                                <Edit className="mr-3 h-4 w-4 text-gray-400" />
                                                Editar Usuario
                                            </button>
                                        </div>
                                        <div className="py-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCopy(formatCUI(user), "CUI"); }}
                                                className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-meteorite-50 w-full text-left"
                                            >
                                                <Copy className="mr-3 h-4 w-4 text-gray-400" />
                                                Copiar CUI
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pl-2 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-medium mb-1">Rol y Área</span>
                                <span className={`w-fit px-2 py-0.5 text-[11px] font-bold rounded border ${getRoleColor(user.role)} mb-1`}>
                                    {getRoleLabel(user.role)}
                                </span>
                                <span className="text-xs font-semibold text-meteorite-700">{user.currentArea?.name || "Sin Área"}</span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-medium mb-1">Identificación</span>
                                <span className="font-mono font-bold text-meteorite-800 text-xs mb-1">{formatCUI(user)}</span>
                                <span className="text-xs text-gray-500 font-medium">{user.phone || "Sin celular"}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {users.length === 0 && (
                    <div className="py-8 text-center text-gray-500 bg-white rounded-2xl border border-meteorite-100">
                        <p className="font-medium">No se encontraron usuarios</p>
                    </div>
                )}
            </div>

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
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
            />
        </div>
    );
}
