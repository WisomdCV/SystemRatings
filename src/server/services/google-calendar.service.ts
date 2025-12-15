import { CreateEventDTO } from "@/lib/validators/event";

export async function createGoogleMeeting(accessToken: string, eventData: CreateEventDTO) {
    // 1. Construir fechas ISO (Date + Time)
    // eventData.date es un objeto Date (ej: 2025-10-15T00:00:00.000Z)
    // eventData.startTime es string "14:00"

    const dateStr = eventData.date.toISOString().split('T')[0]; // "2025-10-15"

    const startDateTime = `${dateStr}T${eventData.startTime}:00`; // "2025-10-15T14:00:00"
    const endDateTime = `${dateStr}T${eventData.endTime}:00`;     // "2025-10-15T16:00:00"

    // Nota: Es mejor manejar Timezones, pero por simplicidad asumiremos local/UTC handling básico
    // Google API espera formato ISO con timezone o "Z". 
    // Para evitar líos de hora, lo enviaremos con el Timezone del usuario o UTC si es posible.
    // Aquí asumiremos que el navegador envía la hora correcta o que manejaremos -5h (Peru).
    // Pro tip: En producción real, usar 'date-fns-tz'. Aca haremos un append simple de "-05:00" si es Perú.
    const timeZoneOffset = "-05:00";

    const body = {
        summary: eventData.title,
        description: eventData.description,
        start: {
            dateTime: `${startDateTime}${timeZoneOffset}`,
            timeZone: "America/Lima"
        },
        end: {
            dateTime: `${endDateTime}${timeZoneOffset}`,
            timeZone: "America/Lima"
        },
        conferenceData: {
            createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: {
                    type: "hangoutsMeet"
                }
            }
        }
    };

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    return {
        googleId: data.id,
        meetLink: data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri || null,
        htmlLink: data.htmlLink
    };
}

export async function deleteGoogleEvent(accessToken: string, googleEventId: string) {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        },
    });

    if (!response.ok && response.status !== 410) { // 410 = Already deleted (Gone)
        const errorText = await response.text();
        throw new Error(`Google API Error (Delete): ${response.status} ${response.statusText} - ${errorText}`);
    }

    return true;
}

export async function updateGoogleEvent(accessToken: string, googleEventId: string, eventData: Partial<CreateEventDTO>) {
    // Solo enviamos lo que cambia. 
    // Si no hay fechas, no las tocamos. Pero si hay una, necesitamos la otra para 'start' y 'end' structs a veces?
    // Google permite PATCH. 
    // Construiremos el body dinámicamente.

    const body: any = {};
    if (eventData.title) body.summary = eventData.title;
    if (eventData.description !== undefined) body.description = eventData.description; // allow empty string to clear

    // Si cambia fecha u hora, regeneramos start/end
    if (eventData.date || eventData.startTime || eventData.endTime) {
        // Requerimos que si se edita tiempo, se pasen los datos completos o se fusionen antes de llamar a este servicio.
        // Asumiremos que el Action fusionó los datos viejos con los nuevos si eran parciales, 
        // o que el DTO de update siempre manda fecha/hora completas si se edita tiempo.
        // Para seguridad, este servicio esperará que si viene 'date', venga 'startTime' y 'endTime' también 
        // OJO: El usuario dijo "Solo envía... los campos que cambiaron".
        // Pero start/end en Google son objetos compuestos.

        const dateStr = eventData.date ? eventData.date.toISOString().split('T')[0] : null;

        // Lógica complicada si solo cambia 1 campo de 3. 
        // Simplificación: El DTO de Update debe requerir todo el bloque de tiempo si se toca algo de tiempo.
        // Pero si vamos a permitir partial, entonces:

        if (dateStr && eventData.startTime && eventData.endTime) {
            const timeZoneOffset = "-05:00";
            body.start = {
                dateTime: `${dateStr}T${eventData.startTime}:00${timeZoneOffset}`,
                timeZone: "America/Lima"
            };
            body.end = {
                dateTime: `${dateStr}T${eventData.endTime}:00${timeZoneOffset}`,
                timeZone: "America/Lima"
            };
        }
    }

    if (Object.keys(body).length === 0) return null;

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API Error (Update): ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
}
