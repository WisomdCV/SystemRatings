"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Search, Filter } from "lucide-react";

export default function UserFilters() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", "1"); // Reset pagination on new search
        if (term) {
            params.set("search", term);
        } else {
            params.delete("search");
        }
        replace(`${pathname}?${params.toString()}`);
    }, 300);

    const handleRoleFilter = (role: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", "1");
        if (role && role !== "ALL") {
            params.set("role", role);
        } else {
            params.delete("role");
        }
        replace(`${pathname}?${params.toString()}`);
    };

    const handleStatusFilter = (status: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", "1");
        if (status && status !== "ALL") {
            params.set("status", status);
        } else {
            params.delete("status");
        }
        replace(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4 p-4 bg-white rounded-2xl shadow-sm mb-4 border border-meteorite-100">

            {/* Search Input */}
            <div className="w-full md:w-1/3 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-meteorite-400">
                    <Search className="w-4 h-4" />
                </div>
                <input
                    type="text"
                    className="block w-full p-2.5 pl-10 text-sm text-meteorite-900 border border-meteorite-200 rounded-xl bg-meteorite-50/50 focus:ring-meteorite-500 focus:border-meteorite-500 placeholder-meteorite-300"
                    placeholder="Buscar por nombre, email o CUI..."
                    defaultValue={searchParams.get("search")?.toString()}
                    onChange={(e) => handleSearch(e.target.value)}
                />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
                <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-meteorite-500" />
                    <span className="text-sm text-meteorite-600 font-medium">Filtrar:</span>
                </div>

                <select
                    className="bg-meteorite-50/50 border border-meteorite-200 text-meteorite-900 text-sm rounded-xl focus:ring-meteorite-500 focus:border-meteorite-500 block p-2.5"
                    defaultValue={searchParams.get("role")?.toString() || "ALL"}
                    onChange={(e) => handleRoleFilter(e.target.value)}
                >
                    <option value="ALL">Todos los Roles</option>
                    <option value="VOLUNTEER">Voluntario</option>
                    <option value="MEMBER">Miembro</option>
                    <option value="DIRECTOR">Director</option>
                    <option value="SUBDIRECTOR">Subdirector</option>
                    <option value="PRESIDENT">Presidente</option>
                    <option value="DEV">Desarrollador</option>
                </select>

                <select
                    className="bg-meteorite-50/50 border border-meteorite-200 text-meteorite-900 text-sm rounded-xl focus:ring-meteorite-500 focus:border-meteorite-500 block p-2.5"
                    defaultValue={searchParams.get("status")?.toString() || "ALL"}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                >
                    <option value="ALL">Todos los Estados</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="BANNED">Baneado</option>
                    <option value="SUSPENDED">Suspendido</option>
                    <option value="WARNED">Advertido</option>
                </select>
            </div>
        </div>
    );
}
