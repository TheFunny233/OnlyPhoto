# AGENTS.md — OnlyPhoto

本文件是给编码代理的简短工作约定。完整规格在 `GOAL.md`（含附录 A 风格原文），长文通过路径引用读取，不复制到这里。

## 品牌

- 正式产品名：**OnlyPhoto**（大小写固定）。主张：**看懂这张照片，拍好下一张**。
- 界面语言：简体中文。品牌信息集中配置（`src/lib/env.ts` 的 `APP_NAME`），不在各页面硬编码不同名称。

## 环境与安装授权（持续有效）

- 用户已授权：为本项目**自行检测、下载、安装、配置**所需缺失的运行时、包管理器、依赖与测试浏览器，**无需逐项征询**。
- 优先项目级/用户级安装（本仓库使用 `.tools/`），保护已有环境、`.env.local`、上传目录与数据库；不绕过系统或平台限制，不购买服务，不提高 API 预算。
- 不因缺少 `node`/`pnpm`/浏览器而停止；按 `GOAL.md` 第 0.3 节有界重试。

## 技术栈与关键路径

- TypeScript + React 19 + Next.js 16（App Router）+ Tailwind v4（token 化）。
- SQLite (better-sqlite3) + Drizzle ORM，正式迁移在 `migrations/`。
- 图像处理：sharp（服务端）；编辑预览/导出：浏览器 Canvas，与服务端测试共用 `src/lib/edit/pixel.ts`。
- 地图：Leaflet（客户端懒加载），OSM 标准瓦片，署名必须可见。
- AI：`src/lib/ai/`（`adapter-openai.ts` + `mock.ts` + `analyze.ts` + `schema.ts`）。
- 数据库访问：`src/lib/db/`（`schema.ts` / `client.ts` / `migrate.ts`）。

## 命令（Windows 项目内工具链）

- 若 PATH 无 `pnpm`：用 `.tools\run.cmd exec <命令>`。
- 环境准备：`powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`
- 自检：`pnpm doctor`
- 质量门槛：`pnpm verify`（lint + 类型 + 单测 + 集成 + 构建 + E2E + 视觉）
- 真实 AI：`pnpm test:live`（仅授权与预算内，`RUN_LIVE_AI_TESTS` / `LIVE_TEST_MAX_REQUESTS`）。

## 硬性约束

- 只输出 **OnlyPhoto** 品牌，不残留脚手架默认标题或旧名。
- 不经用户明确要求**不提交、不推送**；不公开部署；不打印或提交密钥。
- 演示数据必须清楚标注；不用假结果冒充真实调用或真实地图；真实模式失败必须**明确报错，不回退 mock**。
- 遵守 `docs/STYLE_REFERENCE.md`：禁渐变、禁重阴影、禁嵌套卡片、禁禁用字体、AA 对比度、reduced-motion、≥44px 触控目标。
- 恢复任务时先读：本文件 → `GOAL.md` 相关章节 → `.agent/PLAN.md` → `.agent/STATUS.json` → `.agent/BUGLOG.md` → 实际代码 diff。