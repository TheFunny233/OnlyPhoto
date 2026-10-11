import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const runner = path.join(root, '.tools', process.platform === 'win32' ? 'run.cmd' : 'run.sh');

type Step = { name: string; args: string[] };

const steps: Step[] = [
  { name: 'lint', args: ['exec', 'eslint', '.'] },
  { name: 'typecheck', args: ['exec', 'tsc', '--noEmit'] },
  { name: 'test:unit', args: ['exec', 'vitest', 'run', 'tests/unit', '--reporter=dot'] },
  { name: 'test:integration', args: ['exec', 'vitest', 'run', 'tests/integration', '--reporter=dot'] },
  { name: 'build', args: ['exec', 'next', 'build'] },
  { name: 'test:e2e', args: ['exec', 'playwright', 'test', '--project=desktop', '--grep-invert', '@visual', '--reporter=list'] },
  { name: 'test:visual', args: ['exec', 'playwright', 'test', '--project=desktop', '--grep', '@visual', '--reporter=list'] },
];

const results: { name: string; exitCode: number; passed: boolean; durationMs: number }[] = [];

for (const step of steps) {
  console.log(`\n===== ${step.name} =====`);
  const start = Date.now();
  const res = spawnSync(runner, step.args, { cwd: root, stdio: 'inherit', shell: true });
  const durationMs = Date.now() - start;
  const exitCode = res.status ?? 1;
  results.push({ name: step.name, exitCode, passed: exitCode === 0, durationMs });
  console.log(`----- ${step.name}: ${exitCode === 0 ? 'PASS' : 'FAIL'} (${Math.round(durationMs / 1000)}s) -----`);
}

const report = {
  generatedAt: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  node: process.version,
  allPassed: results.every((r) => r.passed),
  results,
  liveAi: fs.existsSync(path.join(root, 'artifacts', 'test-results', 'live-ai.json'))
    ? JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'test-results', 'live-ai.json'), 'utf8'))
    : { status: 'NOT_RUN' },
};

fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'verification.json'), JSON.stringify(report, null, 2));

console.log(`\n[verify] ${report.allPassed ? '全部本地质量门槛通过' : '存在未通过项'}。报告：artifacts/verification.json`);
process.exit(report.allPassed ? 0 : 1);