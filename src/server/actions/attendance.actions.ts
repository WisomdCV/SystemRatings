"use server";

import { auth } from "@/server/auth";
import { getAttendanceSheetDAO, batchUpsertAttendanceDAO, AttendanceStatus } from "@/server/data-access/attendance";
import { getEventByIdDAO } from "@/server/data-access/events"; // Re-using to check event ownership
import { revalidatePath } from "next/cache";

export async function getAttendanceSheetAction(eventId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    const role = session.user.role;
    const userAreaId = session.user.currentAreaId;

    try {
        // Permission Check:
        // 1. Get Event to know its area
        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        const isDevOrPresi = role === "DEV" || role === "PRESIDENT";
        const isAreaDirector = role === "DIRECTOR" && (event.targetAreaId === userAreaId || !event.targetAreaId); // Allow director for general events? 
        // Logic refinement: 
        // - General Event: Maybe only Presi/Dev takes attendance? Or Director/Secretary too? 
        //   Usually General Events are handled by Secretary/Presi. 
        //   Let's allow Directors to SEE the sheet essentially, but maybe restricted saving?
        //   For now, we'll allow access if DIRECTOR. 
        // - Area Event: Must match area.

        if (!isDevOrPresi) {
            if (role !== "DIRECTOR" && role !== "SECRETARY") return { success: false, error: "Permisos insuficientes" };

            // Check Area Match if it's an specific area event
            if (event.targetAreaId && event.targetAreaId !== userAreaId) {
                return { success: false, error: "No puedes tomar asistencia de otra área" };
            }
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

    const role = session.user.role;
    const userAreaId = session.user.currentAreaId;

    try {
        // Same Permission Logic
        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        const isDevOrPresi = role === "DEV" || role === "PRESIDENT";

        if (!isDevOrPresi) {
            if (role !== "DIRECTOR" && role !== "SECRETARY") return { success: false, error: "Permisos insuficientes" };
            if (event.targetAreaId && event.targetAreaId !== userAreaId) {
                return { success: false, error: "No puedes tomar asistencia de otra área" };
            }
            // For General Events, maybe restrict Director? 
            // Assuming for now Directors can help take attendance in general events or we trust them.
        }

        await batchUpsertAttendanceDAO(eventId, records);

        revalidatePath(`/admin/events/${eventId}/attendance`);

        return { success: true, message: "Asistencia guardada correctamente" };

    } catch (error) {
        console.error("Error saving attendance:", error);
        // ... existing code ...
        return { success: false, error: "Error al guardar la asistencia" };
    }
}

import { getUserAttendanceHistoryDAO, updateAttendanceRecordDAO, getAttendanceRecordByIdDAO } from "@/server/data-access/attendance";

export async function getMyAttendanceHistoryAction() {
    const session = await auth();
    if (!session?.user) return { success: false, error: "No autorizado" };

    try {
        const history = await getUserAttendanceHistoryDAO(session.user.id);
        // Sort by event date descending (JS sort)
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
        // Validation: Verify record belongs to user
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
    const role = session.user.role;

    try {
        const isDevOrPresi = role === "DEV" || role === "PRESIDENT";
        // Director can justify? Yes, for their area.
        const record = await getAttendanceRecordByIdDAO(recordId);
        if (!record) return { success: false, error: "Registro no encontrado" };

        // PERMISSION CHECK
        if (!isDevOrPresi) {
            const userAreaId = session.user.currentAreaId;
            const targetAreaId = record.event.targetAreaId; // We need to fetch event details fully or infer.
            // getAttendanceRecordByIdDAO fetches (event: true) so we have event details.

            if (role === "DIRECTOR") {
                // Allow if event target is their area OR maybe general event if allowed.
                // Strict: Only own area events?
                // Or if the USER (student) belongs to their area? 
                // Usually justification is reviewed by the Director of the Area the EVENT belongs to, OR the Director of the USER.
                // Let's assume logic: Director reviews participation in THEIR events.
                if (targetAreaId && targetAreaId !== userAreaId) {
                    return { success: false, error: "No tienes permiso para revisar justificaciones de otras áreas" };
                }
            } else {
                return { success: false, error: "Permisos insuficientes" };
            }
        }

        const updates: any = {
            justificationStatus: verdict,
            adminFeedback: feedback || null,
            reviewedById: session.user.id
        };

        if (verdict === "APPROVED") {
            updates.status = "EXCUSED";
        } else {
            // If Rejected, we revert to ABSENT (as a safe default)
            updates.status = "ABSENT";
        }

        await updateAttendanceRecordDAO(recordId, updates);

        revalidatePath("/admin/events"); // Revalidate admin side
        // Also revalidate specific event page?
        revalidatePath(`/admin/events/${record.eventId}/attendance`); // Accurate path

        return { success: true, message: `Justificación ${verdict === "APPROVED" ? "Aprobada" : "Rechazada"}` };

    } catch (error) {
        console.error("Error reviewing justification:", error);
        return { success: false, error: "Error al revisar justificación" };
    }
}
