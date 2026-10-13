# OnlyPhoto 执行计划

状态：全部里程碑已完成，最终状态 LIVE_VERIFIED。

## 里程碑与结果

| 里程碑 | 任务 | 结果 | 证据 |
|---|---|---|---|
| M0 环境与范围 | 检测/补齐环境，创建配置与计划，统一品牌，提取风格原文 | 完成 | `artifacts/environment.json`、`docs/ENVIRONMENT.md`、`docs/STYLE_REFERENCE.md` |
| M1 纵向切片 | 认证、上传、DB、mock 分析、历史 | 完成 | E2E T01/T02/T05、`tests/integration/services.test.ts` |
| M2 视觉与 AI | Apple 组件、工作台、真实 adapter、错误与预算 | 完成 | `artifacts/screenshots/workbench-live.png`、`artifacts/test-results/live-ai.json`、`live-http.json` |
| M3 编辑 | recipe、预览、比较、复原、导出 | 完成 | E2E T10、`tests/unit/pixel.test.ts` |
| M4 地图与发布 | 真实地图、详情、发布、编辑、收藏 | 完成 | `artifacts/test-results/map-smoke.json`、E2E T15/T16 |
| M5 社区与完善 | 点赞、评论、举报、个人空间、空错态 | 完成 | E2E T17、`tests/integration/services.test.ts` |
| M6 回归与修复 | 全量测试、移动适配、视觉检查、安全核查 | 完成 | `artifacts/verification.json`、`artifacts/screenshots/` |
| M7 交付 | 冷启动演练、文档、演示脚本、最终证据 | 完成 | `README.md`、`docs/*`、`artifacts/final-report.md` |

## 当前步骤

- 全部门槛已通过（`pnpm verify` 退出码 0）。
- 真实 AI：已用 3 张题材图片完成质量抽检（`live-ai.json`），并额外通过应用 HTTP 路径完成 1 次真实分析（`live-http.json`）。
- 真实在线地图：9 块 OSM 瓦片加载成功、署名可见（`map-smoke.json`）。

## 剩余事项

- 无阻断性必做项。
- 可选 P1：地图服务适配、PWA 安装提示、容器化、`scripts/auto-iterate.mjs` 续跑器。

## 恢复入口

`.tools\run.cmd exec tsx scripts/verify.ts`（或 `pnpm verify`）→ 查看 `artifacts/verification.json`。