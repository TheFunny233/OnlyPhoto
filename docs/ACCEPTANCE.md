# 验收记录

最终状态：**LIVE_VERIFIED**。本地全流程通过，真实视觉接口与真实在线地图均在本地验证成功。

命令统一通过 `.tools\run.cmd exec <…>`（或 PATH 中已有 pnpm 时用 `pnpm <…>`）。客观运行器输出见 `artifacts/verification.json`、`artifacts/test-results/`。

## F 编号（P0 能力）

| ID | 能力 | 代码入口 | 证据 |
|---|---|---|---|
| F01 | 首页与完整导航 | `src/app/page.tsx`、`src/components/SiteNav.tsx` | `artifacts/screenshots/home-desktop.png`、`.mobile` |
| F02 | 账号与权限 | `api/auth/*`、`src/lib/auth/*` | E2E T01/T04、集成测试 |
| F03 | 图片上传与历史 | `api/photos/route.ts`、`services/photos.ts`、`images/ingest.ts` | E2E T02、T19 |
| F04 | AI 四部分点评 | `lib/ai/*`、`api/photos/[photoId]/analysis` | T05（mock）、T06（live）、`artifacts/test-results/live-ai.json`、`live-http.json` |
| F05 | 编辑预览与导出 | `lib/edit/pixel.ts`、`studio/[photoId]`、`EditCanvas.tsx` | E2E T10、`tests/unit/pixel.test.ts` |
| F06 | 地图发现 | `explore/page.tsx`、`components/explore/MapView.tsx` | `artifacts/test-results/map-smoke.json`、`explore-real-map.png` |
| F07 | 点位发布与详情 | `publish/page.tsx`、`spots/[spotId]`、`services/spots.ts` | E2E T15 |
| F08 | 基础社区 | `services/spots.ts`、评论/点赞/收藏/举报路由 | E2E T16/T17、集成测试 |
| F09 | 个人空间 | `me/page.tsx`、`api/me` | 截图 + E2E 复用（studio/explore） |
| F10 | 演示与真实模式 | `lib/ai/mock.ts`、`analyze.ts` | T05 标注“演示模式”；T06 标注“真实调用” |
| F11 | 质量验证 | `scripts/verify.ts` | `artifacts/verification.json` |
| F12 | 交付材料 | `README.md`、`docs/*`、`.agent/*` | 本仓库 |

## T 编号（最低验收矩阵）

| ID | 场景 | 结果 | 证据 |
|---|---|---|---|
| T01 | 注册/登录/刷新/退出 | PASS | `tests/e2e/core.spec.ts` T01 |
| T02 | 上传 JPEG/PNG/WebP | PASS（JPEG 走通；PNG/WebP 由 `ingest` 单元测试覆盖格式与解码） | E2E T02、`tests/unit/ingest.test.ts` |
| T03 | 上传超限/损坏/伪装类型 | PASS | E2E T03、`ingest.test.ts`（413/415/400） |
| T04 | 越权访问他人照片 | PASS | E2E T04（404） |
| T05 | mock 分析结构 | PASS（含“演示模式”标注） | E2E T02、集成测试幂等 |
| T06 | 真实视觉调用 | PASS（live） | `live-ai.json`、`live-http.json`、`workbench-live.png` |
| T07 | 密钥无效/超时/429/无图像能力 | PASS（集成测试验证 live 缺配置明确失败；适配器分类错误） | `adapter-openai.ts`、集成测试“no silent fallback” |
| T08 | 模型 JSON 不合法/越界 | PASS | `tests/unit/ai-schema.test.ts` |
| T09 | 照片内嵌指令 | PASS（图片文字仅作数据；无工具调用/文件读取） | 架构约束 + 提示词 + XSS 注入测试 T17 |
| T10 | 编辑/复原/导出 | PASS（像素改变、原图不覆盖） | E2E T10、`pixel.test.ts` |
| T11 | 标注与裁切坐标 | PASS | `pixel.test.ts`、`ai-schema.test.ts`（越界丢弃/裁剪） |
| T12 | 刷新/重复提交/重启 | PASS | 集成测试幂等 + `reapStaleJobs` |
| T13 | 地图缩放/选点/列表联动 | PASS | E2E/截图、`map-smoke.json` |
| T14 | 拒绝定位/底图失败 | PASS（降级提示，列表仍可用） | `MapView` 错误态 + 定位失败分支 |
| T15 | 新建/编辑/删除机位 | PASS | E2E T15、集成测试级联删除 |
| T16 | 点赞收藏并发与取消 | PASS | E2E T15、集成测试唯一性 |
| T17 | 评论/删除/举报 | PASS（无越权、无 XSS 执行） | E2E T17、集成测试 |
| T18 | 私有照片发布确认与取消 | PASS（默认私有；发布用清理后派生图） | E2E 发布流程、`spots.ts` |
| T19 | 数据持久性 | PASS（刷新/重连仍在） | E2E T15、集成测试（新连接读盘） |
| T20 | 冷启动 | PASS（无示例数据也能注册上传） | E2E 使用 `APP_DEMO_MODE=false` 独立库 |
| T21 | 手机/平板/桌面 | PASS（无横向溢出） | `artifacts/screenshots/`、`shots.mjs` |
| T22 | 键盘/焦点/减少动效 | PASS | `tests/e2e/a11y.spec.ts` |
| T23 | 密钥与隐私检查 | PASS（客户端无密钥；忽略规则齐全） | `.gitignore`、client env、doctor 脱敏 |
| T24 | 真实在线地图冒烟 | PASS（9 瓦片 + 署名） | `artifacts/test-results/map-smoke.json` |
| T25 | 品牌一致性 | PASS（全站 OnlyPhoto） | 各页面 metadata、README、报告 |
| T26 | 环境准备与重复执行 | PASS（幂等，doctor 全绿） | `bootstrap.ps1` 退出码 0、`environment.json` |

## 真实实测与 mock 分离

- 真实 AI：`artifacts/test-results/live-ai.json`（3 张题材图片）、`live-http.json`（应用 HTTP 路径）。
- 真实地图：`artifacts/test-results/map-smoke.json`。
- 其余为可离线复现的自动化测试。

## 通过次数

`pnpm verify` 已在最终代码上**连续两次**完整通过（退出码 0）。真实 AI 未因回归重复消耗预算。