import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getAllSemestersAction } from "@/server/actions/semester.actions";
import CyclesView from "@/components/admin/cycles/CyclesView";

export default async function CyclesPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role;
    // Strict Access Control: Only President and Dev
    if (!["PRESIDENT", "DEV"].includes(role || "")) {
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
