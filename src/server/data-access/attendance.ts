import { db } from "@/db";
import { attendanceRecords, events, users, projectMembers, eventInvitees } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

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
    // 1. Get Event to know scope, targetAreaId, projectId
    const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
            id: true,
            targetAreaId: true,
            eventScope: true,
            eventType: true,
            projectId: true,
            targetProjectAreaId: true,
        },
    });

    if (!event) throw new Error("Evento no encontrado");

    // 2. Search Eligible Users
    // If targetAreaId is NULL -> General -> All ACTIVE users
    // If targetAreaId is SET -> Area -> Active users of that area

    let eligibleUsers: {
        id: string;
        name: string | null;
        image: string | null;
        email: string;
        currentAreaId: string | null;
    }[];

    // ── Branch 4: PROJECT scope ──────────────────────────────────────
    if (event.eventScope === "PROJECT" && event.projectId) {
        if (event.eventType === "TREASURY_SPECIAL") {
            // Treasury-special meetings track attendance only for explicit invitees.
            const invitees = await db.query.eventInvitees.findMany({
                where: eq(eventInvitees.eventId, eventId),
                with: {
                    user: {
                        columns: { id: true, name: true, image: true, email: true, currentAreaId: true }
                    }
                }
            });

            eligibleUsers = invitees.map((invitee) => invitee.user);
        } else {
            const members = await db.query.projectMembers.findMany({
                where: eq(projectMembers.projectId, event.projectId),
                with: {
                    user: {
                        columns: { id: true, name: true, image: true, email: true, currentAreaId: true }
                    }
                }
            });

            if (event.targetProjectAreaId) {
                // Area-specific project event → only members of that project area
                eligibleUsers = members
                    .filter(m => m.projectAreaId === event.targetProjectAreaId)
                    .map(m => m.user);
            } else {
                // General project event → all project members
                eligibleUsers = members.map(m => m.user);
            }
        }
    }
    // ── Branch 1-3: IISE scope ───────────────────────────────────────
    else if (!event.targetAreaId) {
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

    // Sort eligible users by name for consistent display across all scopes
    eligibleUsers.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

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
                // Update status and reset justification fields when status changes
                // (prevents orphaned justifications from a previous status)
                await tx.update(attendanceRecords)
                    .set({
                        status: rec.status,
                        justificationStatus: "NONE",
                        justificationReason: null,
                        justificationLink: null,
                        justificationNote: null,
                        adminFeedback: null,
                        reviewedById: null,
                    })
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
    // Fetch records with event details, then sort by event date descending in JS.
    // Drizzle relational queries can't ORDER BY a joined column, and data volume
    // per user is low (~20 events/semester), so JS sort is perfectly fine here.
    const records = await db.query.attendanceRecords.findMany({
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
    });

    // Centralized sort: newest events first — callers no longer need to re-sort
    records.sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());

    return records;
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
