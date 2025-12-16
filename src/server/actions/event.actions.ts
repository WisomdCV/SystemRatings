"use server";

import { auth } from "@/server/auth";
import { CreateEventDTO, CreateEventSchema } from "@/lib/validators/event";
import { createGoogleMeeting } from "@/server/services/google-calendar.service";
import { createEventDAO } from "@/server/data-access/events";
import { revalidatePath } from "next/cache";

export async function createEventAction(input: CreateEventDTO) {
    try {
        // 1. Auth & Validation
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "No autenticado" };
        }

        // Permisos: DEV, PRESIDENT, DIRECTOR, SUBDIRECTOR
        const role = session.user.role;
        if (!["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR"].includes(role || "")) {
            return { success: false, error: "No tienes permisos para crear eventos." };
        }

        // Validación de Schema
        const validated = CreateEventSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }
        const data = validated.data;

        // Regla: DIRECTOR/SUBDIRECTOR solo crea para SU área
        if (role === "DIRECTOR" || role === "SUBDIRECTOR") {
            const currentAreaId = session.user.currentAreaId;
            if (!currentAreaId) return { success: false, error: "Usuario sin área asignada." };

            // Forzamos que sea para su área
            data.targetAreaId = currentAreaId;
        }

        // 2. Google Calendar Integration
        if (!session.accessToken) {
            return { success: false, error: "Google Token Expired. Por favor relogueate." };
        }

        let googleResult = { googleId: "manual-" + Date.now(), meetLink: null as string | null };

        // Solo llamamos a Google si es Virtual o queremos sincronizar calendar
        // El requerimiento dice: "Sincronizarlas con Google Calendar". Asumimos siempre.
        try {
            const googleResponse = await createGoogleMeeting(session.accessToken, data);
            googleResult = {
                googleId: googleResponse.googleId,
                meetLink: googleResponse.meetLink || null
            };
        } catch (error: any) {
            console.error("Google API Error:", error);
            // Podríamos fallar todo, o crear el evento localmente con warning.
            // Por requerimiento "Integración", fallaremos si no se puede conectar.
            return { success: false, error: "Error conectando con Google Calendar: " + error.message };
        }

        // 3. Persistencia en BD
        await createEventDAO(session.user.id, data, googleResult);

        // 4. Revalidate
        revalidatePath("/dashboard");
        revalidatePath("/admin/events");

        return { success: true, message: "Evento creado y sincronizado correctamente." };

    } catch (err: any) {
        console.error("Create Event Action Error:", err);
        return { success: false, error: err.message || "Error interno del servidor" };
    }
}

import { UpdateEventDTO, UpdateEventSchema } from "@/lib/validators/event";
import { deleteGoogleEvent, updateGoogleEvent } from "@/server/services/google-calendar.service";
import { deleteEventDAO, getEventByIdDAO, updateEventDAO } from "@/server/data-access/events";

export async function deleteEventAction(eventId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        // 1. Get Event
        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        // 2. Permissions
        const role = session.user.role;
        const isDevOrPresi = ["DEV", "PRESIDENT"].includes(role || "");
        const isDirectorOrSub = ["DIRECTOR", "SUBDIRECTOR"].includes(role || "");

        if (!isDevOrPresi) {
            if (!isDirectorOrSub) return { success: false, error: "No tienes permisos." };
            if (event.targetAreaId !== session.user.currentAreaId) {
                return { success: false, error: "No puedes eliminar eventos de otras áreas." };
            }
        }

        // 3. Google Sync (Delete)
        let warning = "";
        if (event.googleEventId && session.accessToken) {
            try {
                await deleteGoogleEvent(session.accessToken, event.googleEventId);
            } catch (err: any) {
                console.error("Google Delete Error:", err);
                warning = " Nota: No se pudo eliminar de Google Calendar (Token expirado o error API).";
                // Soft fail: Proceed to DB delete as requested
            }
        } else if (event.googleEventId && !session.accessToken) {
            warning = " Nota: No se pudo conectar con Google (Sesión expirada).";
        }

        // 4. DB Delete
        await deleteEventDAO(eventId);

        revalidatePath("/dashboard");
        revalidatePath("/admin/events");

        return { success: true, message: "Evento eliminado." + warning };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateEventAction(eventId: string, input: UpdateEventDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        // Permisos
        const role = session.user.role;
        const isDevOrPresi = ["DEV", "PRESIDENT"].includes(role || "");
        const isDirectorOrSub = ["DIRECTOR", "SUBDIRECTOR"].includes(role || "");
        const isAreaOwner = isDirectorOrSub && event.createdById === session.user.id; // Or simple Area Guard below

        if (!isDevOrPresi) {
            if (!isDirectorOrSub) return { success: false, error: "No tienes permisos." };
            // Strict Area Check:
            if (event.targetAreaId !== session.user.currentAreaId) {
                return { success: false, error: "Solo puedes gestionar eventos de tu área." };
            }
        }

        // Validación
        const validated = UpdateEventSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }
        const data = validated.data;

        // Google Sync (Update)
        // Check if syncheable fields changed
        const needsGoogleUpdate = data.title || data.description || (data.date && data.startTime && data.endTime);
        let warning = "";

        if (event.googleEventId && needsGoogleUpdate) {
            if (session.accessToken) {
                try {
                    await updateGoogleEvent(session.accessToken, event.googleEventId, data);
                } catch (err: any) {
                    console.error("Google Update Error:", err);
                    warning = " Nota: Cambios guardados localmente, pero falló la sincro con Google.";
                }
            } else {
                warning = " Nota: Sin conexión a Google (Token expirado), cambios solo locales.";
            }
        }

        // DB Update
        await updateEventDAO(eventId, data);

        revalidatePath("/dashboard");
        revalidatePath("/admin/events");

        return { success: true, message: "Evento actualizado." + warning };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
