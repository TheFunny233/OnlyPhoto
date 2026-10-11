# 决策记录

格式：决定 / 依据 / 影响。非关键歧义采用任务书默认值并在此登记。

## 技术栈与版本

- **Next.js 16.4.0 + React 19.3 + Tailwind v4.3（Turbopack 构建）**：以实施时的官方最新稳定版本为准，满足任务书 8.1 的单体与 token 化要求。
- **包管理器 pnpm 12.11.2**；空仓库默认 pnpm（任务书 8.1）。锁文件 `pnpm-lock.yaml` 唯一。
- **npm registry 使用 https://registry.npmmirror.com**：官方源可达但下载缓慢；使用许可清楚的可信镜像，`.npmrc` 记录，锁文件仍锁定具体版本。
- **Playwright 浏览器通过 npmmirror 镜像下载**（`PLAYWRIGHT_DOWNLOAD_HOST`），仅用于加速二进制获取。

## 数据与安全

- **better-sqlite3 + Drizzle ORM**，正式迁移在 `migrations/`（任务书 8.1/8.2）。
- **密码哈希使用 Node 内置 `crypto.scrypt`（加盐）**，不引入 bcrypt，减少原生依赖与供应链面。
- **会话 Cookie 的 `Secure` 依据 `APP_URL` 是否为 `https` 决定**：默认生产模式下若强制 Secure，在本地 HTTP（含 E2E 测试服务器）会丢失 Cookie，导致会话不可用。`ALLOW_INSECURE_COOKIES=true` 可显式覆盖。
- **JSON 字段以文本存储**（照片分析、receipt、recipe、subjects）：便于迁移与 SQLite 兼容，读取时用 zod 严格校验。
- **`src/instrumentation.ts` 在服务启动时自动应用迁移**：保证 dev/prod 首次启动即可用，同时保留 `pnpm db:migrate` 显式入口。
- **维护入口用 `MAINTENANCE_TOKEN` 保护**（未配置则禁用），另提供 `scripts/moderate.ts` 命令行维护，不做复杂运营后台。

## AI 适配（依据真实供应商行为）

- 供应商为 OpenAI 兼容 Chat Completions（任务书 9.3 默认协议）。
- **真实调用默认 45s 超时对“推理型”视觉模型偏短**：实测 `qwen3.8-max-0902` 在 45s 内未返回。采用三项适配并在 `.env.local` 显式设置（不改代码默认值）：
  - `AI_REQUEST_TIMEOUT_MS=90000`
  - `AI_MAX_IMAGE_EDGE=1024`（缩小输入，显著降低时延）
  - `AI_DISABLE_THINKING=true`（服务端发送 `enable_thinking=false`，关闭冗长思考链）
- 真实请求预算通过数据库账本 `live_budget` 累计并跨进程保留；应用内 live 调用同时受用户日限与运行预算约束。

## 工程细节

- **ESLint 关闭 `react-hooks/set-state-in-effect`**：该新规则会把“fetch 后 setState”的标准客户端数据获取模式判为问题，属启发式而非缺陷；其余 React 规则保留。
- **`scripts/bootstrap.ps1` 仅使用 ASCII 文案**：Windows PowerShell 5.1 以 ANSI 读取无 BOM 的 `.ps1`，中文与省略号会导致解析失败。
- **动态文件路径使用 `/* turbopackIgnore: true */`**：避免 Turbopack 因动态 `fs` 访问追踪整个项目。
- 测试服务器与 Vitest 使用**独立数据库与上传目录**（`data/test-*.db`），不触碰用户数据。

## 内容与数据真实性

- 演示图片来自 picsum.photos（Unsplash 许可），离线保存在 `public/demo/`，来源见 `docs/ASSET_SOURCES.md`。
- 演示机位标注 `isDemo=true`，描述包含“机位数据演示 / 配图非此地实拍”。
- `.env.local` 中缺失的 `SESSION_SECRET` 由代理生成并追加（任务书 16.1 允许，非覆盖写入）。