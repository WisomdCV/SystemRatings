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

export default function UsersTable({ users, areas, pagination }: UsersTableProps) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setIsDrawerOpen(true);
    };

    const closeDrawer = () => {
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
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Rol & Área</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Categoría</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Estado</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-meteorite-50">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-meteorite-50/50 transition-colors group">
                                <th scope="row" className="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap">
                                    {user.image ? (
                                        <Image
                                            width={40} height={40}
                                            className="w-10 h-10 rounded-xl border border-meteorite-200 shadow-sm"
                                            src={user.image}
                                            alt={user.name || "User"}
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-meteorite-100 text-meteorite-600 flex items-center justify-center font-bold text-lg border border-meteorite-200 shadow-sm">
                                            {(user.firstName?.[0] || user.name?.[0] || "U").toUpperCase()}
                                        </div>
                                    )}
                                    <div className="pl-4">
                                        <div className="text-sm font-bold text-meteorite-950">{user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name}</div>
                                        <div className="text-xs font-medium text-meteorite-500">{user.email}</div>
                                    </div>
                                </th>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-meteorite-800 text-xs">{user.role}</span>
                                        <span className="text-[10px] font-medium text-meteorite-400 uppercase tracking-wide">{user.currentArea?.name || "Sin Área"}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-lg bg-opacity-10 py-1 px-2.5 text-[10px] font-bold border ${user.category === 'MASTER' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                        user.category === 'SENIOR' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                        {user.category || 'TRAINEE'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className={`h-2 w-2 rounded-full me-2 ${user.status === 'ACTIVE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                            user.status === 'BANNED' ? 'bg-red-500' : 'bg-yellow-500'
                                            }`}></div>
                                        <span className="font-medium text-xs text-gray-700">{user.status}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-meteorite-400 hover:text-meteorite-600 hover:bg-meteorite-100 transition-all"
                                        title="Editar Usuario"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-meteorite-400 font-medium">
                                    No se encontraron usuarios. Intenta ajustar los filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
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
                            className="flex items-center px-3 py-1.5 rounded-lg border border-meteorite-200 bg-white text-xs font-bold text-meteorite-600 hover:bg-meteorite-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft className="w-3 h-3 mr-1" />
                            Anterior
                        </button>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.lastPage}
                            className="flex items-center px-3 py-1.5 rounded-lg border border-meteorite-200 bg-white text-xs font-bold text-meteorite-600 hover:bg-meteorite-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            Siguiente
                            <ChevronRight className="w-3 h-3 ml-1" />
                        </button>
                    </div>
                </div>
            )}

            {/* Drawer */}
            <UserEditDrawer
                user={selectedUser}
                areas={areas}
                isOpen={isDrawerOpen}
                onClose={closeDrawer}
            />
        </div>
    );
}
