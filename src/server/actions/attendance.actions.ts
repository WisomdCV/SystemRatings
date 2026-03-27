"use server";

import { auth } from "@/server/auth";
import { getAttendanceSheetDAO, batchUpsertAttendanceDAO, AttendanceStatus } from "@/server/data-access/attendance";
import { getEventByIdDAO } from "@/server/data-access/events";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { getUserAttendanceHistoryDAO, updateAttendanceRecordDAO, getAttendanceRecordByIdDAO } from "@/server/data-access/attendance";

// =============================================================================
// Helpers — attendance permission check (shared by get & save)
// =============================================================================

function canTakeAttendanceForEvent(
    role: string | null,
    userAreaId: string | null,
    customPermissions: string[] | undefined,
    eventTargetAreaId: string | null,
): boolean {
    // take_all → can take attendance on any event
    if (hasPermission(role, "attendance:take_all", customPermissions)) return true;

    // take_own_area → only events targeting user's area (or general events with no target)
    if (hasPermission(role, "attendance:take_own_area", customPermissions)) {
        if (!eventTargetAreaId) return true; // General event — anyone with take_own_area can contribute
        if (eventTargetAreaId === userAreaId) return true; // Same area
    }

    return false;
}

function canReviewJustificationForEvent(
    role: string | null,
    userAreaId: string | null,
    customPermissions: string[] | undefined,
    eventTargetAreaId: string | null,
): boolean {
    // review_all → can review justifications for any event
    if (hasPermission(role, "attendance:review_all", customPermissions)) return true;

    // review_own_area → only events targeting user's area
    if (hasPermission(role, "attendance:review_own_area", customPermissions)) {
        if (!eventTargetAreaId) return true;
        if (eventTargetAreaId === userAreaId) return true;
    }

    return false;
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

        const canTake = canTakeAttendanceForEvent(
            session.user.role,
            session.user.currentAreaId,
            session.user.customPermissions,
            event.targetAreaId,
        );

        if (!canTake) {
            return { success: false, error: "No tienes permisos para ver la asistencia de este evento." };
        }

        const sheet = await getAttendanceSheetDAO(eventId);
        return { success: true, data: sheet };

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

        const canTake = canTakeAttendanceForEvent(
            session.user.role,
            session.user.currentAreaId,
            session.user.customPermissions,
            event.targetAreaId,
        );

        if (!canTake) {
            return { success: false, error: "No tienes permisos para registrar asistencia en este evento." };
        }

        await batchUpsertAttendanceDAO(eventId, records);

        revalidatePath(`/admin/events/${eventId}/attendance`);

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
        history.sort((a, b) => {
            const dateA = new Date(a.event.date).getTime();
            const dateB = new Date(b.event.date).getTime();
            return dateB - dateA;
        });

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

        if (record.justificationStatus === "APPROVED") {
            return { success: false, error: "Esta falta ya ha sido justificada y aprobada." };
        }

        await updateAttendanceRecordDAO(recordId, {
            justificationStatus: "PENDING",
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

        const eventTargetAreaId = record.event?.targetAreaId ?? null;

        const canReview = canReviewJustificationForEvent(
            session.user.role,
            session.user.currentAreaId,
            session.user.customPermissions,
            eventTargetAreaId,
        );

        if (!canReview) {
            return { success: false, error: "No tienes permisos para revisar justificaciones de este evento." };
        }

        const updates: any = {
            justificationStatus: verdict,
            adminFeedback: feedback || null,
            reviewedById: session.user.id
        };

        if (verdict === "APPROVED") {
            updates.status = "EXCUSED";
        } else {
            updates.status = "ABSENT";
        }

        await updateAttendanceRecordDAO(recordId, updates);

        revalidatePath("/admin/events");
        revalidatePath(`/admin/events/${record.eventId}/attendance`);

        return { success: true, message: `Justificación ${verdict === "APPROVED" ? "Aprobada" : "Rechazada"}` };

    } catch (error) {
        console.error("Error reviewing justification:", error);
        return { success: false, error: "Error al revisar justificación" };
    }
}

export async function getPendingJustificationsAction() {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const history = await getUserAttendanceHistoryDAO(session.user.id);

        const pending = history.filter(record =>
            ((record.status === "ABSENT" || record.status === "LATE") &&
                (record.justificationStatus === "NONE" || record.justificationStatus === "REJECTED")) ||
            (record.status === "EXCUSED" && record.justificationStatus === "APPROVED")
        );

        pending.sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());

        return { success: true, data: pending };
    } catch (error) {
        console.error("Error fetching pending justifications:", error);
        return { success: false, error: "Error al obtener justificaciones pendientes" };
    }
}

export async function acknowledgeRejectionAction(recordId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const record = await getAttendanceRecordByIdDAO(recordId);
        if (!record) return { success: false, error: "Registro no encontrado" };

        if (record.userId !== session.user.id) {
            return { success: false, error: "No autorizado" };
        }

        await updateAttendanceRecordDAO(recordId, {
            justificationStatus: "ACKNOWLEDGED"
        });

        revalidatePath("/dashboard");
        return { success: true, message: "Notificación descartada" };
    } catch (error) {
        console.error("Error acknowledging rejection:", error);
        return { success: false, error: "Error al descartar notificación" };
    }
}
