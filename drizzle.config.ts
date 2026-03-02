import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Carga las variables de entorno para que Drizzle Kit pueda usarlas
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env file');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});

