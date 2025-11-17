import { db } from './index';
import { cargos, categorias, roles } from './schema';

/**
 * Seeds the database with initial data.
 * This script is intended to be run from the command line.
 */
async function main() {
  console.log('🌱 Starting database seeding...');

  // --- Table cleanup (optional, but useful for re-running the script) ---
  // Uncomment these lines if you want the script to delete existing data before inserting
  // console.log('🗑️ Clearing existing tables...');
  // await db.delete(cargos);
  // await db.delete(categorias);
  // await db.delete(roles);

  // --- Category Insertion ---
  console.log('📥 Inserting categories...');
  await db.insert(categorias).values([
    { nombre: 'TRAINEE', descripcion: 'Newly joined' },
    { nombre: 'JUNIOR', descripcion: 'Member with 1 year of experience in IISE' },
    { nombre: 'SENIOR', descripcion: 'Member with 4 years of experience in IISE' },
  ]);

  // --- System Role Insertion ---
  console.log('📥 Inserting system roles...');
  await db.insert(roles).values([
    { id: 1, nombre: 'Administrator' },
    { id: 2, nombre: 'Developer' },
    { id: 3, nombre: 'User' },
  ]);

  // --- Position Insertion ---
  console.log('📥 Inserting positions...');
  await db.insert(cargos).values([
    { nombre: 'Director de Logística' },
    { nombre: 'Director de PMO' },
    { nombre: 'Director de Relaciones Públicas' },
    { nombre: 'Director de Tic\'s' },
    { nombre: 'Directora de Innovación' },
    { nombre: 'Directora de Marketing' },
    { nombre: 'Directora de Talento Humano' },
    { nombre: 'Miembro de Innovación' },
    { nombre: 'Miembro de Logística' },
    { nombre: 'Miembro de Marketing' },
    { nombre: 'Miembro de Mejora Continua' },
    { nombre: 'Miembro de PMO' },
    { nombre: 'Miembro de Relaciones Públicas' },
    { nombre: 'Miembro de Talento Humano' },
    { nombre: 'Miembro de Tic\'s' },
    { nombre: 'Subdirector de Marketing' },
    { nombre: 'Subdirector de Mejora Continua' },
    { nombre: 'Subdirector de Relaciones Públicas' },
    { nombre: 'Subdirector de Talento Humano' },
    { nombre: 'Subdirector de Tic\'s' },
    { nombre: 'Subdirectora de Innovación' },
    { nombre: 'Subdirectora de Logística' },
    { nombre: 'Subdirectora de PMO' },
    { nombre: 'Tesorero de IISE UNSA' },
  ]);

  console.log('✅ Seeding completed successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error during seeding:', error);
  process.exit(1);
});
