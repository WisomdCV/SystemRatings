/**
 * Project Membership Service
 *
 * Shared helper for loading a user's project membership with full permission
 * and area context.  Used across all project action files.
 */

import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Load a user's project membership together with their role permissions and
 * area assignment.  Returns `null` when the user is not a member.
 */
export async function getProjectMembershipWithPerms(userId: string, projectId: string) {
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    ),
    with: {
      projectRole: { with: { permissions: true } },
      projectArea: true,
    },
  });
  return membership ?? null;
}
