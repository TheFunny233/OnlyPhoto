import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.E2E_PORT ?? '3100';

const env = {
  ...process.env,
  DATABASE_URL: 'file:./data/test-e2e.db',
  UPLOAD_DIR: './data/test-e2e-uploads',
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-e2e-secret-not-for-production',
  APP_DEMO_MODE: 'false',
  AI_MODE: 'mock',
  RUN_LIVE_AI_TESTS: 'false',
  MAINTENANCE_TOKEN: 'test-maintenance-token',
  NODE_ENV: 'production',
};

// Fresh, isolated state for every test run.
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  fs.rmSync(path.join(root, 'data', `test-e2e.db${suffix}`), { force: true });
}
fs.rmSync(path.join(root, 'data', 'test-e2e-uploads'), { recursive: true, force: true });

const runner = path.join(root, '.tools', process.platform === 'win32' ? 'run.cmd' : 'run.sh');

function run(args, stdio = 'inherit') {
  return spawnSync(runner, args, { env, cwd: root, stdio, shell: true });
}

const migrate = run(['exec', 'tsx', 'scripts/migrate.ts']);
if (migrate.status !== 0) {
  console.error('[test-server] migration failed');
  process.exit(1);
}

const child = spawn(runner, ['exec', 'next', 'start', '-p', String(port)], {
  env,
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

const shutdown = () => {
  child.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('exit', (code) => process.exit(code ?? 0));