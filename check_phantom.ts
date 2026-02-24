import { createClient } from "@libsql/client";

async function checkMejoraContinua() {
    const dbPath = process.env.DATABASE_URL || "file:./local.db";
    const client = createClient({ url: dbPath });

    const targetId = "f06824ab-61f2-47f1-8763-f83f5d05edb8"; // Mejora Continua ID

    try {
        const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
        const tables = tablesRes.rows.map(r => r.name);

        console.log(`Searching for any row referencing '${targetId}' across all foreign keys pointing to 'area'...`);

        for (const table of tables) {
            const fks = await client.execute(`PRAGMA foreign_key_list("${table}");`);
            for (const fk of fks.rows) {
                if (fk.table === "area") {
                    const countRes = await client.execute({
                        sql: `SELECT * FROM "${table}" WHERE "${fk.from}" = ?;`,
                        args: [targetId]
                    });

                    if (countRes.rows.length > 0) {
                        console.log(`FOUND ${countRes.rows.length} rows in table '${table}' referencing this area!`);
                        console.log(countRes.rows);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.close();
    }
}

checkMejoraContinua();
