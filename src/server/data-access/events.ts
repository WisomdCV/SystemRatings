import { db } from "@/db";
import { events, semesters, eventInvitees } from "@/db/schema";
import { CreateEventDTO } from "@/lib/validators/event";
import { eq } from "drizzle-orm";

export async function createEventDAO(
    userId: string,
    data: CreateEventDTO,
    googleData: { googleId: string, meetLink?: string | null },
    tracksAttendance: boolean
) {
    // 1. Obtener Semestre Activo
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    if (!activeSemester) {
        throw new Error("No hay un semestre activo configurado.");
    }

    // 2. Insertar Evento
    const [newEvent] = await db.insert(events).values({
        semesterId: activeSemester.id,
        createdById: userId,
        title: data.title,
        description: data.description,

        // Events v2 fields
        eventScope: data.eventScope || "IISE",
        eventType: data.eventType || "GENERAL",
        tracksAttendance,

        // IISE target
        targetAreaId: data.targetAreaId,

        // PROJECT target
        projectId: data.projectId,
        targetProjectAreaId: data.targetProjectAreaId,

        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        isVirtual: data.isVirtual,
        googleEventId: googleData.googleId,
        meetLink: googleData.meetLink,
        status: "SCHEDULED"
    }).returning();

    // 3. Insert Invitees (for INDIVIDUAL_GROUP events)
    if (data.eventType === "INDIVIDUAL_GROUP" && data.inviteeUserIds && data.inviteeUserIds.length > 0) {
        const inviteeRows = data.inviteeUserIds.map(uid => ({
            eventId: newEvent.id,
            userId: uid,
            status: "PENDING",
        }));

        // Also add the creator as an invitee
        inviteeRows.push({
            eventId: newEvent.id,
            userId: userId,
            status: "ACCEPTED",
        });

        await db.insert(eventInvitees).values(inviteeRows);
    }

    return [newEvent];
}

export async function getEventByIdDAO(eventId: string) {
    return await db.query.events.findFirst({
        where: eq(events.id, eventId),
        with: {
            targetArea: true,
            project: true,
            targetProjectArea: true,
            createdBy: {
                columns: {
                    name: true,
                    role: true,
                    email: true
                }
            },
            invitees: {
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            image: true,
                            role: true,
                        }
                    }
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
        updatedAt: new Date()
    }).where(eq(events.id, eventId)).returning();
}

export async function deleteEventDAO(eventId: string) {
    return await db.delete(events).where(eq(events.id, eventId)).returning();
}
