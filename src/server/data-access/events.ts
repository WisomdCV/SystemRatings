import { db } from "@/db";
import { events, semesters, eventInvitees, projectCycles } from "@/db/schema";
import { CreateEventDTO } from "@/lib/validators/event";
import type { EventInviteeStatus, EventScope, EventType, EventStatus, CycleStatus } from "@/lib/constants";
import { eq, and, desc } from "drizzle-orm";

function buildInviteeRows(
    eventId: string,
    inviteeUserIds: string[] | undefined,
    creatorUserId: string | null | undefined,
) {
    const statusByUserId = new Map<string, EventInviteeStatus>();

    for (const uid of inviteeUserIds ?? []) {
        if (!uid) continue;
        statusByUserId.set(uid, ("PENDING" satisfies EventInviteeStatus));
    }

    // Creator is always present and automatically accepted.
    if (creatorUserId) {
        statusByUserId.set(creatorUserId, ("ACCEPTED" satisfies EventInviteeStatus));
    }

    return Array.from(statusByUserId.entries()).map(([uid, status]) => ({
        eventId,
        userId: uid,
        status,
    }));
}

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
        let projectCycleId: string | null = null;
        if (data.projectId) {
            const activeProjectCycle = await tx.query.projectCycles.findFirst({
                where: and(
                    eq(projectCycles.projectId, data.projectId),
                    eq(projectCycles.status, ("ACTIVE" satisfies CycleStatus)),
                ),
                orderBy: [desc(projectCycles.startedAt)],
            });

            if (!activeProjectCycle) {
                throw new Error("Este proyecto está en modo solo lectura para este ciclo.");
            }

            projectCycleId = activeProjectCycle.id;
        }

        const [newEvent] = await tx.insert(events).values({
            semesterId: activeSemester.id,
            createdById: userId,
            title: data.title,
            description: data.description,

            // Events v2 fields
            eventScope: data.eventScope || ("IISE" satisfies EventScope),
            eventType: data.eventType || ("GENERAL" satisfies EventType),
            tracksAttendance,

            // IISE target
            targetAreaId: data.targetAreaId,

            // PROJECT target
            projectId: data.projectId,
            projectCycleId,
            targetProjectAreaId: data.targetProjectAreaId,

            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            isVirtual: data.isVirtual,
            googleEventId: googleData.googleId,
            meetLink: googleData.meetLink,
            status: ("SCHEDULED" satisfies EventStatus)
        }).returning();

        // 3. Insert Invitees for invitee-based event types
        const isInviteeBasedEvent = data.eventType === ("INDIVIDUAL_GROUP" satisfies EventType) || data.eventType === ("TREASURY_SPECIAL" satisfies EventType);
        if (isInviteeBasedEvent) {
            const inviteeRows = buildInviteeRows(newEvent.id, data.inviteeUserIds, userId);
            if (inviteeRows.length > 0) {
                await tx.insert(eventInvitees).values(inviteeRows);
            }
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
        let nextProjectCycleId: string | null | undefined = undefined;
        if (data.projectId !== undefined) {
            if (!data.projectId) {
                nextProjectCycleId = null;
            } else {
                const activeProjectCycle = await tx.query.projectCycles.findFirst({
                    where: and(
                        eq(projectCycles.projectId, data.projectId),
                        eq(projectCycles.status, ("ACTIVE" satisfies CycleStatus)),
                    ),
                    orderBy: [desc(projectCycles.startedAt)],
                });
                if (!activeProjectCycle) {
                    throw new Error("Este proyecto está en modo solo lectura para este ciclo.");
                }
                nextProjectCycleId = activeProjectCycle.id;
            }
        }

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
            projectCycleId: nextProjectCycleId,
            targetProjectAreaId: data.targetProjectAreaId,
            updatedAt: new Date()
        }).where(eq(events.id, eventId)).returning();

        // 2. Update invitees if provided (merge strategy: preserve existing statuses)
        if (data.inviteeUserIds !== undefined) {
            const isInviteeBasedEvent = data.eventType === ("INDIVIDUAL_GROUP" satisfies EventType) || data.eventType === ("TREASURY_SPECIAL" satisfies EventType);
            if (isInviteeBasedEvent) {
                const event = result[0];
                const newRows = buildInviteeRows(eventId, data.inviteeUserIds, event?.createdById);
                const newUserIds = new Set(newRows.map((r) => r.userId));

                // Fetch existing invitees to preserve their response status
                const existing = await tx.query.eventInvitees.findMany({
                    where: eq(eventInvitees.eventId, eventId),
                    columns: { id: true, userId: true, status: true },
                });
                const existingMap = new Map(existing.map((e) => [e.userId, e]));

                // Remove invitees no longer in the list
                const toRemove = existing.filter((e) => !newUserIds.has(e.userId));
                for (const inv of toRemove) {
                    await tx.delete(eventInvitees).where(eq(eventInvitees.id, inv.id));
                }

                // Add new invitees that weren't previously invited
                const toAdd = newRows.filter((r) => !existingMap.has(r.userId));
                if (toAdd.length > 0) {
                    await tx.insert(eventInvitees).values(toAdd);
                }
                // Existing invitees that remain keep their current status (ACCEPTED, PENDING, etc.)
            } else {
                // Non-invitee event type: clear all invitees
                await tx.delete(eventInvitees).where(eq(eventInvitees.eventId, eventId));
            }
        }

        return result;
    });
}

export async function deleteEventDAO(eventId: string) {
    return await db.delete(events).where(eq(events.id, eventId)).returning();
}
