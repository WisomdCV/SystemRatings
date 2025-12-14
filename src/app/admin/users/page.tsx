import UsersTable from "@/components/admin/UsersTable";
import { getAreasAction } from "@/server/actions/organization.actions";
import { getUsersAction } from "@/server/actions/user.actions";

export default async function AdminUsersPage() {
    const [usersResult, areasResult] = await Promise.all([
        getUsersAction(),
        getAreasAction(),
    ]);

    if (!usersResult.success || !areasResult.success) {
        return (
            <div className="p-10 text-center text-red-500">
                Error al cargar datos. {(usersResult as any).error} {(areasResult as any).error}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-title-md2 font-semibold text-black dark:text-white">
                    Gestión de Usuarios
                </h2>

                <nav>
                    <ol className="flex items-center gap-2">
                        <li>
                            <a className="font-medium" href="/dashboard">
                                Dashboard /
                            </a>
                        </li>
                        <li className="font-medium text-primary">Usuarios</li>
                    </ol>
                </nav>
            </div>

            <UsersTable users={usersResult.data} areas={areasResult.data} />
        </div>
    );
}
