import { z } from "zod";

export const CreateEventSchema = z.object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),

    // Validamos que se pase un objeto Date.
    // La validación de tiempo futuro preciso se hará con superRefine combinando fecha y hora.
    date: z.coerce.date(),

    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),

    isVirtual: z.boolean(),

    // Convertimos string vacío (select default) a null para el backend
    targetAreaId: z.preprocess(
        (val) => (val === "" ? null : val),
        z.string().uuid().optional().nullable()
    ), // Null = General
}).superRefine((data, ctx) => {
    // Validación de Fecha Futura y Hora Lógica
    const now = new Date();

    // Construcción Robust de Fecha Local:
    // data.date viene de input[type=date], suele ser YYYY-MM-DD (UTC midnight en Date obj)
    // Para asegurar precisión local:
    // 1. Extraemos año, mes día del objeto Date (usando getUTC... porque z.coerce lo parsea como UTC si es string YYYY-MM-DD)
    // O mejor, confiamos en `toISOString` slice si es objeto Date valido, o usamos métodos locales si el input fue local.
    // La forma más segura para input "date" + "time" es construir string ISO.

    // Obtenemos YYYY-MM-DD
    const dateStr = data.date.toISOString().split('T')[0];
    // Construimos fecha completa
    const eventDateTime = new Date(`${dateStr}T${data.startTime}:00`);

    // Margen de 3 minutos (antes 5) para dar tolerancia al usuario final.
    // El botón de UI pone +7 min para "5 min", así que asegura el éxito.
    // Validamos >= 3 min para bloquear el pasado inmediato pero ser amables.
    const minTime = new Date(now.getTime() + 3 * 60 * 1000);

    if (isNaN(eventDateTime.getTime())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Fecha u hora inválida",
            path: ["startTime"],
        });
        return;
    }

    if (eventDateTime < minTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Mínimo 3 - 5 min de antelación.",
            path: ["startTime"],
        });
    }

    // Validación Start < End
    const eventEndDateTime = new Date(`${dateStr}T${data.endTime}:00`);

    if (eventEndDateTime <= eventDateTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Fin debe ser posterior a Inicio",
            path: ["endTime"],
        });
    }
});

export type CreateEventDTO = z.infer<typeof CreateEventSchema>;
