import "dotenv/config";
import { createClient } from "@libsql/client";

async function applyMigration() {
    const dbPath = process.env.DATABASE_URL || "file:./local.db";
    const client = createClient({ url: dbPath });

    try {
        console.log("Applying column is_leadership_area to area table...");
        await client.execute("ALTER TABLE `area` ADD `is_leadership_area` integer DEFAULT false;");
        console.log("Migration successful.");

        // Let's manually set the 'MD' area to have is_leadership_area = true 
        // if MD exists, to keep data integrity.
        console.log("Setting MD back to true...");
        await client.execute("UPDATE `area` SET `is_leadership_area` = 1 WHERE `code` = 'MD';");
        console.log("Data migrated successfully.");
    } catch (e: any) {
        if (e.message.includes("duplicate column name")) {
            console.log("Column already exists. No action needed.");
        } else {
            console.error("Error migrating:", e);
        }
    } finally {
        client.close();
    }
}

applyMigration();
