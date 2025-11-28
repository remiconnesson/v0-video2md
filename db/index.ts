import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

function createDb(): NeonHttpDatabase<typeof schema> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined")
  }
  const client = neon(databaseUrl)
  return drizzle({ client, schema })
}

// Lazy singleton - created on first access
let _db: NeonHttpDatabase<typeof schema> | null = null

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    _db = createDb()
  }
  return _db
}

// For backward compatibility - create db immediately when accessed
// This avoids Proxy issues in the v0 runtime
export const db = createDb()

export { schema }
