import UserFilters from "@/components/admin/UserFilters";
import UsersTable from "@/components/admin/UsersTable";
import { getAreasAction } from "@/server/actions/organization.actions";
import { getUsersAction } from "@/server/actions/user.actions";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminUsersPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;
    const role = typeof searchParams.role === 'string' ? searchParams.role : undefined;
    const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1;

    // Fetch data in parallel
    const [usersResult, areasResult] = await Promise.all([
        getUsersAction(search, role, status, page),
        getAreasAction(),
    ]);

    if (!usersResult.success || !areasResult.success) {
        return (
            <div className="p-10 text-center text-red-500 bg-white rounded-lg shadow">
                <h3 className="font-bold text-lg">Error al cargar datos</h3>
                <p>Usuarios: {(usersResult as any).error}</p>
                <p>Áreas: {(areasResult as any).error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-meteorite-50 mx-auto p-4 md:p-6 2xl:p-10">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-bold text-meteorite-950">
                    Gestión de Usuarios
                </h2>

                <nav>
                    <ol className="flex items-center gap-2 text-sm text-meteorite-600">
                        <li>
                            <a className="hover:text-meteorite-800" href="/dashboard">
                                Dashboard
                            </a>
                        </li>
                        <li>/</li>
                        <li className="font-medium text-meteorite-500">Usuarios</li>
                    </ol>
                </nav>
            </div>

            {/* Filters */}
            <UserFilters />

            {/* Data Table */}
            <UsersTable
                users={usersResult.data.data}
                areas={areasResult.data}
            />
        </div>
    );
}
