import '../src/lib/loadEnv';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { env, isAiLiveConfigured } from '../src/lib/env';
import { resolveDatabasePath, resolveUploadDir } from '../src/lib/db/client';

type Check = { name: string; ok: boolean; detail: string; critical: boolean };

const checks: Check[] = [];

function add(name: string, ok: boolean, detail: string, critical = true) {
  checks.push({ name, ok, detail, critical });
}

function writable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.doctor-${Date.now()}.tmp`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function run(cmd: string, args: string[]): string | null {
  try {
    const isCmdScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
    return execFileSync(isCmdScript ? `"${cmd}"` : cmd, args, {
      encoding: 'utf8',
      shell: isCmdScript,
    }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const nodeVersion = process.version;
  const major = Number(nodeVersion.replace('v', '').split('.')[0]);
  add('node', major >= 20, `${nodeVersion} @ ${process.execPath}`, true);

  const pnpm = run(path.join(process.cwd(), '.tools', 'npm-global', 'pnpm.cmd'), ['--version']);
  add('pnpm', Boolean(pnpm), pnpm ? `v${pnpm}` : '未找到 .tools/npm-global/pnpm.cmd', false);

  add('dependencies', fs.existsSync(path.join(process.cwd(), 'node_modules')), 'node_modules 存在', true);
  add('next binary', fs.existsSync(path.join(process.cwd(), 'node_modules', 'next')), 'next 已安装', true);
  add('better-sqlite3', fs.existsSync(path.join(process.cwd(), 'node_modules', 'better-sqlite3')), '原生模块已安装', false);

  const dataDir = path.dirname(resolveDatabasePath());
  add('data dir writable', writable(dataDir), dataDir, true);
  const uploadDir = resolveUploadDir();
  add('upload dir writable', writable(uploadDir), uploadDir, true);

  const browserPath = chromium.executablePath();
  add('playwright chromium', fs.existsSync(browserPath), browserPath, false);

  const port = Number(process.env.PORT ?? 3000);
  const inUse = await portInUse(port);
  add('port 3000', !inUse, `127.0.0.1:${port} ${inUse ? '已被占用（可能已有服务在运行）' : '空闲'}`, false);

  add('session secret', env.sessionSecret.length > 0, env.sessionSecret ? '已配置（未输出）' : '未配置 SESSION_SECRET', true);
  add(
    'ai config',
    env.ai.mode === 'mock' || isAiLiveConfigured(),
    `mode=${env.ai.mode}, baseUrl=${env.ai.baseUrl ? '已配置' : '未配置'}, key=${env.ai.apiKey ? '已配置' : '未配置'}, model=${env.ai.visionModel || '未配置'}`,
    false,
  );
  add('map tile url', Boolean(env.map.tileUrl), env.map.tileUrl, false);
  add('database url', Boolean(env.databaseUrl), env.databaseUrl.replace(/^file:/, ''), false);

  const environmentJson = {
    generatedAt: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    os: process.env.OS ?? 'Windows',
    node: { version: nodeVersion, path: process.execPath },
    pnpm: pnpm ?? null,
    database: resolveDatabasePath(),
    uploadDir,
    ai: { mode: env.ai.mode, baseUrlSet: env.ai.baseUrl.length > 0, keySet: env.ai.apiKey.length > 0, model: env.ai.visionModel || null },
    liveTests: { authorized: env.liveTests.run, maxRequests: env.liveTests.maxRequests },
    playwrightChromium: browserPath,
    checks,
  };
  fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'environment.json'), JSON.stringify(environmentJson, null, 2));

  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : c.critical ? 'FAIL' : 'WARN'}  ${c.name} — ${c.detail}`);
  }
  const criticalFailures = checks.filter((c) => c.critical && !c.ok);
  if (criticalFailures.length > 0) {
    console.error(`\n[doctor] ${criticalFailures.length} 项关键检查未通过。`);
    process.exit(1);
  }
  console.log('\n[doctor] 本地环境可用。');
  if (env.ai.mode === 'live' && !isAiLiveConfigured()) {
    console.log('[doctor] 注意：AI_MODE=live 但真实接口未配置完整，真实分析将明确报错。');
  }
}

main().catch((error) => {
  console.error('[doctor] 运行失败：', (error as Error).message);
  process.exit(1);
});