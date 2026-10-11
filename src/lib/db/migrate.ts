import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sqlite, db } from './client';

export function runMigrations(): void {
  const migrationsFolder = path.join(process.cwd(), 'migrations');
  migrate(db, { migrationsFolder });
}

export function tableExists(name: string): boolean {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
  return Boolean(row);
}