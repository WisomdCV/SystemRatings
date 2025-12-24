// src/db/seed.ts
import "dotenv/config";
import { db } from "./index";
import { areas, semesters, users, gradeDefinitions } from "./schema";
import { eq, sql } from "drizzle-orm";

async function main() {
    console.log("🌱 Iniciando Seed...");

    // 1. Sincronizar Semestre Actual
    // Usamos onConflictDoUpdate para que si ya existe, no falle, solo actualice fechas.
    console.log("📅 Sincronizando Semestre 2025 - A...");

    let [semester] = await db.insert(semesters).values({
        name: "2025 - A",
        isActive: true,
        startDate: new Date("2025-03-01"),
        endDate: new Date("2025-07-31"),
    }).onConflictDoUpdate({
        target: semesters.name,
        set: { isActive: true }
    }).returning();

    // Fallback de seguridad: Si por alguna razón returning() no devuelve nada (raro en SQLite pero posible), lo buscamos.
    if (!semester) {
        const existingSemester = await db.query.semesters.findFirst({
            where: (s, { eq }) => eq(s.name, "2025 - A")
        });
        if (!existingSemester) throw new Error("Error crítico: No se pudo obtener el ID del semestre.");
        semester = existingSemester;
    }

    // 2. Sincronizar Áreas
    // Usamos onConflictDoNothing: Si el código "LO" ya existe, lo ignora.
    console.log("🏢 Sincronizando Áreas...");
    const areasData = [
        { name: "Logística", code: "LO" },
        { name: "Marketing", code: "MK" },
        { name: "PMO", code: "PM" },
        { name: "Talento Humano", code: "TH" },
        { name: "Tic's", code: "TI" },
        { name: "Mejora Continua", code: "MC" },
        { name: "Relaciones Públicas", code: "RP" },
        { name: "Innovación", code: "IN" },
        { name: "Mesa Directiva", code: "MD" },
    ];

    await db.insert(areas).values(areasData).onConflictDoNothing({
        target: areas.code
    });

    // 3. Sincronizar Rúbrica de Notas
    console.log("📝 Sincronizando Rúbrica de Notas...");

    // ESTRATEGIA: Borrar las definiciones anteriores de este semestre y recrearlas.
    // Esto evita duplicados si corres el seed varias veces y asegura que la rúbrica sea exacta.
    await db.delete(gradeDefinitions).where(eq(gradeDefinitions.semesterId, semester.id));

    await db.insert(gradeDefinitions).values([
        { semesterId: semester.id, name: "Reunión General", weight: 0, maxScore: 5 },
        { semesterId: semester.id, name: "Staff", weight: 0, maxScore: 5 },
        { semesterId: semester.id, name: "Proyectos", weight: 0, maxScore: 10 },
        { semesterId: semester.id, name: "Área", weight: 0, maxScore: 15 },
        { semesterId: semester.id, name: "Liderazgo (CD)", weight: 0, maxScore: 15, isDirectorOnly: true },
    ]);

    // 4. PRE-AUTORIZAR TU USUARIO DEV
    console.log("👤 Autorizando Super Admin...");

    await db.insert(users).values({
        email: "wilsondcv711@gmail.com", // Tu correo
        role: "DEV",
        status: "ACTIVE",
        firstName: "Wilson", // Datos temporales, Google los actualizará al loguear
        lastName: "Dev",
    }).onConflictDoUpdate({
        target: users.email,
        set: { role: "DEV", status: "ACTIVE" } // Si ya existías, te asegura el rol DEV
    });

    console.log("✅ Seed completado con éxito.");
}

main().catch((err) => {
    console.error("❌ Error en Seed:", err);
    process.exit(1);
});