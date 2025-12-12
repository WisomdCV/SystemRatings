// src/db/seed.ts
import "dotenv/config";
import { db } from "./index"; // Asegúrate de que exportas 'db' desde aquí
import { areas, semesters, users, gradeDefinitions } from "./schema";

async function main() {
    console.log("🌱 Iniciando Seed...");

    // 1. Crear Semestre Actual
    console.log("📅 Creando Semestre 2025 - A...");
    const [semester] = await db.insert(semesters).values({
        name: "2025 - A",
        isActive: true,
        startDate: new Date("2025-03-01"),
        endDate: new Date("2025-07-31"),
    }).returning();

    // 2. Crear Áreas (Basado en tu Excel)
    console.log("🏢 Creando Áreas...");
    const areasData = [
        { name: "Logística", code: "LO" },
        { name: "Marketing", code: "MK" },
        { name: "PMO", code: "PM" },
        { name: "Talento Humano", code: "TH" },
        { name: "Tic's", code: "TI" },
        { name: "Mejora Continua", code: "MC" },
        { name: "Relaciones Públicas", code: "RP" },
        { name: "Innovación", code: "IN" },
        { name: "Mesa Directiva", code: "MD" }, // Para la Presidenta
    ];

    await db.insert(areas).values(areasData);

    // 3. Crear Definiciones de Notas (La Rúbrica)
    console.log("📝 Creando Rúbrica de Notas...");
    await db.insert(gradeDefinitions).values([
        { semesterId: semester.id, name: "Reunión General", weight: 20, maxScore: 5 },
        { semesterId: semester.id, name: "Área", weight: 30, maxScore: 5 },
        { semesterId: semester.id, name: "Proyectos", weight: 35, maxScore: 5 },
        { semesterId: semester.id, name: "Staff", weight: 15, maxScore: 5 },
        { semesterId: semester.id, name: "Reunión CD", weight: 15, maxScore: 5, isDirectorOnly: true },
    ]);

    // 4. PRE-AUTORIZAR TU USUARIO DEV/PRESIDENTE
    // Esto es crucial: Creas tu usuario antes de loguearte para tener permisos
    console.log("👤 Creando Super Admin...");

    await db.insert(users).values({
        email: "wilsondcv711@gmail.com",
        role: "DEV",
        status: "ACTIVE",
        firstName: "Super",
        lastName: "Admin",
        // Google llenará el resto cuando inicies sesión
    }).onConflictDoUpdate({
        target: users.email,
        set: { role: "DEV" } // Si ya existías, te actualiza a DEV
    });

    console.log("✅ Seed completado con éxito.");
}

main().catch((err) => {
    console.error("❌ Error en Seed:", err);
    process.exit(1);
});