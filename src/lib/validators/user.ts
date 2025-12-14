import { z } from "zod";

export const UpdateUserSchema = z.object({
    role: z.enum([
        "VOLUNTEER",
        "MEMBER",
        "DIRECTOR",
        "SUBDIRECTOR",
        "PRESIDENT",
        "TREASURER",
        "DEV",
    ]),
    currentAreaId: z.string().uuid().nullable().optional(),
    status: z.enum(["ACTIVE", "BANNED", "SUSPENDED", "WARNED"]).optional(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
