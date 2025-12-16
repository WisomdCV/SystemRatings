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
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
            {/* Background Orbs (Consistent with Dashboard/Events) */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-3xl font-black text-meteorite-950">
                        Gestión de Usuarios
                    </h2>

                    <nav>
                        <ol className="flex items-center gap-2 text-sm text-meteorite-600 font-medium">
                            <li>
                                <a className="hover:text-meteorite-800 transition-colors" href="/dashboard">
                                    Dashboard
                                </a>
                            </li>
                            <li>/</li>
                            <li className="text-meteorite-400">Usuarios</li>
                        </ol>
                    </nav>
                </div>

                {/* Filters */}
                <div className="mb-6">
                    <UserFilters />
                </div>

                {/* Data Table */}
                <UsersTable
                    users={usersResult.data.data}
                    areas={areasResult.data}
                    // Pass total count and pages if available in result data?
                    // result.data might be { data: User[], meta: { total: number, page: number, lastPage: number } }
                    // Assuming structure based on typical pagination. If not, we rely on basic prev/next.
                    pagination={usersResult.data.meta}
                />
            </div>
        </div>
    );
}
