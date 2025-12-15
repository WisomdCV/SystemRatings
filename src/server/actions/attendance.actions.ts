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
        return { success: false, error: "Error al guardar la asistencia" };
    }
}
