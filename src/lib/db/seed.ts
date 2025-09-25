import { db } from './index';
import { cargos, categorias, roles } from './schema';

async function main() {
  console.log('🌱 Empezando el seeding de la base de datos...');

  // --- Limpieza de tablas (opcional, pero útil para re-ejecutar el script) ---
  // Descomenta estas líneas si quieres que el script borre los datos existentes antes de insertar
  // console.log('🗑️ Limpiando tablas existentes...');
  // await db.delete(cargos);
  // await db.delete(categorias);
  // await db.delete(roles);

  // --- Inserción de Categorías ---
  console.log('📥 Insertando categorías...');
  await db.insert(categorias).values([
    { nombre: 'TRAINEE', descripcion: 'Recién ingresado' },
    { nombre: 'JUNIOR', descripcion: 'Miembro con 1 año de experiencia en IISE' },
    { nombre: 'SENIOR', descripcion: 'Miembro con 4 años de experiencia en IISE' },
  ]);

  // --- Inserción de Roles de Sistema ---
  console.log('📥 Insertando roles de sistema...');
  await db.insert(roles).values([
    { id: 1, nombre: 'Administrador' },
    { id: 2, nombre: 'Developer' },
    { id: 3, nombre: 'Usuario' },
  ]);

  // --- Inserción de Cargos ---
  console.log('📥 Insertando cargos...');
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

  console.log('✅ Seeding completado exitosamente!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error durante el seeding:', error);
  process.exit(1);
});
