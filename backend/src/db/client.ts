import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// postgres.js connects lazily, so the server can boot before the DB is reachable.
export const sql = postgres(env.DATABASE_URL, { max: 5 });
export const db = drizzle(sql, { schema });
