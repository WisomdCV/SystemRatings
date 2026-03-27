/**
 * ONE-TIME DATA MIGRATION: Set defaults for existing events and configure area/role capabilities.
 * 
 * This script:
 * 1. Sets eventScope="IISE", eventType="GENERAL", tracksAttendance=true on existing events
 * 2. Sets eventType="AREA" where targetAreaId is not null
 * 3. Activates canCreateEvents on "Talento Humano" area
 * 4. Activates membersCanCreateEvents on "Mesa de recursos humanos" project area
 * 5. Activates canCreateEvents on project roles with hierarchy >= 70
 * 
 * Run: npx tsx src/db/fix-event-schema.ts
 */

import "dotenv/config";
import { db } from "./index";
import { events, areas, areaPermissions, projectAreas, projectRoles } from "./schema";
import { eq, isNotNull, gte, sql } from "drizzle-orm";

async function main() {
    console.log("🔧 Migrating event data...");

    // 1. Set defaults on ALL existing events
    const allEvents = await db.query.events.findMany();
    console.log(`📅 Found ${allEvents.length} existing events`);

    let updatedGeneral = 0;
    let updatedArea = 0;

    for (const event of allEvents) {
        const isArea = event.targetAreaId !== null;
        await db.update(events).set({
            eventScope: "IISE",
            eventType: isArea ? "AREA" : "GENERAL",
            tracksAttendance: true,
        }).where(eq(events.id, event.id));

        if (isArea) updatedArea++;
        else updatedGeneral++;
    }
    console.log(`   ✅ ${updatedGeneral} events → GENERAL, ${updatedArea} events → AREA`);

    // 2. Configure area capabilities
    console.log("\n🏢 Configuring area event capabilities...");

    // Find "Talento Humano" area by code
    const thArea = await db.query.areas.findFirst({
        where: eq(areas.code, "TH")
    });

    if (thArea) {
        // Clear existing permissions and set full event permissions via area_permissions table
        await db.delete(areaPermissions).where(eq(areaPermissions.areaId, thArea.id));
        const fullPerms = [
            "event:create_general", "event:create_area_own", "event:create_area_any",
            "event:create_meeting", "event:manage_own", "event:manage_all",
            "attendance:take_own_area", "attendance:take_all",
            "attendance:review_own_area", "attendance:review_all",
        ];
        await db.insert(areaPermissions).values(
            fullPerms.map(p => ({ areaId: thArea.id, permission: p }))
        );
        console.log(`   ✅ "${thArea.name}" (${thArea.code}) → full event+attendance permissions via area_permissions`);
    } else {
        console.log(`   ⚠️  No area with code "TH" found. Configure manually from /admin/areas.`);
    }

    // 3. Configure project area capabilities
    console.log("\n📁 Configuring project area capabilities...");

    const rrhhArea = await db.query.projectAreas.findFirst({
        where: eq(projectAreas.isSystem, true)
    });

    if (rrhhArea) {
        await db.update(projectAreas).set({
            membersCanCreateEvents: true,
        }).where(eq(projectAreas.id, rrhhArea.id));
        console.log(`   ✅ "${rrhhArea.name}" → membersCanCreateEvents=true`);
    } else {
        console.log(`   ⚠️  No system project area found. Configure manually.`);
    }

    // 4. Configure project role capabilities
    console.log("\n🛡️ Configuring project role event capabilities...");

    const roles = await db.query.projectRoles.findMany();
    for (const role of roles) {
        const shouldCreate = role.hierarchyLevel >= 60;
        const shouldViewAll = role.hierarchyLevel >= 70;
        await db.update(projectRoles).set({
            canCreateEvents: shouldCreate,
            canViewAllAreaEvents: shouldViewAll,
        }).where(eq(projectRoles.id, role.id));
        console.log(`   ${shouldCreate ? "✅" : "⏭️"} "${role.name}" (LVL ${role.hierarchyLevel}) → canCreateEvents=${shouldCreate}, canViewAllAreaEvents=${shouldViewAll}`);
    }

    console.log("\n✅ Migration complete!");
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
