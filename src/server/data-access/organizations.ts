import { db } from "@/db";

export async function getAllAreas() {
    return await db.query.areas.findMany({
        orderBy: (areas, { asc }) => [asc(areas.name)],
    });
}
