"use server";

import { auth } from "@/server/auth";
import { getAttendanceSheetDAO, batchUpsertAttendanceDAO } from "@/server/data-access/attendance";
import { getEventByIdDAO } from "@/server/data-access/events";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { canTakeAttendance, canManageEvent } from "@/server/services/event-permissions.service";
import { getUserAttendanceHistoryDAO, updateAttendanceRecordDAO, getAttendanceRecordByIdDAO } from "@/server/data-access/attendance";
import type { AttendanceStatus, JustificationStatus } from "@/lib/constants";
import { ATTENDANCE_WINDOW_DAYS } from "@/lib/constants";

// =============================================================================
// Helpers
// =============================================================================

/** Builds the event context object consumed by canTakeAttendance / canManageEvent */
function eventCtx(event: {
    createdById: string | null;
    eventScope: string;
    eventType: string;
    targetAreaId: string | null;
    projectId: string | null;
    targetProjectAreaId: string | null;
}) {
    return {
        createdById: event.createdById,
        eventScope: event.eventScope,
        eventType: event.eventType,
        targetAreaId: event.targetAreaId,
        projectId: event.projectId,
        targetProjectAreaId: event.targetProjectAreaId,
    };
}

/** Builds the user context object consumed by canTakeAttendance / canManageEvent */
function userCtx(session: {
    user: { id: string; role: string | null; currentAreaId: string | null; customPermissions?: string[] };
}) {
    return {
        userRole: session.user.role,
        userId: session.user.id,
        userAreaId: session.user.currentAreaId,
        customPermissions: session.user.customPermissions,
    };
}

/**
 * Can this user review justifications for this event?
 * Uses the same base logic as canTakeAttendance but checks `attendance:review_*` permissions.
 */
async function canReviewJustificationForEvent(
    ctx: { userRole: string | null; userId: string; userAreaId: string | null; customPermissions?: string[] },
    event: { createdById: string | null; eventScope: string; eventType: string; targetAreaId: string | null; projectId: string | null; targetProjectAreaId: string | null },
): Promise<boolean> {
    // review_all → can review justifications for any event
    if (hasPermission(ctx.userRole, "attendance:review_all", ctx.customPermissions)) return true;

    // review_own_area → same logic as attendance:take_own_area (area match + manage)
    if (hasPermission(ctx.userRole, "attendance:review_own_area", ctx.customPermissions)) {
        return canTakeAttendance(ctx, event);
    }

    return false;
}

/**
 * Validates that an event is within the allowed attendance window.
 * - Cannot take attendance for future events (event must have started).
 * - Cannot modify attendance after ATTENDANCE_WINDOW_DAYS days.
 */
function validateAttendanceWindow(eventDate: Date | string): { ok: boolean; error?: string } {
    const now = new Date();
    const evDate = new Date(eventDate);

    // Cannot take attendance for future events
    const eventDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (eventDay > today) {
        return { ok: false, error: "No se puede registrar asistencia para eventos futuros." };
    }

    // Cannot modify attendance after window expires
    const diffMs = today.getTime() - eventDay.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > ATTENDANCE_WINDOW_DAYS) {
        return { ok: false, error: `No se puede modificar la asistencia después de ${ATTENDANCE_WINDOW_DAYS} días del evento.` };
    }

    return { ok: true };
}

// =============================================================================
// Actions
// =============================================================================

export async function getAttendanceSheetAction(eventId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        if (event.tracksAttendance === false) {
            return { success: false, error: "Este evento no tiene seguimiento de asistencia." };
        }

        const canTake = await canTakeAttendance(userCtx(session), eventCtx(event));

        if (!canTake) {
            return { success: false, error: "No tienes permisos para ver la asistencia de este evento." };
        }

        // Time window: read-only view is always allowed, but we include the flag
        const windowCheck = validateAttendanceWindow(event.date);

        const sheet = await getAttendanceSheetDAO(eventId);
        return { success: true, data: sheet, editable: windowCheck.ok };

    } catch (error) {
        console.error("Error fetching attendance sheet:", error);
        return { success: false, error: "Error al cargar la hoja de asistencia" };
    }
}

export async function saveAttendanceAction(eventId: string, records: { userId: string, status: AttendanceStatus }[]) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        if (event.tracksAttendance === false) {
            return { success: false, error: "Este evento no tiene seguimiento de asistencia." };
        }

        const canTake = await canTakeAttendance(userCtx(session), eventCtx(event));

        if (!canTake) {
            return { success: false, error: "No tienes permisos para registrar asistencia en este evento." };
        }

        // Time window validation: block writes outside the allowed window
        const windowCheck = validateAttendanceWindow(event.date);
        if (!windowCheck.ok) {
            return { success: false, error: windowCheck.error! };
        }

        await batchUpsertAttendanceDAO(eventId, records);

        revalidatePath(`/admin/events/${eventId}/attendance`);
        revalidatePath(`/dashboard/attendance/${eventId}`);

        return { success: true, message: "Asistencia guardada correctamente" };

    } catch (error) {
        console.error("Error saving attendance:", error);
        return { success: false, error: "Error al guardar la asistencia" };
    }
}

export async function getMyAttendanceHistoryAction() {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const history = await getUserAttendanceHistoryDAO(session.user.id);
        // Already sorted by event date descending in DAO
        return { success: true, data: history };
    } catch (error) {
        console.error("Error fetching history:", error);
        return { success: false, error: "Error al obtener historial" };
    }
}

