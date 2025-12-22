import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbSchema = NeonHttpDatabase<typeof schema>;

let _db: DbSchema | null = null;

function getDb(): DbSchema {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined");
    }
    const client = neon(process.env.DATABASE_URL);
    _db = drizzle({ client, schema });
  }
  return _db;
}

// Lazy proxy that defers database initialization until first use
export const db: DbSchema = new Proxy({} as DbSchema, {
  get(_target, prop) {
    return getDb()[prop as keyof DbSchema];
  },
});

export { schema };
