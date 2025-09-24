import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// Tabla para las Categorías de los miembros según su antigüedad/experiencia
export const categorias = sqliteTable('categorias', {
  id: integer('id').primaryKey(), // AUTOINCREMENT es por defecto en SQLite
  nombre: text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
});

// Tabla para los Roles de Sistema
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
});

// Tabla para los Cargos (equivalente a Roles Organizacionales)
export const cargos = sqliteTable('cargos', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
});

// Tabla principal de Usuarios
export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  codigo: text('codigo').unique(),
  año: integer('año'),
  telefono: text('telefono'),
  fotoUrl: text('foto_url'),
  categoriaId: integer('categoria_id').references(() => categorias.id, { onDelete: 'set null' }),
  rolId: integer('rol_id').notNull().default(3).references(() => roles.id, { onDelete: 'restrict' }),
  fechaCreacion: text('fecha_creacion').notNull().default(sql`CURRENT_TIMESTAMP`),
  fechaActualizacion: text('fecha_actualizacion').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Tabla Pivote para la relación Muchos a Muchos entre Usuarios y Cargos
export const usuarioCargos = sqliteTable('usuario_cargos', {
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  cargoId: integer('cargo_id').notNull().references(() => cargos.id, { onDelete: 'cascade' }),
}, (table) => {
  // Declaración de la clave primaria compuesta
  return {
    pk: primaryKey({ columns: [table.usuarioId, table.cargoId] }),
  };
});


// --- DEFINICIÓN DE RELACIONES ---
// Esto es crucial para que Drizzle entienda cómo se conectan las tablas
// y para hacer queries anidados (joins) de forma sencilla y tipada.

export const rolesRelations = relations(roles, ({ many }) => ({
  usuarios: many(usuarios), // Un rol puede tener muchos usuarios
}));

export const categoriasRelations = relations(categorias, ({ many }) => ({
  usuarios: many(usuarios), // Una categoría puede tener muchos usuarios
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  // Relación uno a uno/muchos con roles y categorías
  rol: one(roles, {
    fields: [usuarios.rolId],
    references: [roles.id],
  }),
  categoria: one(categorias, {
    fields: [usuarios.categoriaId],
    references: [categorias.id],
  }),
  // Relación uno a muchos con la tabla pivote usuarioCargos
  usuarioCargos: many(usuarioCargos),
}));

export const cargosRelations = relations(cargos, ({ many }) => ({
  // Un cargo puede estar asignado a muchos usuarios a través de la tabla pivote
  usuarioCargos: many(usuarioCargos),
}));

export const usuarioCargosRelations = relations(usuarioCargos, ({ one }) => ({
  // Cada entrada en la tabla pivote pertenece a un usuario y a un cargo
  usuario: one(usuarios, {
    fields: [usuarioCargos.usuarioId],
    references: [usuarios.id],
  }),
  cargo: one(cargos, {
    fields: [usuarioCargos.cargoId],
    references: [cargos.id],
  }),
}));
