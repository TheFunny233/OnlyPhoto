# 测试报告

运行器客观输出：`artifacts/verification.json`、`artifacts/test-results/*.json`、`artifacts/test-results/playwright-html/`。
执行平台：Windows 11 x64，Node v24.21.0。最终代码上 `pnpm verify` 连续两次退出码 0。

## 本地质量门槛（`pnpm verify`）

| 步骤 | 命令 | 结果 | 用时 |
|---|---|---|---|
| lint | `eslint .` | PASS（0 error / 0 warning） | ~8.0s |
| typecheck | `tsc --noEmit` | PASS | ~3.7s |
| test:unit | `vitest run tests/unit` | PASS 41/41 | ~2.9s |
| test:integration | `vitest run tests/integration` | PASS 9/9 | ~2.8s |
| build | `next build`（Turbopack） | PASS | ~10.3s |
| test:e2e | `playwright test --grep-invert @visual` | PASS 13/13 | ~20.4s |
| test:visual | `playwright test --grep @visual` | PASS 5/5 | ~15.1s |

覆盖重点：
- 单元：编辑像素数学（曝光/对比/饱和/暖冷/裁剪/归一化）、AI schema 校验与规范化、JSON 提取、口令哈希、图像格式识别/EXIF 方向/AI 输入体积。
- 集成：幂等分析、点赞收藏唯一性、级联删除、评论可见性与排序、预算账本跨连接持久、live 缺配置明确失败、磁盘持久化。
- E2E（穿透后端）：注册登录刷新退出、上传、mock 分析四部分、上传拒绝、越权 404、编辑导出且与原文不同、发布机位 + 双用户点赞收藏评论 + 刷新持久、评论 XSS 不执行。
- 无障碍：跳转链接、图片 alt、控件可访问名、正文 AA 对比、reduced-motion、focus-visible。
- 视觉：首页（桌面/手机）、登录、发现（稳定瓦片）、工作台（mock 分析后）截图对比，`maxDiffPixelRatio ≤ 0.03`。

## 真实外部实测（与 mock 分开）

### 真实视觉接口（T06）

- 命令：`.tools\run.cmd exec tsx scripts/test-live.ts`（`RUN_LIVE_AI_TESTS=true`）。
- 结果：3/3 成功，用时 17.2s / 22.0s / 22.3s。报告：`artifacts/test-results/live-ai.json`。
- 另通过应用 HTTP 路径完成 1 次真实分析（登录 → 上传 → 分析）：`artifacts/test-results/live-http.json`，`receipt.mode="live"`，截图 `artifacts/screenshots/workbench-live.png`。

**质量抽检（三张题材图片）**：
- 描述与实际可见内容一致（如把“夜市美食”演示图正确识别为山坡地标文字），未因用户所选场景标签而编造。
- 建议具体、结合用户目标；给出优先级与“先做这一件事”。
- 未推断人物身份、精确地点、拍摄时间；不确定项写入 `uncertainties`。
- 未把未实现的编辑包装成已完成；输出通过 schema 校验。
- 提示词版本 `pm-analysis-v1`；首轮因超时失败后通过关闭思考链与降低输入边长复测成功（见 `BUGLOG.md` #7）。

### 真实在线地图（T24）

- 命令：`node .tools\map-smoke.mjs`（真实 OSM 标准瓦片）。
- 结果：9 块瓦片成功、0 失败，署名 `© OpenStreetMap contributors` 可见。报告：`artifacts/test-results/map-smoke.json`，截图 `artifacts/screenshots/explore-real-map.png`。

## 真实调用预算

- 运行预算上限 12；账本 `live_budget.used = 7`；实际计费型 completion 约 8 次（含 1 次未入账的受控探测）。详见 `.agent/BUDGET.json`。

## 未运行 / 说明

- `test:live` 在未授权时报告 SKIPPED（不算 PASS），本项目已授权并实际运行。
- 视觉基准由人工查看确认后再纳入回归；基准与测试环境固定（稳定瓦片、禁用动画）。
- 未对非 Windows 平台测试；`bootstrap.sh` 未在本机执行。