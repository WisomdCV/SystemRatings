import "dotenv/config";
import { db } from "./index";
import { projectRoles } from "./schema";
import { desc, eq } from "drizzle-orm";

async function main() {
  console.log("🔧 Backfilling displayOrder for project roles...");

  const roles = await db.query.projectRoles.findMany({
    orderBy: [desc(projectRoles.hierarchyLevel)],
    columns: { id: true, name: true, hierarchyLevel: true },
  });

  if (roles.length === 0) {
    console.log("ℹ️ No project roles found. Nothing to backfill.");
    process.exit(0);
  }

  for (let i = 0; i < roles.length; i++) {
    await db
      .update(projectRoles)
      .set({ displayOrder: i })
      .where(eq(projectRoles.id, roles[i].id));

    console.log(`   ✅ ${roles[i].name} (authority ${roles[i].hierarchyLevel}) -> displayOrder ${i}`);
  }

  console.log("✅ displayOrder backfill complete.");
}

main().catch((error) => {
  console.error("❌ Failed to backfill displayOrder:", error);
  process.exit(1);
});
