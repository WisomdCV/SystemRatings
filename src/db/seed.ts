// src/db/seed.ts
import "dotenv/config";
import { db } from "./index";
import { areas, semesters, users, gradeDefinitions, customRoles, customRolePermissions, projectAreas, projectRoles } from "./schema";
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
        { name: "Logística", code: "LO", color: "#3b82f6" },              // blue-500
        { name: "Marketing", code: "MK", color: "#ef4444" },              // red-500
        { name: "PMO", code: "PM", color: "#64748b" },                    // slate-500
        { name: "Talento Humano", code: "TH", color: "#ec4899", canCreateEvents: true, canCreateIndividualEvents: true }, // pink-500
        { name: "Optimización de Procesos y Tecnología", code: "OPT", color: "#06b6d4" }, // cyan-500
        { name: "Relaciones Públicas", code: "RP", color: "#a855f7" },    // purple-500
        { name: "Innovación", code: "IN", color: "#f97316" },             // orange-500
        { name: "Mesa Directiva", code: "MD", color: "#f59e0b", isLeadershipArea: true }, // amber-500
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
        { semesterId: semester.id, name: "Reunión General", weight: 20, maxScore: 5 },
        { semesterId: semester.id, name: "Staff", weight: 15, maxScore: 5 },
        { semesterId: semester.id, name: "Proyectos", weight: 35, maxScore: 10 },
        { semesterId: semester.id, name: "Área", weight: 30, directorWeight: 15, maxScore: 15 },
        { semesterId: semester.id, name: "Liderazgo (CD)", weight: 0, directorWeight: 15, maxScore: 15, isDirectorOnly: true },
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

    // 4.1. Opcional: PRE-AUTORIZAR OTROS ROLES ADMINISTRATIVOS
    // Puedes descomentar y cambiar los correos si deseas que al desplegar, 
    // estos usuarios ya nazcan con sus rangos respectivos.
    /*
    console.log("👤 Autorizando Ejecutivos...");
    await db.insert(users).values([
        {
            email: "vp@tuorganizacion.com",
            role: "VICEPRESIDENT",
            status: "ACTIVE",
            firstName: "Vice",
            lastName: "Presidente",
        },
        {
            email: "tesorero@tuorganizacion.com",
            role: "TREASURER",
            status: "ACTIVE",
            firstName: "Tesorero",
            lastName: "Oficial",
        },
        {
            email: "secretario@tuorganizacion.com",
            role: "SECRETARY",
            status: "ACTIVE",
            firstName: "Secretario",
            lastName: "Oficial",
        }
    ]).onConflictDoUpdate({
        target: users.email,
        set: { status: "ACTIVE" }
    });
    */

    // 5. Seed "Director de Proyectos" Custom Role
    console.log("🎯 Sincronizando rol personalizable: Director de Proyectos...");

    const [dirProyectos] = await db.insert(customRoles).values({
        name: "Director de Proyectos",
        description: "Puede crear y administrar todos los proyectos del ciclo.",
        color: "#8B5CF6",
        position: 1,
        isSystem: true,
    }).onConflictDoNothing({
        target: customRoles.name,
    }).returning();

    if (dirProyectos) {
        // Add permissions for this role
        await db.insert(customRolePermissions).values([
            { customRoleId: dirProyectos.id, permission: "project:create" },
            { customRoleId: dirProyectos.id, permission: "project:manage" },
        ]);
        console.log("   ✅ Rol creado con permisos: project:create, project:manage");
    } else {
        console.log("   ⏭️ Rol ya existía, no se modificó.");
    }

    // 6. Seed Áreas y Roles de Proyecto
    console.log("🏢 Sincronizando Áreas Estándar de Proyecto...");
    const existingAreas = await db.query.projectAreas.findMany();
    if (existingAreas.length === 0) {
        await db.insert(projectAreas).values([
            { name: "Logística", color: "#0ea5e9" },           // cyan-500
            { name: "Relaciones Públicas", color: "#ec4899" }, // pink-500
            { name: "Marketing", color: "#e11d48" },           // rose-600
            { name: "Académica", color: "#8b5cf6" },           // violet-500
            { name: "Sistemas", color: "#10b981" },            // emerald-500
            { name: "Mesa de recursos humanos", color: "#f59e0b", isSystem: true, membersCanCreateEvents: true }, // amber-500, RRHH: members can create events
        ]);
        console.log("   ✅ Áreas insertadas.");
    } else {
        console.log("   ⏭️ Áreas ya existían, omitiendo.");
    }

    console.log("🛡️ Sincronizando Jerarquías (Roles) de Proyecto...");
    const existingRoles = await db.query.projectRoles.findMany();
    if (existingRoles.length === 0) {
        await db.insert(projectRoles).values([
            { name: "Coordinador / Project Management", hierarchyLevel: 100, isSystem: true, canCreateEvents: true, canViewAllAreaEvents: true },
            { name: "Director de proyecto", hierarchyLevel: 90, isSystem: true, canCreateEvents: true, canViewAllAreaEvents: true },
            { name: "Subdirector de proyecto", hierarchyLevel: 80, isSystem: true, canCreateEvents: true, canViewAllAreaEvents: true },
            { name: "Tesorero de proyecto", hierarchyLevel: 70, isSystem: true, canCreateEvents: false, canViewAllAreaEvents: false },
            { name: "Director de Área", hierarchyLevel: 60, isSystem: true, canCreateEvents: true, canViewAllAreaEvents: false },
            { name: "Miembro de Área", hierarchyLevel: 50, isSystem: true, canCreateEvents: false, canViewAllAreaEvents: false },
        ]);
        console.log("   ✅ Roles insertados.");
    } else {
        console.log("   ⏭️ Roles ya existían, omitiendo.");
    }

    console.log("✅ Seed completado con éxito.");
}

main().catch((err) => {
    console.error("❌ Error en Seed:", err);
    process.exit(1);
});