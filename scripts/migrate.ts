import '../src/lib/loadEnv';
import { runMigrations } from '../src/lib/db/migrate';
import { resolveDatabasePath } from '../src/lib/db/client';

runMigrations();
console.log(`[photomaster] migrations applied to ${resolveDatabasePath()}`);