import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Table for member categories based on their seniority/experience.
 */
export const categorias = sqliteTable('categorias', {
  /** The unique identifier for the category. AUTOINCREMENT is default in SQLite. */
  id: integer('id').primaryKey(),
  /** The name of the category (e.g., TRAINEE, JUNIOR, SENIOR). */
  nombre: text('nombre').notNull().unique(),
  /** A description of the category. */
  descripcion: text('descripcion'),
});

/**
 * Table for system roles (e.g., Administrator, Developer, User).
 */
export const roles = sqliteTable('roles', {
  /** The unique identifier for the role. */
  id: integer('id').primaryKey(),
  /** The name of the role. */
  nombre: text('nombre').notNull().unique(),
});

/**
 * Table for organizational positions/titles.
 */
export const cargos = sqliteTable('cargos', {
  /** The unique identifier for the position. */
  id: integer('id').primaryKey(),
  /** The name of the position (e.g., Director of Logistics). */
  nombre: text('nombre').notNull().unique(),
  /** A description of the position. */
  descripcion: text('descripcion'),
});

/**
 * Main table for users.
 */
export const usuarios = sqliteTable('usuarios', {
  /** The unique identifier for the user. */
  id: integer('id').primaryKey(),
  /** The full name of the user. */
  nombre: text('nombre').notNull(),
  /** The user's email address. Must be unique. */
  email: text('email').notNull().unique(),
  /** The user's hashed password. */
  passwordHash: text('password_hash').notNull(),
  /** A unique code for the user. */
  codigo: text('codigo').unique(),
  /** The year the user joined. */
  año: integer('año'),
  /** The user's phone number. */
  telefono: text('telefono'),
  /** URL for the user's profile picture. */
  fotoUrl: text('foto_url'),
  /** Foreign key for the user's category. Set to null on deletion. */
  categoriaId: integer('categoria_id').references(() => categorias.id, { onDelete: 'set null' }),
  /** Foreign key for the user's system role. Defaults to 3 (User). Restricted on deletion. */
  rolId: integer('rol_id').notNull().default(3).references(() => roles.id, { onDelete: 'restrict' }),
  /** Timestamp of when the user was created. */
  fechaCreacion: text('fecha_creacion').notNull().default(sql`CURRENT_TIMESTAMP`),
  /** Timestamp of the last update to the user's record. */
  fechaActualizacion: text('fecha_actualizacion').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Pivot table for the many-to-many relationship between users and positions.
 */
export const usuarioCargos = sqliteTable('usuario_cargos', {
  /** Foreign key for the user. Cascades on deletion. */
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  /** Foreign key for the position. Cascades on deletion. */
  cargoId: integer('cargo_id').notNull().references(() => cargos.id, { onDelete: 'cascade' }),
}, (table) => {
  // Declaration of the composite primary key.
  return {
    pk: primaryKey({ columns: [table.usuarioId, table.cargoId] }),
  };
});


// --- RELATION DEFINITIONS ---
// This is crucial for Drizzle to understand how tables are connected
// and to perform typed nested queries (joins) easily.

/**
 * Defines the relationship between roles and users.
 * A role can have many users.
 */
export const rolesRelations = relations(roles, ({ many }) => ({
  usuarios: many(usuarios),
}));

/**
 * Defines the relationship between categories and users.
 * A category can have many users.
 */
export const categoriasRelations = relations(categorias, ({ many }) => ({
  usuarios: many(usuarios),
}));

/**
 * Defines the relationships for the users table.
 */
export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  /** A user has one role. */
  rol: one(roles, {
    fields: [usuarios.rolId],
    references: [roles.id],
  }),
  /** A user has one category. */
  categoria: one(categorias, {
    fields: [usuarios.categoriaId],
    references: [categorias.id],
  }),
  /** A user can have many positions through the pivot table. */
  usuarioCargos: many(usuarioCargos),
}));

/**
 * Defines the relationship between positions and users.
 * A position can be assigned to many users through the pivot table.
 */
export const cargosRelations = relations(cargos, ({ many }) => ({
  usuarioCargos: many(usuarioCargos),
}));

/**
 * Defines the relationships for the user-positions pivot table.
 */
export const usuarioCargosRelations = relations(usuarioCargos, ({ one }) => ({
  /** Each entry in the pivot table belongs to one user. */
  usuario: one(usuarios, {
    fields: [usuarioCargos.usuarioId],
    references: [usuarios.id],
  }),
  /** Each entry in the pivot table belongs to one position. */
  cargo: one(cargos, {
    fields: [usuarioCargos.cargoId],
    references: [cargos.id],
  }),
}));
