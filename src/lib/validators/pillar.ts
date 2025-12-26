import { z } from "zod";

export const UpsertPillarSchema = z.object({
    id: z.string().optional(),
    semesterId: z.string().uuid(),
    name: z.string().min(1, "El nombre es requerido"),
    weight: z.number().min(0).max(100),
    directorWeight: z.number().min(0).max(100).nullable().optional(),
    maxScore: z.number().min(0).default(5),
    isDirectorOnly: z.boolean().default(false),
});
