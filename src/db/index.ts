import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof createClient> | undefined;
};

const client =
  globalForDb.conn ??
  createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

export const db = drizzle(client, { schema });
