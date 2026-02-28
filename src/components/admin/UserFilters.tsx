"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Search, Filter, X } from "lucide-react";

interface UserFiltersProps {
    areas?: { id: string, name: string }[];
}

export default function UserFilters({ areas = [] }: UserFiltersProps) {
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

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", "1");
        if (value && value !== "ALL") {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        replace(`${pathname}?${params.toString()}`);
    };

    const activeFiltersCount = ["role", "status", "area"].filter(key => searchParams.has(key)).length;

    return (
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-5 bg-white rounded-2xl shadow-sm border border-meteorite-100 transition-all">

            {/* Search Input */}
            <div className="w-full xl:w-2/5 relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-meteorite-400 group-focus-within:text-meteorite-600 transition-colors">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    className="block w-full p-3 pl-11 pr-10 text-sm text-meteorite-900 border border-meteorite-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-meteorite-500/20 focus:border-meteorite-500 placeholder-meteorite-300 transition-all shadow-sm"
                    placeholder="Buscar por nombre, email o CUI..."
                    defaultValue={searchParams.get("search")?.toString()}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                {searchParams.get("search") && (
                    <button
                        onClick={() => {
                            const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                            if (input) input.value = '';
                            handleSearch('');
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-meteorite-400 hover:text-red-500 transition-colors"
                        title="Limpiar búsqueda"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center gap-2 px-2">
                    <div className="relative">
                        <Filter className="w-4 h-4 text-meteorite-500" />
                        {activeFiltersCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-meteorite-500 rounded-full"></span>
                        )}
                    </div>
                    <span className="text-sm font-semibold text-meteorite-700 hidden sm:inline-block">Filtros:</span>
                </div>

                {/* Area Filter */}
                <select
                    className="bg-gray-50/80 hover:bg-white border border-meteorite-200 text-meteorite-800 text-sm font-medium rounded-xl focus:ring-2 focus:ring-meteorite-500/20 focus:border-meteorite-500 block p-2.5 pr-8 transition-all shadow-sm cursor-pointer appearance-none min-w-[140px]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                    defaultValue={searchParams.get("area")?.toString() || "ALL"}
                    onChange={(e) => handleFilterChange("area", e.target.value)}
                >
                    <option value="ALL">Todas las Áreas</option>
                    {areas.map(area => (
                        <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                </select>

                {/* Role Filter */}
                <select
                    className="bg-gray-50/80 hover:bg-white border border-meteorite-200 text-meteorite-800 text-sm font-medium rounded-xl focus:ring-2 focus:ring-meteorite-500/20 focus:border-meteorite-500 block p-2.5 pr-8 transition-all shadow-sm cursor-pointer appearance-none min-w-[140px]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                    defaultValue={searchParams.get("role")?.toString() || "ALL"}
                    onChange={(e) => handleFilterChange("role", e.target.value)}
                >
                    <option value="ALL">Todos los Roles</option>
                    <option value="VOLUNTEER">Voluntarios</option>
                    <option value="MEMBER">Miembros Regulares</option>
                    <option value="DIRECTOR">Directores</option>
                    <option value="SUBDIRECTOR">Subdirectores</option>
                    <option value="TREASURER">Tesorero</option>
                    <option value="SECRETARY">Secretario</option>
                    <option value="VICEPRESIDENT">Vicepresidente</option>
                    <option value="PRESIDENT">Presidente</option>
                    <option value="DEV">Desarrollador</option>
                </select>

                {/* Status Filter */}
                <select
                    className="bg-gray-50/80 hover:bg-white border border-meteorite-200 text-meteorite-800 text-sm font-medium rounded-xl focus:ring-2 focus:ring-meteorite-500/20 focus:border-meteorite-500 block p-2.5 pr-8 transition-all shadow-sm cursor-pointer appearance-none min-w-[140px]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                    defaultValue={searchParams.get("status")?.toString() || "ALL"}
                    onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                    <option value="ALL">Cualquier Estado</option>
                    <option value="ACTIVE">Activos</option>
                    <option value="SUSPENDED">Suspendidos</option>
                    <option value="BANNED">Baneados</option>
                    <option value="WARNED">Advertidos</option>
                </select>

                {/* Clear Filters Button */}
                {activeFiltersCount > 0 && (
                    <button
                        onClick={() => {
                            const params = new URLSearchParams(searchParams);
                            params.delete("role");
                            params.delete("status");
                            params.delete("area");
                            params.set("page", "1");
                            replace(`${pathname}?${params.toString()}`);
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors ml-auto xl:ml-2"
                    >
                        Limpiar Filtros
                    </button>
                )}
            </div>
        </div>
    );
}
