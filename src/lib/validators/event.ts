import { z } from "zod";

export const CreateEventSchema = z.object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),

    // Validamos que se pase un objeto Date y que sea fecha futura (opcionalmente)
    // Para simplificar la validación de formulario, a veces se recibe string y se parsea.
    // Asumiremos que el componente envía un Date o un string ISO válido.
    date: z.coerce.date().refine((date) => date > new Date(), {
        message: "La fecha debe ser futura",
    }),

    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),

    isVirtual: z.boolean(),

    targetAreaId: z.string().uuid().optional().nullable(), // Null = General
});

export type CreateEventDTO = z.infer<typeof CreateEventSchema>;
