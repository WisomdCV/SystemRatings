import { createClient } from "@libsql/client";

async function checkForeignKeys() {
    const dbPath = process.env.DATABASE_URL || "file:./local.db";
    const client = createClient({ url: dbPath });

    try {
        // Get all tables
        const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
        const tables = tablesRes.rows.map(r => r.name);

        console.log("Checking foreign keys pointing to 'area'...");
        let found = false;

        for (const table of tables) {
            const fks = await client.execute(`PRAGMA foreign_key_list("${table}");`);
            for (const fk of fks.rows) {
                if (fk.table === "area") {
                    console.log(`Table '${table}' references 'area'. Column: ${fk.from} -> ${fk.to}, OnDelete: ${fk.on_delete}`);
                    found = true;

                    // Let's also count how many rows reference a specific area format
                    const countRes = await client.execute(`SELECT COUNT(*) as count FROM "${table}" WHERE "${fk.from}" IS NOT NULL;`);
                    console.log(`  -> Rows in ${table} with non-null ${fk.from}: ${countRes.rows[0].count}`);
                }
            }
        }

        if (!found) {
            console.log("No foreign keys found pointing to 'area'?");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.close();
    }
}

checkForeignKeys();
