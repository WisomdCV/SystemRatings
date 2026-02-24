import "dotenv/config";
import { db } from "./src/db";
import { positionHistory } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function testQuery() {
    console.log("Using DB URL:", process.env.DATABASE_URL);
    const id = "f06824ab-61f2-47f1-8763-f83f5d05edb8";

    // Test Drizzle query API
    const existingHistory = await db.query.positionHistory.findFirst({
        where: eq(positionHistory.areaId, id),
    });
    console.log("1. Drizzle DB.QUERY API Result:", existingHistory);

    // Test Drizzle Select API
    const existingSelect = await db.select().from(positionHistory).where(eq(positionHistory.areaId, id)).limit(1);
    console.log("2. Drizzle DB.SELECT API Result:", existingSelect);

    process.exit(0);
}

testQuery();
