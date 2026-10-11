import '../src/lib/loadEnv';
import { listReports, resolveReport } from '../src/lib/services/spots';
import { runMigrations } from '../src/lib/db/migrate';

runMigrations();

const [action, reportId] = process.argv.slice(2);

if (!action || action === 'list') {
  const reports = listReports();
  if (reports.length === 0) {
    console.log('[moderate] 没有举报记录。');
  } else {
    for (const r of reports) {
      console.log(`#${r.id} [${r.status}] ${r.targetType}:${r.targetId} — ${r.reason} (${r.createdAt})`);
    }
  }
  process.exit(0);
}

if (action === 'resolve' || action === 'hide') {
  if (!reportId) {
    console.error('[moderate] 用法：pnpm exec tsx scripts/moderate.ts <resolve|hide> <reportId>');
    process.exit(1);
  }
  const result = resolveReport(reportId, action);
  console.log(`[moderate] 已处理 ${reportId}：${JSON.stringify(result)}`);
  process.exit(0);
}

console.error('[moderate] 未知动作。可用：list | resolve <id> | hide <id>');
process.exit(1);