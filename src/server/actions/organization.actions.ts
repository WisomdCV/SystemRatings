"use server";

import { getAllAreas } from "../data-access/organizations";
import { ActionResult } from "@/types";

export async function getAreasAction(): Promise<ActionResult<any[]>> {
    try {
        const areas = await getAllAreas();
        return { success: true, data: areas };
    } catch (error) {
        console.error("Error in getAreasAction:", error);
        return { success: false, error: "Error al obtener áreas" };
    }
}
