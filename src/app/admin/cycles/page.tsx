import { authFresh } from "@/server/auth-fresh";
import { redirect } from "next/navigation";
import { getAllSemestersAction } from "@/server/actions/semester.actions";
import CyclesView from "@/components/admin/cycles/CyclesView";
import { hasPermission } from "@/lib/permissions";

export default async function CyclesPage() {
    const session = await authFresh();
    if (!session?.user) redirect("/login");

    const role = session.user.role;
    // Strict Access Control: Only President and Dev
    if (!hasPermission(role, "semester:manage")) {
        return redirect("/dashboard?error=AccessDenied");
    }

    const { data: semesters, success } = await getAllSemestersAction();

    if (!success || !semesters) {
        return (
            <div className="p-8 text-center text-red-500">
                Error al cargar los ciclos. Por favor recarga la página.
            </div>
        );
    }

    return <CyclesView semesters={semesters} />;
}
