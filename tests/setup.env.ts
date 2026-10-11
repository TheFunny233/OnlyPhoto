import fs from 'node:fs';
import path from 'node:path';

// Isolated test database and upload directory. Never touches user data.
process.env.DATABASE_URL = 'file:./data/test-vitest.db';
process.env.UPLOAD_DIR = './data/test-vitest-uploads';
process.env.SESSION_SECRET = 'vitest-secret-not-for-production';
process.env.APP_DEMO_MODE = 'false';
process.env.AI_MODE = 'mock';
process.env.RUN_LIVE_AI_TESTS = 'false';

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  try {
    fs.rmSync(path.join(process.cwd(), 'data', `test-vitest.db${suffix}`), { force: true });
  } catch {
    // ignore
  }
}
try {
  fs.rmSync(path.join(process.cwd(), 'data', 'test-vitest-uploads'), { recursive: true, force: true });
} catch {
  // ignore
}