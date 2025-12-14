import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UpdateUserDTO } from "@/lib/validators/user";

export async function getAllUsers() {
    return await db.query.users.findMany({
        with: {
            currentArea: true,
        },
        orderBy: (users, { asc }) => [asc(users.name)],
    });
}

export async function getUserById(id: string) {
    return await db.query.users.findFirst({
        where: eq(users.id, id),
        with: {
            currentArea: true,
        },
    });
}

export async function updateUser(id: string, data: UpdateUserDTO) {
    const [updatedUser] = await db
        .update(users)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

    return updatedUser;
}
