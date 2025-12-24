import { z } from "zod";

export const UpsertGradeSchema = z.object({
    targetUserId: z.string().uuid({ message: "ID de usuario inválido" }),
    definitionId: z.string().uuid({ message: "ID de pilar inválido" }),
    score: z.number()
        .min(0, { message: "La nota no puede ser negativa" })
        // Max validation will be dynamic based on the pillar, but here we set a reasonable safe cap
        .max(20, { message: "Nota fuera de rango normal (Max global 20)" }),
    feedback: z.string().optional()
});

export type UpsertGradeDTO = z.infer<typeof UpsertGradeSchema>;
