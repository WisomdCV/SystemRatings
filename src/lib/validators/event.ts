import { z } from "zod";

export const CreateEventSchema = z.object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),

    // Scope & Type (Events v2)
    eventScope: z.enum(["IISE", "PROJECT"]).default("IISE"),
    eventType: z.enum(["GENERAL", "AREA", "INDIVIDUAL_GROUP"]).default("GENERAL"),

    date: z.coerce.date(),

    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),

    isVirtual: z.boolean(),

    // IISE target
    targetAreaId: z.preprocess(
        (val) => (val === "" ? null : val),
        z.string().uuid().optional().nullable()
    ),

    // PROJECT target
    projectId: z.preprocess(
        (val) => (val === "" ? null : val),
        z.string().uuid().optional().nullable()
    ),
    targetProjectAreaId: z.preprocess(
        (val) => (val === "" ? null : val),
        z.string().uuid().optional().nullable()
    ),

    // Invitees (for INDIVIDUAL_GROUP events)
    inviteeUserIds: z.array(z.string().uuid()).optional().default([]),
}).superRefine((data, ctx) => {
    // --- Time validations ---
    // Use Peru time (UTC-5) consistently — Vercel runs in UTC so we
    // must explicitly anchor both "now" and the event time to the same TZ.
    const PERU_OFFSET = "-05:00";
    const dateStr = data.date.toISOString().split('T')[0];
    const eventDateTime = new Date(`${dateStr}T${data.startTime}:00${PERU_OFFSET}`);
    const nowUtc = Date.now();
    const minTime = new Date(nowUtc + 3 * 60 * 1000);

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

    // Overnight support: if endTime <= startTime, the event ends the next day
    // e.g. 23:06 → 01:06 = overnight meeting (valid)
    // Only reject if start === end (zero duration)
    if (data.startTime === data.endTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "La hora de fin no puede ser igual a la de inicio.",
            path: ["endTime"],
        });
    }

    // --- Cross-field validations ---
    if (data.eventScope === "PROJECT" && !data.projectId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Se requiere seleccionar un proyecto.",
            path: ["projectId"],
        });
    }

    if (data.eventType === "INDIVIDUAL_GROUP" && (!data.inviteeUserIds || data.inviteeUserIds.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Se requiere al menos un invitado para reuniones individuales/grupales.",
            path: ["inviteeUserIds"],
        });
    }
});

export type CreateEventDTO = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial().superRefine((data, ctx) => {
    const hasTimeChange = data.date || data.startTime || data.endTime;

    if (hasTimeChange) {
        if (!data.date || !data.startTime || !data.endTime) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Al editar fecha u hora, debes confirmar todos los campos de tiempo.",
                path: ["date"],
            });
            return;
        }

        const PERU_OFFSET = "-05:00";
        const dateStr = data.date.toISOString().split('T')[0];
        const eventDateTime = new Date(`${dateStr}T${data.startTime}:00${PERU_OFFSET}`);
        const nowUtc = Date.now();
        const minTime = new Date(nowUtc + 3 * 60 * 1000);

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

        // Overnight support: if endTime <= startTime, the event ends the next day
        if (data.startTime === data.endTime) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "La hora de fin no puede ser igual a la de inicio.",
                path: ["endTime"],
            });
        }
    }
});

export type UpdateEventDTO = z.infer<typeof UpdateEventSchema>;
