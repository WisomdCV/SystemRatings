
import { auth } from "@/server/auth";
import { db } from "@/db";
import { gradeDefinitions, semesters } from "@/db/schema";
import { eq, ne, desc } from "drizzle-orm";
import { PillarsManager } from "@/components/admin/PillarsManager";
import { getPillarsBySemesterAction } from "@/server/actions/pillar.actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PillarsPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user || !["DEV", "PRESIDENT"].includes(session.user.role || "")) {
        return <div className="p-8 text-center text-red-600">No autorizado</div>;
    }

    const { id: semesterId } = params;

    // 1. Fetch Cycle Info
    const cycle = await db.query.semesters.findFirst({
        where: eq(semesters.id, semesterId)
    });

    if (!cycle) return <div className="p-8">Ciclo no encontrado</div>;

    // 2. Fetch Pillars (Server Action or Direct DB)
    const pillarsRes = await getPillarsBySemesterAction(semesterId);
    const pillars = pillarsRes.success ? (pillarsRes.data || []).map(p => ({
        id: p.id,
        semesterId: p.semesterId,
        name: p.name,
        weight: p.weight,
        directorWeight: p.directorWeight || null,
        maxScore: p.maxScore ?? 5, // Nullish coalescing for default
        isDirectorOnly: p.isDirectorOnly ?? false // Nullish coalescing for default
    })) : [];

    // 3. Fetch Other Semesters (For Clone Source)
    const others = await db.query.semesters.findMany({
        where: ne(semesters.id, semesterId),
        orderBy: [desc(semesters.startDate)],
        columns: { id: true, name: true }
    });

    return (
        <div className="min-h-screen bg-meteorite-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center gap-4">
                    <Link href="/admin/cycles" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Gestor de Pilares</h1>
                        <p className="text-xs text-gray-500">Configuración para: <span className="font-semibold text-meteorite-600">{cycle.name}</span></p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <PillarsManager
                    semesterId={semesterId}
                    initialPillars={pillars}
                    otherSemesters={others}
                />
            </div>
        </div>
    );
}
