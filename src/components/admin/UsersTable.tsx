"use client";

import { useState } from "react";
import Image from "next/image";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import UserEditDrawer from "./UserEditDrawer";

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
}

export default function UsersTable({ users, areas }: UsersTableProps) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setIsDrawerOpen(true);
    };

    const closeDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedUser(null);
    };

    return (
        <div className="relative overflow-x-auto bg-white rounded-2xl shadow-sm border border-meteorite-100">
            {/* Table */}
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-meteorite-900 uppercase bg-meteorite-50/50">
                    <tr>
                        <th scope="col" className="p-4">
                            <div className="flex items-center">
                                <input id="checkbox-all" type="checkbox" className="w-4 h-4 text-meteorite-600 bg-gray-100 border-gray-300 rounded focus:ring-meteorite-500" />
                                <label htmlFor="checkbox-all" className="sr-only">checkbox</label>
                            </div>
                        </th>
                        <th scope="col" className="px-6 py-3 font-medium">Nombre / Email</th>
                        <th scope="col" className="px-6 py-3 font-medium">Rol & Área</th>
                        <th scope="col" className="px-6 py-3 font-medium">Categoría</th>
                        <th scope="col" className="px-6 py-3 font-medium">Estado</th>
                        <th scope="col" className="px-6 py-3 font-medium">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className="bg-white border-b border-meteorite-100 hover:bg-meteorite-50/30 transition-colors">
                            <td className="w-4 p-4">
                                <div className="flex items-center">
                                    <input id={`checkbox-${user.id}`} type="checkbox" className="w-4 h-4 text-meteorite-600 bg-gray-100 border-gray-300 rounded focus:ring-meteorite-500" />
                                    <label htmlFor={`checkbox-${user.id}`} className="sr-only">checkbox</label>
                                </div>
                            </td>
                            <th scope="row" className="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap">
                                {user.image ? (
                                    <Image
                                        width={40} height={40}
                                        className="w-10 h-10 rounded-full border border-meteorite-200"
                                        src={user.image}
                                        alt={user.name || "User"}
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-meteorite-100 text-meteorite-600 flex items-center justify-center font-bold text-lg border border-meteorite-200">
                                        {(user.firstName?.[0] || user.name?.[0] || "U").toUpperCase()}
                                    </div>
                                )}
                                <div className="pl-3">
                                    <div className="text-base font-semibold">{user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name}</div>
                                    <div className="font-normal text-gray-500">{user.email}</div>
                                </div>
                            </th>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-medium text-meteorite-900">{user.role}</span>
                                    <span className="text-xs text-gray-500">{user.currentArea?.name || "Sin Área"}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-xs font-medium border ${user.category === 'MASTER' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                    user.category === 'SENIOR' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                        'bg-gray-100 text-gray-700 border-gray-200'
                                    }`}>
                                    {user.category || 'TRAINEE'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <div className={`h-2.5 w-2.5 rounded-full me-2 ${user.status === 'ACTIVE' ? 'bg-green-500' :
                                        user.status === 'BANNED' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}></div>
                                    <span className="font-medium">{user.status}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <button
                                    onClick={() => handleEditClick(user)}
                                    className="font-medium text-meteorite-600 dark:text-meteorite-400 hover:underline flex items-center gap-1"
                                >
                                    <Edit className="w-4 h-4" /> Editar
                                </button>
                            </td>
                        </tr>
                    ))}

                    {users.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-500">
                                No se encontraron usuarios. Intenta ajustar los filtros.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Pagination Footer (Placeholder) */}
            <div className="flex items-center justify-between p-4 border-t border-meteorite-100">
                <span className="text-sm text-gray-500">
                    Mostrando <span className="font-semibold text-gray-900">{users.length}</span> resultados
                </span>
                <div className="inline-flex mt-2 xs:mt-0">
                    {/* Buttons would go here linked to page param */}
                </div>
            </div>

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
