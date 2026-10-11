# PhotoMaster

> 看懂这张照片，拍好下一张。

仓库地址：`https://github.com/TheFunny233/PhotoMaster`

PhotoMaster 是一款面向普通手机摄影用户的 **AI 摄影指导与真实机位社区** 网站（移动端优先，兼容桌面）。上传照片后，你可以获得有依据的点评（优点 / 可改进处 / 重拍建议 / 修图建议 / 不确定性），在原图上预览真实的裁切与色调修改并导出，还能在地图上发现与分享“站在哪里、朝哪里拍、什么条件下拍”的机位。

本仓库是一份 **完整、可演示、可本地部署的 MVP**，不是静态原型，也不是公开生产上线版本。

---

## 当前完成度（诚实状态）

- 最终状态：**LIVE_VERIFIED**（本地全流程通过，真实视觉接口与真实在线地图均已在本地验证成功）。
- 未包含（按任务书排除）：原生 App、实时视频教练、人脸美化/换脸、付费会员、公开部署、PWA 安装引导等 P1 项。
- 公开上线前仍需：地图服务授权确认、图片与隐私政策、内容治理、持久磁盘与备份、监控、并发容量与供应商费用限制（见 `docs/DEPLOYMENT.md`）。

详细证据见 `artifacts/final-report.md`。

---

## 快速开始

### 1. 环境自动准备（从“缺少运行时”开始也行）

Windows（本任务实际测试的平台）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

macOS / Linux（提供同等脚本，**未在本机测试**）：

```bash
bash scripts/bootstrap.sh
```

`bootstrap` 是幂等的：已有兼容环境直接复用，**不会覆盖 `.env.local`、上传目录或数据库**；缺少 `node`/`pnpm`/浏览器时会自行安装到项目内 `.tools/`（无需管理员权限）。

### 2. 配置环境变量

复制样例并按需填写（`bootstrap` 在缺失时会自动创建 `.env.local` 并生成 `SESSION_SECRET`）：

```powershell
Copy-Item .env.example .env.local
```

`.env.local` 至少需要：

- 无 AI Key：保持 `AI_MODE=mock`，可完整演示界面与流程（结果会明确标注“演示模式”）。
- 有 AI Key（真实模式）：设置

```dotenv
AI_MODE=live
AI_PROTOCOL=chat_completions
AI_BASE_URL=https://<你的 OpenAI 兼容地址>/v1
AI_API_KEY=<你的密钥>
AI_VISION_MODEL=<支持图片输入的模型 ID>
RUN_LIVE_AI_TESTS=true
LIVE_TEST_MAX_REQUESTS=12
```

密钥仅用于服务端，**永远不要加 `NEXT_PUBLIC_` 前缀**。

### 3. 常用命令

```powershell
pnpm install          # 安装依赖
pnpm doctor           # 环境自检，输出 artifacts/environment.json
pnpm db:migrate       # 应用迁移
pnpm db:seed          # 写入幂等演示数据（APP_DEMO_MODE=false 时跳过）
pnpm dev              # 开发模式（http://localhost:3000）
pnpm build            # 生产构建
pnpm start            # 生产启动
```

> 提示：本项目使用项目内工具链（`.tools/`）。若 `pnpm` 不在 PATH，可用 `.tools\run.cmd <pnpm 参数>`，例如 `.tools\run.cmd exec next start -p 3000`。

### 4. 从零启动（生产模式，三步）

```powershell
# ① 准备环境与依赖（首次；幂等，可重复执行）
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1

# ② 生产构建
.tools\run.cmd exec next build

# ③ 启动并访问
.tools\run.cmd exec next start -p 3000
# 浏览器打开 http://localhost:3000
```

开发模式（带热更新）只需：`.tools\run.cmd exec next dev`（默认 3000 端口）。

启动后自检：打开 `http://localhost:3000/api/health`，应返回
`{"ok":true,"app":"PhotoMaster","demoMode":…,"aiMode":…,"mapConfigured":true}`。

---

## 常见问题（Windows）

| 现象 | 处理 |
|---|---|
| `pnpm` 不在 PATH | 用 `.tools\run.cmd exec <命令>`（脚本内会临时加入 `.tools\node` 与 `.tools\npm-global`） |
| 端口被占用 | 换端口：`.tools\run.cmd exec next start -p 3200`，并相应设置 `APP_URL` |
| 想随便试界面、不想消耗真实接口 | 将 `.env.local` 的 `AI_MODE=mock` 后重启；结果会标注“演示模式”，不做真实识图 |
| 真实分析超时 | 提高 `AI_REQUEST_TIMEOUT_MS`，或降低 `AI_MAX_IMAGE_EDGE`；推理型模型可设 `AI_DISABLE_THINKING=true` |
| 登录后立刻退出/掉线 | 本地 HTTP 下不要把 `APP_URL` 设为 `https`；确需 HTTP 可设 `ALLOW_INSECURE_COOKIES=true` |
| 想重置演示数据 | 停止服务后删除 `data/photomaster.db` 与 `data/uploads/`，重新执行 `pnpm db:migrate` 与 `pnpm db:seed` |

