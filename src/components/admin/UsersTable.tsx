"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { updateUserRoleAction } from "@/server/actions/user.actions";

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

const ROLES = [
    "VOLUNTEER",
    "MEMBER",
    "DIRECTOR",
    "SUBDIRECTOR",
    "PRESIDENT",
    "TREASURER",
    "DEV",
];

export default function UsersTable({ users, areas }: UsersTableProps) {
    const [isPending, startTransition] = useTransition();

    const handleRoleChange = (userId: string, newRole: string) => {
        startTransition(async () => {
            const result = await updateUserRoleAction({
                userId,
                data: { role: newRole },
            });
            if (!result.success) {
                alert("Error al actualizar rol: " + result.error);
            }
        });
    };

    const handleAreaChange = (userId: string, newAreaId: string) => {
        startTransition(async () => {
            const result = await updateUserRoleAction({
                userId,
                data: { currentAreaId: newAreaId },
            });
            if (!result.success) {
                alert("Error al actualizar área: " + result.error);
            }
        });
    };

    // const handleStatusChange = (userId: string, newStatus: string) => ... (Similar logic)

    return (
        <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
            <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto">
                    <thead>
                        <tr className="bg-gray-2 text-left dark:bg-meta-4">
                            <th className="min-w-[220px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11">
                                Usuario
                            </th>
                            <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                                Rol
                            </th>
                            <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                                Área
                            </th>
                            <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                                Estado
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, key) => (
                            <tr key={user.id}>
                                <td className="border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        <div className="h-12.5 w-12.5 rounded-md">
                                            {user.image ? (
                                                <Image
                                                    src={user.image}
                                                    width={50}
                                                    height={50}
                                                    alt="User"
                                                    className="rounded-full"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-slate-200" />
                                            )}
                                        </div>
                                        <div>
                                            <h5 className="font-medium text-black dark:text-white">
                                                {user.firstName} {user.lastName}
                                            </h5>
                                            <p className="text-sm text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                    <div className="relative">
                                        <select
                                            className="bg-transparent text-black dark:text-white outline-none border border-stroke rounded p-1 text-sm focus:border-primary"
                                            value={user.role || "VOLUNTEER"}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            disabled={isPending}
                                        >
                                            {ROLES.map((role) => (
                                                <option key={role} value={role}>
                                                    {role}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                    <div className="relative">
                                        <select
                                            className="bg-transparent text-black dark:text-white outline-none border border-stroke rounded p-1 text-sm focus:border-primary max-w-[150px]"
                                            value={user.currentAreaId || ""}
                                            onChange={(e) => handleAreaChange(user.id, e.target.value)}
                                            disabled={isPending}
                                        >
                                            <option value="">Sin Área</option>
                                            {areas.map((area) => (
                                                <option key={area.id} value={area.id}>
                                                    {area.name} ({area.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                                <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                    <p
                                        className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${user.status === "ACTIVE"
                                                ? "bg-success text-success"
                                                : user.status === "BANNED"
                                                    ? "bg-danger text-danger"
                                                    : "bg-warning text-warning"
                                            }`}
                                    >
                                        {user.status || "UNKNOWN"}
                                    </p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
