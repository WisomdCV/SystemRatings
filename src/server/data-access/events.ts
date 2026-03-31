import { db } from "@/db";
import { events, semesters, eventInvitees } from "@/db/schema";
import { CreateEventDTO } from "@/lib/validators/event";
import { eq, and } from "drizzle-orm";

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

    // 2. Insert Event + Invitees in a single transaction
    return await db.transaction(async (tx) => {
        const [newEvent] = await tx.insert(events).values({
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

        // 3. Insert Invitees for invitee-based event types
        const isInviteeBasedEvent = data.eventType === "INDIVIDUAL_GROUP" || data.eventType === "TREASURY_SPECIAL";
        if (isInviteeBasedEvent && data.inviteeUserIds && data.inviteeUserIds.length > 0) {
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

            await tx.insert(eventInvitees).values(inviteeRows);
        }

        return [newEvent];
    });
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
    return await db.transaction(async (tx) => {
        // 1. Update core event fields + v2 fields
        const result = await tx.update(events).set({
            title: data.title,
            description: data.description,
            targetAreaId: data.targetAreaId,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            isVirtual: data.isVirtual,
            // v2 fields
            eventScope: data.eventScope,
            eventType: data.eventType,
            projectId: data.projectId,
            targetProjectAreaId: data.targetProjectAreaId,
            updatedAt: new Date()
        }).where(eq(events.id, eventId)).returning();

        // 2. Update invitees if provided (replace strategy)
        if (data.inviteeUserIds !== undefined) {
            // Delete old invitees
            await tx.delete(eventInvitees).where(eq(eventInvitees.eventId, eventId));

            // Insert new invitees for invitee-based event types
            const isInviteeBasedEvent = data.eventType === "INDIVIDUAL_GROUP" || data.eventType === "TREASURY_SPECIAL";
            if (isInviteeBasedEvent && data.inviteeUserIds && data.inviteeUserIds.length > 0) {
                const inviteeRows = data.inviteeUserIds.map(uid => ({
                    eventId,
                    userId: uid,
                    status: "PENDING",
                }));

                // Re-add creator as invitee
                const event = result[0];
                if (event?.createdById) {
                    const creatorAlready = inviteeRows.some(r => r.userId === event.createdById);
                    if (!creatorAlready) {
                        inviteeRows.push({
                            eventId,
                            userId: event.createdById,
                            status: "ACCEPTED",
                        });
                    }
                }

                await tx.insert(eventInvitees).values(inviteeRows);
            }
        }

        return result;
    });
}

export async function deleteEventDAO(eventId: string) {
    return await db.delete(events).where(eq(events.id, eventId)).returning();
}
