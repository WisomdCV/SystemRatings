import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Carga las variables de entorno para que Drizzle Kit pueda usarlas
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env file');
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite', // 'driver' se reemplaza por 'dialect' para la nueva sintaxis
  dbCredentials: {
    // El '!' al final le dice a TypeScript que estamos seguros de que este valor existe,
    // ya que lo comprobamos en la línea de arriba.
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

