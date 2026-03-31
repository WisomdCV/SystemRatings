import "dotenv/config";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { events, projectCycles, projects } from "@/db/schema";

const APPLY = process.argv.includes("--apply");

type CycleStatus = "ACTIVE" | "ARCHIVED";

function mapProjectStatusToCycleStatus(projectStatus: string): CycleStatus {
    if (projectStatus === "COMPLETED" || projectStatus === "CANCELLED") {
        return "ARCHIVED";
    }
    return "ACTIVE";
}

async function main() {
    console.log("\n🔧 FASE 8 - Backfill project_cycles y events.project_cycle_id");
    console.log(`Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);

    const allProjects = await db.query.projects.findMany({
        columns: {
            id: true,
            semesterId: true,
            status: true,
            createdAt: true,
        },
    });

    const existingCycles = await db.query.projectCycles.findMany({
        columns: {
            id: true,
            projectId: true,
            semesterId: true,
            status: true,
            startedAt: true,
        },
    });

    const cycleByProjectSemester = new Map(
        existingCycles.map((cycle) => [`${cycle.projectId}:${cycle.semesterId}`, cycle]),
    );

    const cyclesToInsert: {
        projectId: string;
        semesterId: string;
        status: CycleStatus;
        startedAt: Date | null;
    }[] = [];

    for (const project of allProjects) {
        const key = `${project.id}:${project.semesterId}`;
        if (cycleByProjectSemester.has(key)) continue;

        cyclesToInsert.push({
            projectId: project.id,
            semesterId: project.semesterId,
            status: mapProjectStatusToCycleStatus(project.status),
            startedAt: project.createdAt,
        });
    }

    const projectEventsWithoutCycle = await db.query.events.findMany({
        where: and(
            isNotNull(events.projectId),
            isNull(events.projectCycleId),
        ),
        columns: {
            id: true,
            projectId: true,
            semesterId: true,
        },
    });

    type EventBackfill = { eventId: string; projectCycleId: string };
    const eventUpdates: EventBackfill[] = [];

    const cycleCandidatesByProject = new Map<string, typeof existingCycles>();
    for (const cycle of existingCycles) {
        const list = cycleCandidatesByProject.get(cycle.projectId) ?? [];
        list.push(cycle);
        cycleCandidatesByProject.set(cycle.projectId, list);
    }

    for (const pendingCycle of cyclesToInsert) {
        const virtualCycle = {
            id: `__PENDING__:${pendingCycle.projectId}:${pendingCycle.semesterId}`,
            projectId: pendingCycle.projectId,
            semesterId: pendingCycle.semesterId,
            status: pendingCycle.status,
            startedAt: pendingCycle.startedAt,
        };
        const list = cycleCandidatesByProject.get(pendingCycle.projectId) ?? [];
        list.push(virtualCycle as any);
        cycleCandidatesByProject.set(pendingCycle.projectId, list);
    }

    for (const event of projectEventsWithoutCycle) {
        if (!event.projectId) continue;

        const exactKey = `${event.projectId}:${event.semesterId}`;
        const exactCycle = cycleByProjectSemester.get(exactKey)
            ?? cyclesToInsert.find((cycle) => cycle.projectId === event.projectId && cycle.semesterId === event.semesterId);

        if (exactCycle) {
            const cycleId = "id" in exactCycle
                ? exactCycle.id
                : `__PENDING__:${exactCycle.projectId}:${exactCycle.semesterId}`;
            eventUpdates.push({ eventId: event.id, projectCycleId: cycleId });
            continue;
        }

        const candidates = cycleCandidatesByProject.get(event.projectId) ?? [];
        const activeCandidate = candidates.find((cycle) => cycle.status === "ACTIVE");
        if (activeCandidate) {
            eventUpdates.push({ eventId: event.id, projectCycleId: activeCandidate.id });
        }
    }

    const pendingEventUpdates = eventUpdates.filter((item) => item.projectCycleId.startsWith("__PENDING__:"));

    console.log("\n📌 Cambios planificados:");
    console.log(`   + project_cycle inserts: ${cyclesToInsert.length}`);
    console.log(`   ~ event projectCycleId updates: ${eventUpdates.length}`);

    if (!APPLY) {
        if (pendingEventUpdates.length > 0) {
            console.log(`   ℹ️  ${pendingEventUpdates.length} eventos dependerán de ciclos creados en esta misma migración.`);
        }
        console.log("\nℹ️  DRY-RUN completado. Ejecuta con --apply para aplicar cambios.");
        return;
    }

    await db.transaction(async (tx) => {
        if (cyclesToInsert.length > 0) {
            await tx.insert(projectCycles).values(
                cyclesToInsert.map((cycle) => ({
                    projectId: cycle.projectId,
                    semesterId: cycle.semesterId,
                    status: cycle.status,
                    startedAt: cycle.startedAt,
                })),
            );
        }

        const refreshedCycles = await tx.query.projectCycles.findMany({
            columns: { id: true, projectId: true, semesterId: true },
        });
        const refreshedByKey = new Map(refreshedCycles.map((cycle) => [`${cycle.projectId}:${cycle.semesterId}`, cycle.id]));

        for (const update of eventUpdates) {
            let targetCycleId = update.projectCycleId;
            if (targetCycleId.startsWith("__PENDING__:")) {
                const [, projectId, semesterId] = targetCycleId.split(":");
                const resolved = refreshedByKey.get(`${projectId}:${semesterId}`);
                if (!resolved) continue;
                targetCycleId = resolved;
            }

            await tx.update(events)
                .set({ projectCycleId: targetCycleId })
                .where(and(
                    eq(events.id, update.eventId),
                    isNull(events.projectCycleId),
                ));
        }
    });

    console.log("\n✅ Migración aplicada correctamente.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error en migración:", error);
        process.exit(1);
    });
