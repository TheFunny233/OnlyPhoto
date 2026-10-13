# 部署说明与边界

本目标是**可运行、可演示、可本地部署的 MVP**，不是公开生产上线版本。

## 本地/单机部署（已实际验证）

```powershell
# 1. 准备环境（幂等；可复用已有 Node）
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1

# 2. 生产构建与启动
.tools\run.cmd exec next build
.tools\run.cmd exec next start -p 3000
```

- 数据库：`./data/onlyphoto.db`（SQLite）；上传：`./data/uploads/`。
- **必须有持久磁盘**。复制到无持久盘的 serverless 环境不会保存数据，本说明不声称其可行。
- 生产环境建议设置 `APP_URL=https://<你的域名>`（据此启用 Secure Cookie）、`NODE_ENV=production`、随机 `SESSION_SECRET`。

## 反向代理与 HTTPS

- 置于 HTTPS 后，确保 `APP_URL` 为 `https` 且正确转发 `Host` / `X-Forwarded-For`。
- 修改类请求会校验 Origin；跨域来源需与 `APP_URL` 同源。

## 地图

- 默认 OSM 标准瓦片，**仅供本地开发/低流量演示**，不是有商业 SLA 的无限服务；遵守 OSM 瓦片使用政策，署名可见。
- 高流量上线前应选择具备许可与配额的地图服务，并明确坐标转换（库统一 WGS84，接口保留坐标系字段）。

## 公开上线前仍需人工处理

- 地图服务授权与适用条款确认。
- 图片与隐私政策、用户内容治理流程、举报处理 SLA。
- 正式持久存储与备份策略、运行监控与告警、并发容量评估。
- 供应商 API 费用限额（`live_budget` 仅为应用侧预算，非金额上限）。
- 生产环境不启用公共默认管理员口令/共享演示账号；`APP_DEMO_MODE=false` 时不自动公开演示数据。

## 未做

- 未公开部署；未开通任何付费服务；未推送仓库。
- 未提供容器化交付（可选 P1）。