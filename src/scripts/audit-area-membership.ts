import "dotenv/config";

import { db } from "../db/index";
import { areas, users } from "../db/schema";
import { asc, eq } from "drizzle-orm";

type BasicUser = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  status: string | null;
  currentAreaId: string | null;
};

const MD_ROLES = new Set(["PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"]);

function normalizeRole(role: string | null): string {
  return (role || "").trim().toUpperCase();
}

function printHeader(title: string): void {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function printUsers(title: string, rows: BasicUser[]): void {
  console.log(`\n${title} (${rows.length})`);
  if (rows.length === 0) {
    console.log("  - Ninguno");
    return;
  }

  for (const row of rows) {
    console.log(
      `  - ${row.name || "(Sin nombre)"} | ${row.email} | role=${row.role || "NULL"} | status=${row.status || "NULL"} | areaId=${row.currentAreaId || "NULL"}`,
    );
  }
}

async function main() {
  printHeader("AUDITORIA DE MEMBRESIA POR AREA (IISE)");

  const allAreas = await db.query.areas.findMany({
    columns: { id: true, name: true, code: true, isLeadershipArea: true },
    orderBy: [asc(areas.name)],
  });

  const activeUsers = await db.query.users.findMany({
    where: eq(users.status, "ACTIVE"),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      currentAreaId: true,
    },
    orderBy: [asc(users.name)],
  });

  console.log(`Areas registradas: ${allAreas.length}`);
  console.log(`Usuarios activos: ${activeUsers.length}`);

  const areaById = new Map(allAreas.map((area) => [area.id, area]));

  const mdArea = allAreas.find((area) => area.code === "MD")
    ?? allAreas.find((area) => (area.name || "").toLowerCase().includes("mesa directiva"));

  if (!mdArea) {
    console.log("\nADVERTENCIA: No se encontro area MD (code=MD). Se omiten chequeos especificos de Mesa Directiva.");
  } else {
    console.log(`\nArea MD detectada: ${mdArea.name} (${mdArea.id})`);
  }

  printHeader("1) USUARIOS ACTIVOS POR AREA");

  const usersWithoutArea = activeUsers.filter((user) => !user.currentAreaId);

  for (const area of allAreas) {
    const members = activeUsers.filter((user) => user.currentAreaId === area.id);
    console.log(`\n- ${area.name} [${area.code || "SIN_CODE"}]${area.isLeadershipArea ? " (leadership)" : ""}: ${members.length}`);
    for (const member of members) {
      console.log(`    * ${member.name || "(Sin nombre)"} | ${member.email} | role=${member.role || "NULL"}`);
    }
  }

  printUsers("Usuarios activos SIN area", usersWithoutArea);

  printHeader("2) CHEQUEOS DE CONSISTENCIA MD");

  if (mdArea) {
    const mdMembers = activeUsers.filter((user) => user.currentAreaId === mdArea.id);
    const mdRoleUsers = activeUsers.filter((user) => MD_ROLES.has(normalizeRole(user.role)));

    const mdRoleOutsideMD = mdRoleUsers.filter((user) => user.currentAreaId !== mdArea.id);
    const mdAreaWithNonMdRole = mdMembers.filter((user) => !MD_ROLES.has(normalizeRole(user.role)));

    printUsers("Usuarios con rol de MD fuera del area MD", mdRoleOutsideMD);
    printUsers("Usuarios en area MD con rol no-MD", mdAreaWithNonMdRole);

    console.log("\nResumen MD:");
    console.log(`  - Usuarios activos con rol MD: ${mdRoleUsers.length}`);
    console.log(`  - Usuarios activos dentro del area MD: ${mdMembers.length}`);
    console.log(`  - Inconsistencias (rol MD fuera de area MD): ${mdRoleOutsideMD.length}`);
    console.log(`  - Inconsistencias (area MD con rol no-MD): ${mdAreaWithNonMdRole.length}`);
  }

  printHeader("3) CHEQUEOS GENERALES");

  const usersWithUnknownArea = activeUsers.filter(
    (user) => user.currentAreaId && !areaById.has(user.currentAreaId),
  );

  printUsers("Usuarios activos apuntando a un area inexistente", usersWithUnknownArea);

  console.log("\nFin de auditoria. Este script es de solo lectura (no realiza cambios).\n");
}

main()
  .catch((error) => {
    console.error("Error ejecutando auditoria:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
