import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import dotenv from 'dotenv';

// Carga las variables de entorno del archivo .env
dotenv.config({ path: '.env' });

// Es una buena práctica asegurarse de que la variable de entorno exista
if (!process.env.DATABASE_URL) {
  throw new Error('La variable de entorno DATABASE_URL no está definida.');
}

// 1. Crea el cliente que se conecta a la base de datos
const client = createClient({
  url: process.env.DATABASE_URL,
});

// 2. Inicializa Drizzle, pasándole el cliente y nuestro esquema.
// El objeto 'db' es el que usaremos en toda nuestra aplicación para hacer consultas.
export const db = drizzle(client, { schema });
