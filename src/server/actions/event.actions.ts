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

        // Permisos: DEV, PRESIDENT, DIRECTOR
        const role = session.user.role;
        if (!["DEV", "PRESIDENT", "DIRECTOR"].includes(role || "")) {
            return { success: false, error: "No tienes permisos para crear eventos." };
        }

        // Validación de Schema
        const validated = CreateEventSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.errors[0].message };
        }
        const data = validated.data;

        // Regla: DIRECTOR solo crea para SU área
        if (role === "DIRECTOR") {
            const currentAreaId = session.user.currentAreaId;
            if (!currentAreaId) return { success: false, error: "Director sin área asignada." };

            // Forzamos que sea para su área
            // Si el input traía 'null' (General) o otra área, lo corregimos o lanzamos error.
            // Aquí lo corregimos por seguridad:
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
