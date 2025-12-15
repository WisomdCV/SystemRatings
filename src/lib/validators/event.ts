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

export const UpdateEventSchema = CreateEventSchema.partial().extend({
    // Podríamos añadir validaciones específicas si es necesario
    // Al ser partial, todas las validaciones (min chars, regex) se mantienen SI el campo está presente.
    // La validación superRefine de CreateEventSchema fallará si falta date/start/end cuando se intenta validar cruzado.
    // Necesitamos un superRefine adaptado o requerir el bloque completo de tiempo si se edita algo.
}).superRefine((data, ctx) => {
    // Si se envía CUALQUIER dato de tiempo, requerimos TODOS para validar consistencia
    const hasTimeChange = data.date || data.startTime || data.endTime;

    if (hasTimeChange) {
        if (!data.date || !data.startTime || !data.endTime) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Al editar fecha u hora, debes confirmar todos los campos de tiempo.",
                path: ["date"], // Flag general
            });
            return;
        }

        // Copiamos la lógica de CreateEventSchema
        const now = new Date();
        const dateStr = data.date.toISOString().split('T')[0];
        const eventDateTime = new Date(`${dateStr}T${data.startTime}:00`);

        // En Update, permitimos editar eventos pasados? O moverlos al pasado?
        // Asumiremos que se aplican las mismas reglas de futuro: "Mínimo 3 min".
        // Salvo que sea un evento ya creado que se quiere corregir levemente, pero la regla de negocio fue estricta.
        const minTime = new Date(now.getTime() + 3 * 60 * 1000);

        if (isNaN(eventDateTime.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Fecha inválida",
                path: ["startTime"],
            });
        } else if (eventDateTime < minTime) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "No puedes mover el evento al pasado (min 3 min).",
                path: ["startTime"],
            });
        }

        const eventEndDateTime = new Date(`${dateStr}T${data.endTime}:00`);
        if (eventEndDateTime <= eventDateTime) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Fin debe ser posterior a Inicio",
                path: ["endTime"],
            });
        }
    }
});

export type UpdateEventDTO = z.infer<typeof UpdateEventSchema>;
