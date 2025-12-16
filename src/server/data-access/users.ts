import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or, like, and, desc, asc, sql, ne } from "drizzle-orm";
import { UpdateUserRoleDTO, UpdateUserProfileDTO, ModerateUserDTO } from "@/lib/validators/user";

export type UserFilters = {
    search?: string;
    role?: string;
    status?: string;
};

export type PaginationOptions = {
    page: number;
    limit: number;
};

export async function getAllUsers(filters?: UserFilters, pagination?: PaginationOptions) {
    const { search, role, status } = filters || {};
    const { page = 1, limit = 10 } = pagination || {};
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [];

    if (search) {
        const searchLower = `%${search.toLowerCase()}%`;
        conditions.push(
            or(
                like(users.name, searchLower),
                like(users.email, searchLower),
                like(users.cui, searchLower)
            )
        );
    }

    if (role && role !== "ALL") {
        conditions.push(eq(users.role, role));
    }

    if (status && status !== "ALL") {
        conditions.push(eq(users.status, status));
    }

    // GHOST MODE: Exclude DEV role always from this list
    conditions.push(ne(users.role, "DEV"));

    // Execute Query
    const data = await db.query.users.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
            currentArea: true,
        },
        orderBy: [desc(users.joinedAt), asc(users.firstName)], // Default sorting
        limit: limit,
        offset: offset,
    });

    // Count total for pagination metadata
    const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult[0].count;

    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getUserById(id: string) {
    return await db.query.users.findFirst({
        where: eq(users.id, id),
        with: {
            currentArea: true,
        },
    });
}

// Generic Update (Internal use mostly)
export async function updateUser(id: string, data: Partial<typeof users.$inferInsert>) {
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
