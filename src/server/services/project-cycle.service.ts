import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectCycles, semesters } from "@/db/schema";
import type { CycleStatus } from "@/lib/constants";

export type ProjectCycleFilter = "active" | "history" | "all";

const ACTIVE_CYCLE: CycleStatus = "ACTIVE";

export function normalizeProjectCycleFilter(value?: string | null): ProjectCycleFilter {
    if (value === "history" || value === "all") return value;
    return "active";
}

export async function getActiveSemester() {
    return db.query.semesters.findFirst({
        where: eq(semesters.isActive, true),
    });
}

export async function getProjectActiveCycle(projectId: string) {
    return db.query.projectCycles.findFirst({
        where: and(
            eq(projectCycles.projectId, projectId),
            eq(projectCycles.status, ACTIVE_CYCLE),
        ),
        orderBy: (cycles, { desc }) => [desc(cycles.startedAt)],
    });
}

export async function getProjectCycleInSemester(projectId: string, semesterId: string) {
    return db.query.projectCycles.findFirst({
        where: and(
            eq(projectCycles.projectId, projectId),
            eq(projectCycles.semesterId, semesterId),
        ),
    });
}

export async function isProjectWritable(projectId: string): Promise<boolean> {
    const activeCycle = await getProjectActiveCycle(projectId);
    return !!activeCycle;
}

export async function assertProjectWritable(projectId: string, errorMessage = "Este proyecto está en modo solo lectura para este ciclo.") {
    const writable = await isProjectWritable(projectId);
    if (!writable) {
        throw new Error(errorMessage);
    }
}
