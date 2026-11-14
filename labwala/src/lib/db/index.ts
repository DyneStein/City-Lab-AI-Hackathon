import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = BetterSQLite3Database<typeof schema>;

const g = globalThis as unknown as { __nuskhaDb?: DB };

function open(): DB {
  const dir = path.resolve(env.DATA_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const sqlite = new Database(path.join(dir, "nuskha.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  return db;
}

export const db: DB = g.__nuskhaDb ?? (g.__nuskhaDb = open());
export { schema };
