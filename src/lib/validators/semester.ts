import { z } from "zod";

export const CreateSemesterSchema = z.object({
    name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres (ej. '2025-1')" }),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    activateImmediately: z.boolean().optional().default(false),
});

export type CreateSemesterDTO = z.infer<typeof CreateSemesterSchema>;

