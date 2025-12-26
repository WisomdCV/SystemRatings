"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { gradeDefinitions, semesters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { UpsertPillarSchema } from "@/lib/validators/pillar"; // Assume this path exists or check file structure if unsure
import { z } from "zod";

// --- Types ---
export interface PillarInput {
    id?: string;
    semesterId: string;
    name: string;
    weight: number;
    directorWeight?: number | null;
    maxScore: number;
    isDirectorOnly: boolean;
}

// --- Validation Helpers ---
async function validateTotalWeights(semesterId: string, currentPillar: PillarInput) {
    // 1. Fetch ALL other pillars for this semester
    const others = await db.query.gradeDefinitions.findMany({
        where: and(
            eq(gradeDefinitions.semesterId, semesterId)
        )
    });

    // Filter out the one being edited (if it exists)
    const existingOthers = others.filter(p => p.id !== currentPillar.id);

    // 2. Calculate Sums
    let sumMember = 0;
    let sumDirector = 0;

    // Add others
    for (const p of existingOthers) {
        if (!p.isDirectorOnly) sumMember += p.weight;

        // Director sum: if directorWeight exists use it, else use weight
        const wDirector = p.directorWeight !== null ? p.directorWeight : p.weight;
        sumDirector += wDirector; // Directors have all pillars basically? 
        // Wait, Director has "IsDirectorOnly" pillars too (Liderazgo).
        // Members skip "IsDirectorOnly".
    }

    // Add Current
    if (!currentPillar.isDirectorOnly) sumMember += currentPillar.weight;

    // Director Sum for Current
    const currentDirectW = (currentPillar.directorWeight !== null && currentPillar.directorWeight !== undefined)
        ? currentPillar.directorWeight
        : currentPillar.weight;

    sumDirector += currentDirectW;

    // 3. Check (Allow some float tolerance? better be strict or use Math.round)
    // We want close to 100. Let's say tolerance 0.1
    const isValidMember = sumMember <= 100.1;
    const isValidDirector = sumDirector <= 100.1;

    // We don't block if LESS than 100 (work in progress), but we block OVER 100.
    if (sumMember > 100.01) throw new Error(`La suma de pesos para MIEMBROS excede el 100% (Actual: ${sumMember.toFixed(2)}%)`);
    if (sumDirector > 100.01) throw new Error(`La suma de pesos para DIRECTORES excede el 100% (Actual: ${sumDirector.toFixed(2)}%)`);

    return true;
}

// --- Actions ---

export async function getPillarsBySemesterAction(semesterId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const pillars = await db.query.gradeDefinitions.findMany({
            where: eq(gradeDefinitions.semesterId, semesterId),
        });

        return { success: true, data: pillars };
    } catch (error) {
        console.error("Error getting pillars:", error);
        return { success: false, error: "Error al cargar pilares" };
    }
}

export async function upsertPillarAction(data: z.infer<typeof UpsertPillarSchema>) {
    const session = await auth();
    if (!session?.user || !["DEV", "PRESIDENT"].includes(session.user.role || "")) {
        return { success: false, message: "No autorizado" };
    }

    try {
        // Validate Total Weights
        const existingPillars = await db.query.gradeDefinitions.findMany({
            where: eq(gradeDefinitions.semesterId, data.semesterId)
        });

        const otherPillars = existingPillars.filter(p => p.id !== data.id);

        // Calculate Member Sum
        const memberSum = otherPillars
            .filter(p => !p.isDirectorOnly)
            .reduce((sum, p) => sum + p.weight, 0) + (data.isDirectorOnly ? 0 : data.weight);

        // Calculate Director Sum (uses directorWeight override OR standard weight)
        const directorSum = otherPillars.reduce((sum, p) => {
            const w = (p.directorWeight !== null) ? p.directorWeight : p.weight;
            return sum + w;
        }, 0) + ((data.directorWeight !== null && data.directorWeight !== undefined) ? data.directorWeight : data.weight);

        if (memberSum > 100.1) {
            return { success: false, message: `El peso total para MIEMBROS excedería el 100% (Actual: ${memberSum.toFixed(1)}%)` };
        }
        if (directorSum > 100.1) {
            return { success: false, message: `El peso total para DIRECTORES excedería el 100% (Actual: ${directorSum.toFixed(1)}%)` };
        }

        if (data.id) {
            await db.update(gradeDefinitions)
                .set({
                    name: data.name,
                    weight: data.weight,
                    directorWeight: data.directorWeight,
                    maxScore: data.maxScore,
                    isDirectorOnly: data.isDirectorOnly
                })
                .where(eq(gradeDefinitions.id, data.id));
        } else {
            await db.insert(gradeDefinitions).values({
                semesterId: data.semesterId,
                name: data.name,
                weight: data.weight,
                directorWeight: data.directorWeight,
                maxScore: data.maxScore,
                isDirectorOnly: data.isDirectorOnly
            });
        }

        revalidatePath(`/admin/cycles/${data.semesterId}/pillars`);
        return { success: true, message: "Pilar guardado correctamente" };
    } catch (error) {
        console.error("Error upserting pillar:", error);
        return { success: false, message: "Error al guardar el pilar" };
    }
}

export async function deletePillarAction(id: string, semesterId: string) {
    try {
        const session = await auth();
        if (!session?.user || !["DEV", "PRESIDENT"].includes(session.user.role || "")) {
            return { success: false, error: "No autorizado" };
        }

        await db.delete(gradeDefinitions).where(eq(gradeDefinitions.id, id));
        revalidatePath(`/admin/cycles/${semesterId}`);
        return { success: true, message: "Pilar eliminado." };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function clonePillarsAction(sourceSemesterId: string, targetSemesterId: string) {
    try {
        const session = await auth();
        if (!session?.user || !["DEV", "PRESIDENT"].includes(session.user.role || "")) {
            return { success: false, error: "No autorizado" };
        }

        // 1. Get Source Pillars
        const sourcePillars = await db.query.gradeDefinitions.findMany({
            where: eq(gradeDefinitions.semesterId, sourceSemesterId)
        });

        if (sourcePillars.length === 0) {
            return { success: false, error: "El ciclo origen no tiene pilares." };
        }

        // 2. Check overlap (Target should ideally be empty to avoid duplicates, or we delete existing?)
        // Safer to Delete Exisiting in Target (Clean Slate Clone)
        await db.delete(gradeDefinitions).where(eq(gradeDefinitions.semesterId, targetSemesterId));

        // 3. Insert Clones
        const clones = sourcePillars.map(p => ({
            semesterId: targetSemesterId,
            name: p.name,
            weight: p.weight,
            directorWeight: p.directorWeight,
            maxScore: p.maxScore,
            isDirectorOnly: p.isDirectorOnly
        }));

        await db.insert(gradeDefinitions).values(clones);

        revalidatePath(`/admin/cycles/${targetSemesterId}`);
        return { success: true, message: `Se clonaron ${clones.length} pilares exitosamente.` };

    } catch (error: any) {
        console.error("Clone Error:", error);
        return { success: false, error: error.message };
    }
}
