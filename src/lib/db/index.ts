import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import dotenv from 'dotenv';

// Load environment variables from the .env file.
dotenv.config({ path: '.env' });

// It is a good practice to ensure that the environment variable exists.
if (!process.env.DATABASE_URL) {
  throw new Error('The DATABASE_URL environment variable is not defined.');
}

/**
 * The database client used to connect to the database.
 *
 * @see https://github.com/libsql/libsql-client-ts
 */
const client = createClient({
  url: process.env.DATABASE_URL,
});

/**
 * The Drizzle ORM instance.
 * This is the object we will use throughout our application to make queries.
 *
 * @see https://orm.drizzle.team/docs/overview
 */
export const db = drizzle(client, { schema });
