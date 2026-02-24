import { db } from "./src/db";
import { positionHistory } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function testQuery() {
    const id = "f06824ab-61f2-47f1-8763-f83f5d05edb8";

    const existingHistory = await db.query.positionHistory.findFirst({
        where: eq(positionHistory.areaId, id),
    });

    console.log("Drizzle query result:", existingHistory);
    process.exit(0);
}

testQuery();
