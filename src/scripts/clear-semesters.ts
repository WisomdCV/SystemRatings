// src/scripts/clear-semesters.ts
// Script para limpiar todos los semestres de la base de datos (solo para testing)
// Ejecutar con: npx tsx src/scripts/clear-semesters.ts

import "dotenv/config";
import { db } from "../db/index";
import { semesters, events, attendanceRecords, grades, gradeDefinitions, kpiMonthlySummaries } from "../db/schema";
import { sql, eq } from "drizzle-orm";

async function clearSemesters() {
    console.log("🧹 Limpiando semestres de la base de datos...\n");

    try {
        // Disable foreign key checks for cleanup
        await db.run(sql`PRAGMA foreign_keys = OFF`);
        console.log("🔓 Foreign keys desactivadas temporalmente\n");

        // Obtener todos los semestres
        const allSemesters = await db.query.semesters.findMany();
        console.log(`📋 Semestres encontrados: ${allSemesters.length}`);

        if (allSemesters.length === 0) {
            console.log("✅ No hay semestres que limpiar.");
            await db.run(sql`PRAGMA foreign_keys = ON`);
            return;
        }

        for (const semester of allSemesters) {
            console.log(`\n🗑️  Eliminando semestre: ${semester.name} (${semester.id})`);

            // 1. Obtener eventos del semestre
            const semesterEvents = await db.query.events.findMany({
                where: eq(events.semesterId, semester.id)
            });

            // 2. Eliminar registros de asistencia de cada evento
            for (const event of semesterEvents) {
                await db.delete(attendanceRecords).where(eq(attendanceRecords.eventId, event.id));
            }
            console.log("   ├── Registros de asistencia eliminados");

            // 3. Eliminar eventos del semestre
            await db.delete(events).where(eq(events.semesterId, semester.id));
            console.log("   ├── Eventos eliminados");

            // 4. Obtener definiciones de notas y eliminar grades asociadas
            const definitions = await db.query.gradeDefinitions.findMany({
                where: eq(gradeDefinitions.semesterId, semester.id)
            });
            for (const def of definitions) {
                await db.delete(grades).where(eq(grades.definitionId, def.id));
            }
            console.log("   ├── Calificaciones eliminadas");

            // 5. Eliminar definiciones de notas del semestre
            await db.delete(gradeDefinitions).where(eq(gradeDefinitions.semesterId, semester.id));
            console.log("   ├── Definiciones de notas eliminadas");

            // 6. Eliminar KPI mensuales del semestre
            await db.delete(kpiMonthlySummaries).where(eq(kpiMonthlySummaries.semesterId, semester.id));
            console.log("   ├── KPI mensuales eliminados");

            // 7. Finalmente, eliminar el semestre
            await db.delete(semesters).where(eq(semesters.id, semester.id));
            console.log("   └── Semestre eliminado ✓");
        }

        // Re-enable foreign key checks
        await db.run(sql`PRAGMA foreign_keys = ON`);
        console.log("\n🔒 Foreign keys reactivadas");

        console.log("\n✅ Todos los semestres han sido eliminados.");
        console.log("🎯 El sistema ahora está en modo 'primera vez'.");
        console.log("   Cualquier usuario podrá crear el primer ciclo.\n");

    } catch (error) {
        // Re-enable foreign keys even on error
        await db.run(sql`PRAGMA foreign_keys = ON`);
        console.error("❌ Error al limpiar semestres:", error);
        process.exit(1);
    }
}

clearSemesters().then(() => {
    console.log("Script finalizado.");
    process.exit(0);
});
