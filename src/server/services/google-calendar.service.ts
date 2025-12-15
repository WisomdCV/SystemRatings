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
