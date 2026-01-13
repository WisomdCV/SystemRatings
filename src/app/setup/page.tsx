import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { semesters } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import SetupView from "@/components/setup/SetupView";

interface Props {
    searchParams: Promise<{ first?: string }>;
}

export default async function SetupPage({ searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const params = await searchParams;
    const isFirstTime = params.first === "true";
    const role = session.user.role;
    const canManage = ["PRESIDENT", "DEV"].includes(role || "") || isFirstTime;

    // Si hay semestre activo, no debería estar aquí
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });
    if (activeSemester) redirect("/dashboard");

    // Si no puede gestionar y no es primera vez, redirigir
    if (!canManage) redirect("/no-cycle");

    const rawSemesters = await db.query.semesters.findMany({
        orderBy: [desc(semesters.startDate)]
    });

    // Transform to expected type (handle null dates)
    const allSemesters = rawSemesters.map(s => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate || new Date(),
        endDate: s.endDate,
        isActive: s.isActive || false
    }));

    return (
        <SetupView
            semesters={allSemesters}
            isFirstTime={isFirstTime}
            userName={session.user.name || "Usuario"}
        />
    );
}
