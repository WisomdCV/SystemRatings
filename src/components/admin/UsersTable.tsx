"use client";

import { useState } from "react";
import Image from "next/image";
import { MoreVertical, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import UserEditDrawer from "./UserEditDrawer";
import { useRouter, useSearchParams } from "next/navigation";

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
};

type Area = {
    id: string;
    name: string;
    code: string | null;
};

interface UsersTableProps {
    users: User[];
    areas: Area[];
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
        case "TREASURER": return "T";
        case "DEV": return "X";
        default: return "V";
    }
};

const formatCUI = (user: User) => {
    if (!user.cui) return "Sin CUI";

    // Logic: [RolePrefix][AreaCode]-[Last4CUI]
    const rolePrefix = getRolePrefix(user.role);
    const areaCode = user.currentArea?.code || "GEN"; // Fallback to GEN if no area
    const last4 = user.cui.length > 4 ? user.cui.slice(-4) : user.cui;

    return `${rolePrefix}${areaCode}-${last4}`;
};

export default function UsersTable({ users, areas, pagination }: UsersTableProps) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setIsDrawerOpen(true);
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

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-meteorite-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-meteorite-900 uppercase bg-meteorite-50/50 border-b border-meteorite-100">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Nombre / Email</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Identificación</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Rol & Área</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Categoría</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Estado</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-meteorite-50">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-meteorite-50/50 transition-colors group">
                                <th scope="row" className="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-meteorite-100 flex items-center justify-center text-meteorite-600 font-bold border-2 border-white shadow-sm">
                                            {user.image ? (
                                                <img className="w-full h-full object-cover" src={user.image} alt={user.name || "User"} />
                                            ) : (
                                                <span>{(user.name || user.email || "?").charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pl-3">
                                        <div className="text-sm font-bold text-meteorite-950">{user.name || "Sin Nombre"}</div>
                                        <div className="text-xs font-normal text-gray-500">{user.email}</div>
                                    </div>
                                </th>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-bold text-meteorite-700 bg-meteorite-50 px-2 py-0.5 rounded text-xs w-fit mb-1">
                                            {formatCUI(user)}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            {user.phone || "Sin Celular"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <div className="text-sm font-bold text-meteorite-800">{user.role || "Voluntario"}</div>
                                        <div className="text-xs text-meteorite-500">{user.currentArea?.name || "Sin Área"}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-gray-200">
                                        {user.category || "Trainee"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className={`h-2.5 w-2.5 rounded-full mr-2 ${user.status === 'ACTIVE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                                        <span className={`text-xs font-bold ${user.status === 'ACTIVE' ? 'text-green-700' : 'text-red-700'}`}>
                                            {user.status || "UNKNOWN"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-100 transition-all font-medium"
                                        title="Editar Usuario"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No se encontraron usuarios que coincidan con la búsqueda.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Helper */}
            {pagination && (
                <div className="flex items-center justify-between p-4 border-t border-meteorite-100 bg-meteorite-50/30">
                    <span className="text-xs font-medium text-meteorite-500">
                        Página <span className="font-bold text-meteorite-800">{pagination.page}</span> de <span className="font-bold text-meteorite-800">{pagination.lastPage}</span>
                        <span className="hidden sm:inline"> • Total: {pagination.total} usuarios</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-meteorite-700 bg-white border border-meteorite-200 rounded-lg hover:bg-meteorite-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft className="w-3 h-3 mr-1" />
                            Anterior
                        </button>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.lastPage}
                            className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-meteorite-700 bg-white border border-meteorite-200 rounded-lg hover:bg-meteorite-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            Siguiente
                            <ChevronRight className="w-3 h-3 ml-1" />
                        </button>
                    </div>
                </div>
            )}

            <UserEditDrawer
                user={selectedUser}
                areas={areas}
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
            />
        </div>
    );
}
