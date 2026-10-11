import { z } from 'zod';
import { env } from '@/lib/env';
import { handleError, jsonOk, verifySameOrigin, HttpError } from '@/lib/http';
import { listReports, resolveReport } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

function requireMaintenance(request: Request): void {
  if (!env.maintenanceToken) {
    throw new HttpError(403, 'maintenance_disabled', '未配置 MAINTENANCE_TOKEN，维护入口已禁用');
  }
  const token = request.headers.get('x-maintenance-token');
  if (token !== env.maintenanceToken) {
    throw new HttpError(401, 'unauthorized', '维护令牌不正确');
  }
}

const bodySchema = z.object({
  reportId: z.string().min(1),
  action: z.enum(['resolve', 'hide']),
});

export async function GET(request: Request) {
  try {
    requireMaintenance(request);
    return jsonOk({ reports: listReports() });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    requireMaintenance(request);
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '请求不合法');
    return jsonOk(resolveReport(parsed.data.reportId, parsed.data.action));
  } catch (error) {
    return handleError(error);
  }
}