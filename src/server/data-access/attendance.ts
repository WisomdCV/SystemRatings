import { db } from "@/db";
import { attendanceRecords, events, users } from "@/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceSheetItem {
    user: {
        id: string;
        name: string | null;
        image: string | null;
        email: string;
        currentAreaId: string | null;
    };
    record: {
        id: string;
        status: string; // 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'
        justificationStatus: string | null;
        justificationReason?: string | null;
        justificationLink?: string | null;
        adminFeedback?: string | null;
    } | null;
}

export async function getAttendanceSheetDAO(eventId: string): Promise<AttendanceSheetItem[]> {
    // 1. Get Event to know targetAreaId and Code
    const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
            id: true,
            targetAreaId: true,
            createdById: true,
        },
        with: {
            targetArea: {
                columns: { code: true }
            },
            createdBy: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                    email: true,
                    currentAreaId: true,
                    role: true
                }
            }
        }
    });

    if (!event) throw new Error("Evento no encontrado");

    // 2. Search Eligible Users
    // If targetAreaId is NULL -> General -> All ACTIVE users
    // If targetArea.code === 'MD' -> Board -> Director, Subdirector, Treasurer
    // If targetAreaId is SET -> Area -> Active users of that area

    let eligibleUsers: {
        id: string;
        name: string | null;
        image: string | null;
        email: string;
        currentAreaId: string | null;
    }[];

    if (!event.targetAreaId) {
        // Evento General
        eligibleUsers = await db.query.users.findMany({
            where: and(
                eq(users.status, "ACTIVE"),
                ne(users.role, "DEV")
            ),
            columns: {
                id: true,
                name: true,
                image: true,
                email: true,
                currentAreaId: true
            },
            orderBy: (users, { asc }) => [asc(users.name)]
        });
    } else if (event.targetArea?.code === "MD") {
        // Lógica Mesa Directiva: Presidenta toma lista a sus líderes
        // DEV is excluded implicitly by inArray check below, but explicit check implies intention if roles changed.
        // Actually, inArray(["DIRECTOR"...]) already excludes "DEV" unless DEV is added to that list. 
        // So no change needed here strictly, but let's be safe if logic changes later? 
        // No, strict list is safer.
        eligibleUsers = await db.query.users.findMany({
            where: and(
                eq(users.status, "ACTIVE"),
                inArray(users.role, ["DIRECTOR", "SUBDIRECTOR", "TREASURER"])
            ),
            columns: {
                id: true,
                name: true,
                image: true,
                email: true,
                currentAreaId: true
            },
            orderBy: (users, { asc }) => [asc(users.name)]
        });
    } else {
        // Evento Normal de Área
        eligibleUsers = await db.query.users.findMany({
            where: and(
                eq(users.status, "ACTIVE"),
                eq(users.currentAreaId, event.targetAreaId),
                ne(users.role, "DEV")
            ),
            columns: {
                id: true,
                name: true,
                image: true,
                email: true,
                currentAreaId: true
            },
            orderBy: (users, { asc }) => [asc(users.name)]
        });
    }

    // NEW LOGIC: Always include the Creator (if not DEV and not already in list)
    if (event.createdBy && event.createdBy.role !== "DEV") {
        const isAlreadyIncluded = eligibleUsers.some(u => u.id === event.createdBy?.id);
        if (!isAlreadyIncluded) {
            // Add creator to the list
            eligibleUsers.push({
                id: event.createdBy.id,
                name: event.createdBy.name,
                image: event.createdBy.image,
                email: event.createdBy.email,
                currentAreaId: event.createdBy.currentAreaId
            });
            // Re-sort strictly by name to maintain order? 
            // Optional, but nice.
            eligibleUsers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }
    }

    // 3. Get existing records for this event
    const existingRecords = await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.eventId, eventId),
        columns: {
            id: true,
            userId: true,
            status: true,
            justificationStatus: true,
            justificationReason: true,
            justificationLink: true,
            adminFeedback: true
        }
    });

    // 4. Map and Merge
    // Create a Map for faster lookup
    const recordsMap = new Map(existingRecords.map(r => [r.userId, r]));

    const sheet: AttendanceSheetItem[] = eligibleUsers.map(user => {
        const record = recordsMap.get(user.id);
        return {
            user: {
                id: user.id,
                name: user.name,
                image: user.image,
                email: user.email,
                currentAreaId: user.currentAreaId,
            },
            record: record ? {
                id: record.id,
                status: record.status,
                justificationStatus: record.justificationStatus,
                justificationReason: record.justificationReason,
                justificationLink: record.justificationLink,
                adminFeedback: record.adminFeedback
            } : null
        };
    });

    return sheet;
}

export async function batchUpsertAttendanceDAO(eventId: string, records: { userId: string, status: AttendanceStatus }[]) {
    return await db.transaction(async (tx) => {
        for (const rec of records) {
            // Check if exists
            const existing = await tx.query.attendanceRecords.findFirst({
                where: and(
                    eq(attendanceRecords.eventId, eventId),
                    eq(attendanceRecords.userId, rec.userId)
                ),
                columns: { id: true }
            });

            if (existing) {
                // Update
                await tx.update(attendanceRecords)
                    .set({ status: rec.status })
                    .where(eq(attendanceRecords.id, existing.id));
            } else {
                // Insert
                await tx.insert(attendanceRecords).values({
                    eventId: eventId,
                    userId: rec.userId,
                    status: rec.status,
                    justificationStatus: "NONE"
                });
            }
            // ... existing code ...
        }
    });
}

export async function getUserAttendanceHistoryDAO(userId: string) {
    // Fetch records with event details
    // We want records where user was ABSENT, LATE, or EXCUSED (or even PRESENT to show history)
    // Ordered by event date descending
    return await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.userId, userId),
        with: {
            event: {
                columns: {
                    id: true,
                    title: true,
                    date: true,
                    startTime: true,
                    endTime: true,
                    isVirtual: true
                },
                with: {
                    semester: {
                        columns: {
                            name: true
                        }
                    }
                }
            },
            reviewedBy: {
                columns: {
                    name: true
                }
            }
        },
        // orderBy: [desc(events.date)] // Cannot sort by joined table easily in query builder without raw sql or careful relations
        // We'll sort in JS or use records ID if they are chronological (they aren't)
        // Actually, Drizzle allows sorting by relation fields in findMany sometimes, but let's just fetch and sort in JS for safety or use simple ID sort if UUID (random).
        // Let's explicitly try to order by event date if possible using raw query style if builder fails. 
        // For simplicity: Fetch all, sort in JS. Data volume per user is low (~20 events/semester).
    });
}

export async function updateAttendanceRecordDAO(recordId: string, data: {
    justificationStatus?: string;
    justificationReason?: string | null;
    justificationLink?: string | null;
    status?: string;
    adminFeedback?: string | null;
    reviewedById?: string | null;
}) {
    // 1. Check if record exists
    const record = await db.query.attendanceRecords.findFirst({
        where: eq(attendanceRecords.id, recordId),
        columns: { userId: true }
    });

    if (!record) throw new Error("Registro de asistencia no encontrado");

    return await db.update(attendanceRecords)
        .set(data)
        .where(eq(attendanceRecords.id, recordId))
        .returning();
}

export async function getAttendanceRecordByIdDAO(recordId: string) {
    return await db.query.attendanceRecords.findFirst({
        where: eq(attendanceRecords.id, recordId),
        with: {
            event: true
        }
    });
}
