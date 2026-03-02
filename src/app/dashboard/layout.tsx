import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { semesters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/permissions";

export default async function DashboardLayout({
    children
}: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    // Gate: PENDING_APPROVAL or VOLUNTEER users cannot access the dashboard
    if (session.user.status === "PENDING_APPROVAL" || session.user.role === "VOLUNTEER") {
        redirect("/pending-approval");
    }

    // Verificar semestre activo
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    if (!activeSemester) {
        // Verificar si hay semestres en general
        const anySemester = await db.query.semesters.findFirst();

        if (!anySemester) {
            // Primera vez: Cualquiera puede crear el primer ciclo
            redirect("/setup?first=true");
        }

        const role = session.user.role;
        const canManage = isAdmin(role);

        if (canManage) {
            redirect("/setup");
        }

        // Usuario sin permisos: mostrar mensaje de espera
        redirect("/no-cycle");
    }

    return <>{children}</>;
}
