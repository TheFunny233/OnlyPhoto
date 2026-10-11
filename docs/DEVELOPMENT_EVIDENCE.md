# 开发过程证据

本文件记录本次任务中真实发生的执行活动与对应证据路径。可复现、可核验；不虚构工具使用。

## 执行主体与标注

- 本次任务由在授权工作区内运行的 **AI 编码代理（Zhanlu / 湛卢 CLI）** 执行，工作目录 `C:\Users\Admin\Desktop\PhotoMaster`。
- 任务书（`GOAL.md`）中的示例提到 Codex；**本仓库未包含任何外部 Codex 会话日志**，因此不将本次工作标注为 Codex。
- 如需区分“Codex 完成的工作”，本仓库没有此类记录；请勿把本仓库证据改写成其它工具的产出。

## 真实发生的活动

1. 完整阅读 `GOAL.md`（含附录 A 风格原文），提取为 `docs/STYLE_REFERENCE.md`（逐字保留）。
2. 环境检测与安装（见 `docs/ENVIRONMENT.md`、`artifacts/environment.json`）：探测到未安装 Node/pnpm/git；下载并安装 Node v24.21.0 到 `.tools/node`，安装 pnpm 12.11.2 到 `.tools/npm-global`，下载 Playwright Chromium；验证原生模块与浏览器。
3. 项目搭建：Next.js 16 + React 19 + Tailwind v4 + Drizzle + better-sqlite3；生成迁移 `migrations/0000_*.sql`（14 表）。
4. 功能实现：认证、上传（EXIF 纠偏/校验/缩略图/AI 输入）、AI 编排（幂等/预算/schema/receipt）、编辑（预览/导出共享像素函数）、地图（Leaflet 懒加载/降级/署名）、机位发布与社区（点赞/收藏/评论/举报）。
5. 调试与修复：完整记录于 `.agent/BUGLOG.md`（11 条，含根因与证据）。
6. 测试：单元 33、集成 9、E2E 13、无障碍 6、视觉 5；真实 AI 3+1 次、真实地图冒烟；`pnpm verify` 连续两次退出码 0。
7. 浏览器实测：Playwright 在桌面/手机/窄屏视口截图并逐张查看（`artifacts/screenshots/`）。

## 证据索引

| 证据 | 路径 |
|---|---|
| 环境自检 | `artifacts/environment.json` |
| 验收运行器输出 | `artifacts/verification.json` |
| 真实 AI 质量抽检 | `artifacts/test-results/live-ai.json` |
| 应用 HTTP 真实分析 | `artifacts/test-results/live-http.json` |
| 真实地图冒烟 | `artifacts/test-results/map-smoke.json` |
| Playwright 报告 | `artifacts/test-results/playwright.json`、`playwright-html/` |
| Vitest 结果 | `artifacts/test-results/vitest.json` |
| 截图（含真实结果） | `artifacts/screenshots/`、`workbench-live.png`、`explore-real-map.png` |
| 运行记录 | `.agent/PLAN.md`、`STATUS.json`、`DECISIONS.md`、`BUGLOG.md`、`BUDGET.json` |
| 素材来源 | `docs/ASSET_SOURCES.md`、`artifacts/assets.json` |

## 时间线（本地时区 UTC+8）

- M0 环境与骨架 → M1 纵向切片 → M2 视觉/真实 AI → M3 编辑 → M4 地图/发布 → M5 社区 → M6 回归 → M7 交付（同一次持续会话内完成）。
- 关键外部实测：真实 AI 于 15:40 前后完成；真实地图冒烟 15:57；HTTP 真实分析 15:58。

## 诚实声明

- 所有通过/失败状态来自运行器输出或人工实际查看，未手工编写 PASS。
- 视觉基准由人工查看确认后纳入回归。
- 无法取得的费用金额标注为未取得，不推测。
- 未能自动解决的边界（如非 Windows 平台 bootstrap 未测试）如实记录。