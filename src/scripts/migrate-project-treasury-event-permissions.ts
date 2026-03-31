import "dotenv/config";
import { db } from "@/db";
import { projectRoles, projectRolePermissions } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

const TREASURY_ROLE = "Tesorero de proyecto";
const ROLES_WITH_SPECIAL = [
  "Coordinador / Project Management",
  "Director de proyecto",
  "Subdirector de proyecto",
  TREASURY_ROLE,
] as const;

const SPECIAL_PERMISSION = "project:event_create_treasury_special";
const TREASURY_REMOVED_PERMISSIONS = [
  "project:event_create_any",
  "project:event_create_own_area",
] as const;

async function main() {
  console.log("\n🔧 FASE 7 - Migración de permisos de eventos de proyecto");
  console.log(`Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const roles = await db.query.projectRoles.findMany({
    where: inArray(projectRoles.name, [...ROLES_WITH_SPECIAL]),
    columns: { id: true, name: true },
    with: { permissions: true },
  });

  const roleMap = new Map(roles.map((role) => [role.name, role]));

  const missingRoles = ROLES_WITH_SPECIAL.filter((roleName) => !roleMap.has(roleName));
  if (missingRoles.length > 0) {
    console.log(`⚠️  Roles no encontrados: ${missingRoles.join(", ")}`);
  }

  const inserts: { projectRoleId: string; permission: string; roleName: string }[] = [];
  const deletes: { projectRoleId: string; permission: string; roleName: string }[] = [];

  for (const roleName of ROLES_WITH_SPECIAL) {
    const role = roleMap.get(roleName);
    if (!role) continue;

    const currentPerms = new Set(role.permissions.map((p) => p.permission));

    if (!currentPerms.has(SPECIAL_PERMISSION)) {
      inserts.push({
        projectRoleId: role.id,
        permission: SPECIAL_PERMISSION,
        roleName,
      });
    }

    if (roleName === TREASURY_ROLE) {
      for (const perm of TREASURY_REMOVED_PERMISSIONS) {
        if (currentPerms.has(perm)) {
          deletes.push({
            projectRoleId: role.id,
            permission: perm,
            roleName,
          });
        }
      }
    }
  }

  console.log(`\n📌 Cambios planificados:`);
  console.log(`   + Inserts: ${inserts.length}`);
  console.log(`   - Deletes: ${deletes.length}`);

  if (inserts.length > 0) {
    for (const item of inserts) {
      console.log(`   + ${item.roleName}: ${item.permission}`);
    }
  }

  if (deletes.length > 0) {
    for (const item of deletes) {
      console.log(`   - ${item.roleName}: ${item.permission}`);
    }
  }

  if (!APPLY) {
    console.log("\nℹ️  DRY-RUN completado. Ejecuta con --apply para aplicar cambios.");
    return;
  }

  await db.transaction(async (tx) => {
    if (inserts.length > 0) {
      await tx.insert(projectRolePermissions).values(
        inserts.map(({ projectRoleId, permission }) => ({ projectRoleId, permission }))
      );
    }

    for (const item of deletes) {
      await tx.delete(projectRolePermissions).where(
        and(
          eq(projectRolePermissions.projectRoleId, item.projectRoleId),
          eq(projectRolePermissions.permission, item.permission)
        )
      );
    }
  });

  console.log("\n✅ Migración aplicada correctamente.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error en migración:", error);
    process.exit(1);
  });
