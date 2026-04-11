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

// --- Pillar Grading Permission Grants ---

export const PillarGrantSchema = z.object({
    definitionId: z.string().min(1, "El ID del pilar es requerido"),
    scope: z.enum(["ALL", "OWN_AREA"], { message: "Scope debe ser ALL o OWN_AREA" }),
    grantType: z.enum(["ROLE", "PERMISSION"], { message: "Tipo debe ser ROLE o PERMISSION" }),
    grantValue: z.string().min(1, "El valor del grant es requerido"),
});

export type PillarGrantDTO = z.infer<typeof PillarGrantSchema>;

export const BulkPillarGrantsSchema = z.object({
    definitionId: z.string().min(1, "El ID del pilar es requerido"),
    grants: z.array(z.object({
        scope: z.enum(["ALL", "OWN_AREA"]),
        grantType: z.enum(["ROLE", "PERMISSION"]),
        grantValue: z.string().min(1),
    })),
});

export type BulkPillarGrantsDTO = z.infer<typeof BulkPillarGrantsSchema>;
