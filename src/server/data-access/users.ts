import { db } from "@/db";
import { users, positionHistory } from "@/db/schema";
import { eq, or, like, and, desc, asc, sql, ne } from "drizzle-orm";
import { UpdateUserRoleDTO, UpdateUserProfileDTO, ModerateUserDTO } from "@/lib/validators/user";

export type UserFilters = {
    search?: string;
    role?: string;
    status?: string;
    areaId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};

export type PaginationOptions = {
    page: number;
    limit: number;
};

export async function getAllUsers(filters?: UserFilters, pagination?: PaginationOptions) {
    const { search, role, status, areaId, sortBy, sortOrder = 'desc' } = filters || {};
    const { page = 1, limit = 10 } = pagination || {};
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [];

    // Base filters are added to conditions beforehand so we can check if they exist
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

    if (areaId && areaId !== "ALL") {
        conditions.push(eq(users.currentAreaId, areaId));
    }

    // GHOST MODE: Exclude DEV role always from this list
    conditions.push(ne(users.role, "DEV"));

    // Exclude PENDING_APPROVAL users (they appear in /admin/approvals instead)
    conditions.push(ne(users.status, "PENDING_APPROVAL"));

    // Combine conditions
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Build Order By dynamically
    let orderByClause: any[] = [];

    // Sort logic helper
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    if (sortBy === 'name') {
        orderByClause = [orderDirection(users.name)];
    } else if (sortBy === 'cui') {
        orderByClause = [orderDirection(users.cui)];
    } else if (sortBy === 'status') {
        orderByClause = [orderDirection(users.status)];
    } else if (sortBy === 'category') {
        orderByClause = [orderDirection(users.category)];
    } else if (sortBy === 'role') {
        // Custom Role Weight Sorting using Postgres CASE
        const roleOrderAsc = sql`(CASE 
             WHEN ${users.role} = 'DEV' THEN 1
             WHEN ${users.role} = 'PRESIDENT' THEN 2
             WHEN ${users.role} = 'VICEPRESIDENT' THEN 3
             WHEN ${users.role} = 'DIRECTOR' THEN 4
             WHEN ${users.role} = 'SUBDIRECTOR' THEN 5
             WHEN ${users.role} = 'SECRETARY' THEN 6
             WHEN ${users.role} = 'TREASURER' THEN 7
             WHEN ${users.role} = 'MEMBER' THEN 8
             WHEN ${users.role} = 'VOLUNTEER' THEN 9
             ELSE 10 END) ASC`;

        const roleOrderDesc = sql`(CASE 
             WHEN ${users.role} = 'DEV' THEN 1
             WHEN ${users.role} = 'PRESIDENT' THEN 2
             WHEN ${users.role} = 'VICEPRESIDENT' THEN 3
             WHEN ${users.role} = 'DIRECTOR' THEN 4
             WHEN ${users.role} = 'SUBDIRECTOR' THEN 5
             WHEN ${users.role} = 'SECRETARY' THEN 6
             WHEN ${users.role} = 'TREASURER' THEN 7
             WHEN ${users.role} = 'MEMBER' THEN 8
             WHEN ${users.role} = 'VOLUNTEER' THEN 9
             ELSE 10 END) DESC`;

        orderByClause = sortOrder === 'asc' ? [roleOrderAsc] : [roleOrderDesc];
    } else {
        // Default sorting
        orderByClause = [desc(users.joinedAt), asc(users.name)];
    }

    // Execute Query
    const data = await db.query.users.findMany({
        where: whereCondition,
        with: {
            currentArea: true,
            customRoles: {
                with: {
                    customRole: true,
                },
            },
        },
        orderBy: orderByClause,
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
            customRoles: {
                with: {
                    customRole: true,
                },
            },
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

export async function getFullUserProfile(id: string) {
    return await db.query.users.findFirst({
        where: eq(users.id, id),
        with: {
            currentArea: true,
            customRoles: {
                with: {
                    customRole: true,
                },
            },
            positionHistory: {
                orderBy: [desc(positionHistory.startDate)],
                with: {
                    area: true,
                    semester: true,
                }
            }
        },
    });
}
