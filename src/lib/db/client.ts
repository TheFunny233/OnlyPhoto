import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import { env } from '../env';

export function resolveDatabasePath(): string {
  const raw = env.databaseUrl.replace(/^file:/, '');
  return path.isAbsolute(raw) ? raw : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
}

export function resolveUploadDir(): string {
  return path.isAbsolute(env.uploadDir) ? env.uploadDir : path.join(/* turbopackIgnore: true */ process.cwd(), env.uploadDir);
}

type DbBundle = {
  sqlite: Database.Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

function createBundle(): DbBundle {
  const file = resolveDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

const globalRef = globalThis as unknown as { __photomasterDb?: DbBundle };

export const dbBundle: DbBundle = globalRef.__photomasterDb ?? (globalRef.__photomasterDb = createBundle());
export const sqlite = dbBundle.sqlite;
export const db = dbBundle.db;

export { schema };