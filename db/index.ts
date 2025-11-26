import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as dotenv from "dotenv";
import * as schema from "./schema";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const client = neon(process.env.DATABASE_URL);

export const db = drizzle({ client, schema });
export { schema };