export async function submitJustificationAction(recordId: string, reason: string, link?: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const record = await getAttendanceRecordByIdDAO(recordId);
        if (!record) return { success: false, error: "Registro no encontrado" };

        if (record.userId !== session.user.id) {
            return { success: false, error: "No puedes justificar la asistencia de otro usuario" };
        }

        // Only ABSENT or LATE records can be justified
        if (record.status === ("PRESENT" satisfies AttendanceStatus) || record.status === ("EXCUSED" satisfies AttendanceStatus)) {
            return { success: false, error: "Solo se pueden justificar faltas o tardanzas." };
        }

        if (record.justificationStatus === ("APPROVED" satisfies JustificationStatus)) {
            return { success: false, error: "Esta falta ya ha sido justificada y aprobada." };
        }

        await updateAttendanceRecordDAO(recordId, {
            justificationStatus: "PENDING" satisfies JustificationStatus,
            justificationReason: reason,
            justificationLink: link || null
        });

        revalidatePath("/dashboard/attendance");
        return { success: true, message: "Justificación enviada correctamente" };

    } catch (error) {
        console.error("Error submitting justification:", error);
        return { success: false, error: "Error al enviar justificación" };
    }
}

export async function reviewJustificationAction(
    recordId: string,
    verdict: "APPROVED" | "REJECTED",
    feedback?: string
) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const record = await getAttendanceRecordByIdDAO(recordId);
        if (!record) return { success: false, error: "Registro no encontrado" };

        const canReview = await canReviewJustificationForEvent(
            userCtx(session),
            {
                createdById: record.event?.createdById ?? null,
                eventScope: record.event?.eventScope ?? "IISE",
                eventType: record.event?.eventType ?? "GENERAL",
                targetAreaId: record.event?.targetAreaId ?? null,
                projectId: record.event?.projectId ?? null,
                targetProjectAreaId: record.event?.targetProjectAreaId ?? null,
            },
        );

        if (!canReview) {
            return { success: false, error: "No tienes permisos para revisar justificaciones de este evento." };
        }

        const updates: any = {
            justificationStatus: verdict,
            adminFeedback: feedback || null,
            reviewedById: session.user.id
        };

        if (verdict === ("APPROVED" satisfies JustificationStatus)) {
            updates.status = "EXCUSED" satisfies AttendanceStatus;
        } else {
            updates.status = "ABSENT" satisfies AttendanceStatus;
        }

        await updateAttendanceRecordDAO(recordId, updates);

        revalidatePath("/admin/events");
        revalidatePath(`/admin/events/${record.eventId}/attendance`);

        return { success: true, message: `Justificación ${verdict === ("APPROVED" satisfies JustificationStatus) ? "Aprobada" : "Rechazada"}` };

    } catch (error) {
        console.error("Error reviewing justification:", error);
        return { success: false, error: "Error al revisar justificación" };
    }
}

/**
 * Returns attendance records relevant to the user's justification dashboard:
 * - `actionable`: ABSENT/LATE with no justification yet or rejected (user can re-submit)
 * - `resolved`: EXCUSED with approved justification (informational, no action needed)
 *
 * @deprecated alias `getPendingJustificationsAction` kept for backward compatibility
 */
export async function getMyJustificationsAction() {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const history = await getUserAttendanceHistoryDAO(session.user.id);

        // Records where the user CAN submit/re-submit a justification
        const actionable = history.filter(record =>
            (record.status === ("ABSENT" satisfies AttendanceStatus) || record.status === ("LATE" satisfies AttendanceStatus)) &&
            (record.justificationStatus === ("NONE" satisfies JustificationStatus) || record.justificationStatus === ("REJECTED" satisfies JustificationStatus))
        );

        // Records already resolved (approved) — shown as informational
        const resolved = history.filter(record =>
            record.status === ("EXCUSED" satisfies AttendanceStatus) && record.justificationStatus === ("APPROVED" satisfies JustificationStatus)
        );

        const combined = [...actionable, ...resolved];
        combined.sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());

        return { success: true, data: combined };
    } catch (error) {
        console.error("Error fetching justifications:", error);
        return { success: false, error: "Error al obtener justificaciones" };
    }
}

/** @deprecated Use `getMyJustificationsAction` instead */
export const getPendingJustificationsAction = getMyJustificationsAction;

export async function acknowledgeRejectionAction(recordId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const record = await getAttendanceRecordByIdDAO(recordId);
        if (!record) return { success: false, error: "Registro no encontrado" };

        if (record.userId !== session.user.id) {
            return { success: false, error: "No autorizado" };
        }

        // Only REJECTED justifications can be acknowledged
        if (record.justificationStatus !== ("REJECTED" satisfies JustificationStatus)) {
            return { success: false, error: "Solo se pueden reconocer justificaciones rechazadas." };
        }

        await updateAttendanceRecordDAO(recordId, {
            justificationStatus: "ACKNOWLEDGED" satisfies JustificationStatus
        });

        revalidatePath("/dashboard");
        return { success: true, message: "Notificación descartada" };
    } catch (error) {
        console.error("Error acknowledging rejection:", error);
        return { success: false, error: "Error al descartar notificación" };
    }
}
