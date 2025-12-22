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
  get(_target, prop, _receiver) {
    const target = getDb();
    // Use Reflect.get with the real target as receiver to preserve correct `this` binding
    return Reflect.get(target, prop, target);
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getDb());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getDb(), prop);
  },
});

export { schema };
