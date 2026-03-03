import { auth } from "@/server/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCustomPermissionsForUser } from "@/server/data-access/custom-roles";

/**
 * Like `auth()` but ALWAYS reads the user's current role, status, area and
 * custom permissions fresh from the database — no JWT cache.
 *
 * Use this in any server page/layout that gates access based on permissions
 * so that role changes made by an admin take effect instantly, without
 * requiring the target user to log out and back in.
 *
 * Cost: 2 small DB queries per call (user row + custom role permissions).
 * For a team of <200 users this is negligible on Turso.
 */
export async function authFresh() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const freshUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: {
            role: true,
            currentAreaId: true,
            status: true,
        },
    });

    if (freshUser) {
        // Detect if role changed since login (loginRole is set once at sign-in)
        const loginRole = session.user.loginRole;
        session.user.roleChanged = loginRole != null && loginRole !== freshUser.role;

        session.user.role = freshUser.role;
        session.user.currentAreaId = freshUser.currentAreaId;
        session.user.status = freshUser.status;
    }

    // Always load fresh custom permissions
    try {
        session.user.customPermissions = await getCustomPermissionsForUser(session.user.id);
    } catch {
        session.user.customPermissions = [];
    }

    return session;
}
