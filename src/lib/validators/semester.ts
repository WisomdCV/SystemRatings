import { z } from "zod";

export const CreateSemesterSchema = z.object({
    name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres (ej. '2025-1')" }),
    startDate: z.coerce.date(), // Zod coerce.date() does not accept options in this version
    endDate: z.coerce.date().optional(),
});

export type CreateSemesterDTO = z.infer<typeof CreateSemesterSchema>;
