"use server";

import { auth } from "@/server/auth";
import { getAttendanceSheetDAO, batchUpsertAttendanceDAO, AttendanceStatus } from "@/server/data-access/attendance";
import { getEventByIdDAO } from "@/server/data-access/events";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { canManageEvent } from "@/server/services/event-permissions.service";
import { getUserAttendanceHistoryDAO, updateAttendanceRecordDAO, getAttendanceRecordByIdDAO } from "@/server/data-access/attendance";

// =============================================================================
// Helpers — attendance permission check (shared by get & save)
// =============================================================================

async function canTakeAttendanceForEvent(
    role: string | null,
    userId: string,
    userAreaId: string | null,
    customPermissions: string[] | undefined,
    event: {
        createdById: string | null;
        eventScope: string;
        eventType: string;
        targetAreaId: string | null;
        projectId: string | null;
        targetProjectAreaId: string | null;
    },
): Promise<boolean> {
    // take_all → can take attendance on any event
    if (hasPermission(role, "attendance:take_all", customPermissions)) return true;

    // take_own_area → only events targeting user's area and that the user can manage
    if (hasPermission(role, "attendance:take_own_area", customPermissions)) {
        if (!event.targetAreaId) return false;
        if (event.targetAreaId !== userAreaId) return false;

        return canManageEvent(
            {
                userRole: role,
                userId,
                userAreaId,
                customPermissions,
            },
            {
                createdById: event.createdById,
                eventScope: event.eventScope,
                eventType: event.eventType,
                targetAreaId: event.targetAreaId,
                projectId: event.projectId,
                targetProjectAreaId: event.targetProjectAreaId,
            }
        );
    }

    return false;
}

async function canReviewJustificationForEvent(
    role: string | null,
    userId: string,
    userAreaId: string | null,
    customPermissions: string[] | undefined,
    event: {
        createdById: string | null;
        eventScope: string;
        eventType: string;
        targetAreaId: string | null;
        projectId: string | null;
        targetProjectAreaId: string | null;
    },
): Promise<boolean> {
    // review_all → can review justifications for any event
    if (hasPermission(role, "attendance:review_all", customPermissions)) return true;

    // review_own_area → only events targeting user's area and that the user can manage
    if (hasPermission(role, "attendance:review_own_area", customPermissions)) {
        if (!event.targetAreaId) return false;
        if (event.targetAreaId !== userAreaId) return false;

        return canManageEvent(
            {
                userRole: role,
                userId,
                userAreaId,
                customPermissions,
            },
            {
                createdById: event.createdById,
                eventScope: event.eventScope,
                eventType: event.eventType,
                targetAreaId: event.targetAreaId,
                projectId: event.projectId,
                targetProjectAreaId: event.targetProjectAreaId,
            }
        );
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

        const canTake = await canTakeAttendanceForEvent(
            session.user.role,
            session.user.id,
            session.user.currentAreaId,
            session.user.customPermissions,
            {
                createdById: event.createdById,
                eventScope: event.eventScope,
                eventType: event.eventType,
                targetAreaId: event.targetAreaId,
                projectId: event.projectId,
                targetProjectAreaId: event.targetProjectAreaId,
            },
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

        const canTake = await canTakeAttendanceForEvent(
            session.user.role,
            session.user.id,
            session.user.currentAreaId,
            session.user.customPermissions,
            {
                createdById: event.createdById,
                eventScope: event.eventScope,
                eventType: event.eventType,
                targetAreaId: event.targetAreaId,
                projectId: event.projectId,
                targetProjectAreaId: event.targetProjectAreaId,
            },
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

        const canReview = await canReviewJustificationForEvent(
            session.user.role,
            session.user.id,
            session.user.currentAreaId,
            session.user.customPermissions,
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
