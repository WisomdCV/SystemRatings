/**
 * ONE-TIME DATA MIGRATION: normalize legacy events and backfill string-based project permissions.
 *
 * This script:
 * 1. Sets eventScope="IISE", eventType="GENERAL|AREA", tracksAttendance=true on legacy events.
 * 2. Ensures Talento Humano has event+attendance permissions via area_permissions.
 * 3. Backfills project_role_permission rows from DEFAULT_ROLE_PERMISSIONS when missing.
 *
 * Note: This script no longer uses removed boolean flags from project roles/areas.
 * Run manually only when migrating legacy data.
 */

import "dotenv/config";
import { db } from "./index";
import { events, areas, areaPermissions, projectRoles, projectRolePermissions } from "./schema";
import { eq, isNotNull, gte, sql } from "drizzle-orm";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/project-permissions";

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

    // 3. Migrate project role permissions to projectRolePermissions table
    console.log("\n🛡️ Migrating project role permissions to string-based system...");

    const roles = await db.query.projectRoles.findMany({
        with: { permissions: true },
    });
    for (const role of roles) {
        // Skip if role already has permissions in the new table
        if (role.permissions && role.permissions.length > 0) {
            console.log(`   ⏭️ "${role.name}" already has ${role.permissions.length} permissions, skipping.`);
            continue;
        }

        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role.name] ?? [];
        if (defaultPerms.length > 0) {
            await db.insert(projectRolePermissions).values(
                defaultPerms.map(p => ({ projectRoleId: role.id, permission: p }))
            );
            console.log(`   ✅ "${role.name}" (LVL ${role.hierarchyLevel}) → ${defaultPerms.length} permissions inserted`);
        } else {
            console.log(`   ⚠️  "${role.name}" has no default permissions defined.`);
        }
    }

    console.log("\n✅ Migration complete!");
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
