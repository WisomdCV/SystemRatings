import { db } from "@/db";
import { events, semesters, users } from "@/db/schema";
import { CreateEventDTO } from "@/lib/validators/event";
import { eq } from "drizzle-orm";

export async function createEventDAO(
    userId: string,
    data: CreateEventDTO,
    googleData: { googleId: string, meetLink?: string | null }
) {
    // 1. Obtener Semestre Activo
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    if (!activeSemester) {
        throw new Error("No hay un semestre activo configurado.");
    }

    // 2. Insertar Evento
    return await db.insert(events).values({
        semesterId: activeSemester.id,
        createdById: userId,
        title: data.title,
        description: data.description,
        targetAreaId: data.targetAreaId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        isVirtual: data.isVirtual,
        googleEventId: googleData.googleId,
        meetLink: googleData.meetLink,
        status: "SCHEDULED"
    }).returning();
}

export async function getEventByIdDAO(eventId: string) {
    return await db.query.events.findFirst({
        where: eq(events.id, eventId),
        with: {
            targetArea: true, // Was 'area' (incorrect)
            createdBy: {      // Was 'creator' (incorrect)
                columns: {
                    name: true,
                    role: true,
                    email: true
                }
            }
        }
    });
}

export async function updateEventDAO(eventId: string, data: Partial<CreateEventDTO>) {
    return await db.update(events).set({
        title: data.title,
        description: data.description,
        targetAreaId: data.targetAreaId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        isVirtual: data.isVirtual,
        // No actualizamos googleEventId ni meetLink aquí usualmente, salvo que cambien externamente
        updatedAt: new Date()
    }).where(eq(events.id, eventId)).returning();
}

export async function deleteEventDAO(eventId: string) {
    return await db.delete(events).where(eq(events.id, eventId)).returning();
}