一键自检：`pnpm doctor`（输出 `artifacts/environment.json`）。

---

## 测试

```powershell
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test:unit        # 单元测试（Vitest）
pnpm test:integration # 集成测试（隔离测试库）
pnpm build            # 生产构建
pnpm test:e2e         # 浏览器端到端（穿透后端）
pnpm test:a11y        # 无障碍检查
pnpm test:visual      # 视觉回归（稳定瓦片）
pnpm test:live        # 真实视觉接口测试（需显式授权与预算）
pnpm verify           # 一次性运行本地完整质量门槛
```

- `verify` 覆盖 lint、类型、单测、集成、生产构建、E2E、视觉回归，使用**隔离测试数据库与独立上传目录**，绝不 reset 用户数据库。
- `test:live` 独立执行，受 `RUN_LIVE_AI_TESTS` 与 `LIVE_TEST_MAX_REQUESTS` 约束；未授权时报告 **SKIPPED**（不算 PASS）。
- 测试报告：`artifacts/verification.json`、`artifacts/test-results/`；截图：`artifacts/screenshots/`。

### 用模型协议与排错

- 默认实现 **OpenAI 兼容 Chat Completions**（`AI_PROTOCOL=chat_completions`），服务端发送 `text + image_url(data URL)`，不暴露私有媒体 URL。
- 关闭推理模型思考链（如 Qwen3）：`AI_DISABLE_THINKING=true`（服务端发送 `enable_thinking=false`）。
- 常见错误：
  - `401/403` → 密钥或地址错误（不会无限重试）。
  - `429` → 触发限流，遵守 `Retry-After`，重试计入预算。
  - 超时 → 提高 `AI_REQUEST_TIMEOUT_MS`，或降低 `AI_MAX_IMAGE_EDGE`。
  - `unsupported_image` → 模型不支持图片输入，请更换视觉模型。
  - 结果结构不合法 → 会明确报错并保留可重试任务，**不会伪造成功**。

---

## 地图数据源与署名

- 底图默认使用 OpenStreetMap 标准瓦片（`NEXT_PUBLIC_MAP_TILE_URL`），署名 “© OpenStreetMap contributors” 链接到 `https://www.openstreetmap.org/copyright`，不会被面板遮挡。
- 数据库统一使用 **WGS84**；接入高德等其它服务时必须显式坐标转换并核对服务条款，不可混用不同坐标系。

---

## 数据存放、备份与恢复

- SQLite 数据库：`./data/photomaster.db`（`DATABASE_URL` 可改）。
- 上传文件：`./data/uploads/`（私有原图、缩略图、AI 输入副本、公开派生图）。
- 备份：停止服务后复制 `data/` 目录即可。恢复：将 `data/` 放回并重启。
- 删除照片会级联删除其分析、编辑方案与衍生文件（数据库外键 + 文件清理）。
- 部署到 serverless 等**无持久磁盘**环境不会保存数据；README/文档不声称其可行。

---

## 示例内容与实测区分

- 演示数据（两个隔离测试用户、6–10 个机位）在 `APP_DEMO_MODE=true` 时由 `pnpm db:seed` 幂等写入，**全部标注为“演示数据 / 演示机位”**，明确“配图非此地实拍”。
- 演示图片来自许可清楚的公开来源（见 `docs/ASSET_SOURCES.md`）。
- `test:live` 与 `artifacts/test-results/live-*.json` 是**真实调用**证据，与 mock 严格分开记录。

---

## 当前限制与未验证项

见 `docs/KNOWN_LIMITATIONS.md`。要点：本机仅验证 Windows；`bootstrap.sh` 未在本机执行；未做公开部署；地图为本地开发用途的 OSM 标准瓦片，不适用于高流量生产使用。

---

## 目录结构（节选）

```
src/app            Next.js App Router 页面与 API 路由
src/components      UI 组件（Apple 风格 token 化）
src/lib            环境、数据库、认证、AI、图像、编辑、服务层
migrations/        Drizzle 迁移
scripts/           bootstrap / doctor / verify / migrate / seed / test-live / moderate
tests/             unit / integration / e2e（core、a11y、visual）
docs/              产品、架构、设计、验收、环境、测试、部署等文档
.agent/            执行计划、状态、决策、缺陷日志、预算
artifacts/         环境自检、验证报告、截图、最终报告
```