# OnlyPhoto 交付报告

## 最终状态

**LIVE_VERIFIED** — 全部必做流程通过；真实视觉接口与真实在线地图均在本地验证成功；无已知严重缺陷。

> 说明：仍不代表已完成公开生产上线审核（见 `docs/DEPLOYMENT.md`）。

## 当前运行方式

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1   # 幂等环境准备（已实测）
.tools\run.cmd exec next build                                   # 生产构建
.tools\run.cmd exec next start -p 3000                           # 启动于 http://localhost:3000
```

- 实际验证端口：3000（手动验收）、3100（E2E 独立测试服务器）。
- 配置说明：`.env.example`；本地密钥在 `.env.local`（已被 Git 忽略，未打印）。

## 环境准备与安装记录

- 系统：Microsoft Windows 11 企业版 64 位。
- 起始缺失：Node/npm/pnpm/git。
- 安装（项目内，无需管理员权限）：Node v24.21.0（`.tools/node`）、pnpm 12.11.2（`.tools/npm-global`）、Playwright Chromium 156（用户级 ms-playwright）。原生模块 `better-sqlite3@13.0.3`、`sharp@0.35.5` 实际加载验证通过。
- `bootstrap.ps1` 重复执行退出码 0；`doctor` 关键检查全 PASS（`artifacts/environment.json`）。
- 未自动解决：无阻断项。未安装 git（未提交/推送）。
- 详见 `docs/ENVIRONMENT.md`。

## 已完成

| 编号 | 能力 | 代码入口 | 主要证据 |
|---|---|---|---|
| F01 | 首页与导航 | `src/app/page.tsx`、`SiteNav.tsx` | `artifacts/screenshots/home-*.png` |
| F02 | 账号与权限 | `api/auth/*`、`lib/auth/*` | E2E T01/T04 |
| F03 | 上传与历史 | `api/photos`、`images/ingest.ts` | E2E T02、T19 |
| F04 | 四部分点评 | `lib/ai/*` | T05（mock）、T06（live） |
| F05 | 编辑与导出 | `lib/edit/pixel.ts`、`EditCanvas.tsx` | E2E T10 |
| F06 | 地图发现 | `explore/page.tsx`、`MapView.tsx` | `map-smoke.json` |
| F07 | 点位发布与详情 | `publish`、`spots/[spotId]` | E2E T15 |
| F08 | 基础社区 | `services/spots.ts` | E2E T16/T17 |
| F09 | 个人空间 | `me/page.tsx`、`api/me` | 截图、E2E |
| F10 | 演示与真实模式 | `mock.ts`、`analyze.ts` | 徽章与 receipt |
| F11 | 质量验证 | `scripts/verify.ts` | `verification.json` |
| F12 | 交付材料 | `README.md`、`docs/*`、`.agent/*` | 本仓库 |

## 测试结果

`pnpm verify`，最终代码上连续两次退出码 0（报告 `artifacts/verification.json`）：

| 步骤 | 通过/失败/跳过 | 用时 |
|---|---|---|
| lint | 0 error / 0 warning | ~8.0s |
| typecheck | PASS | ~3.7s |
| test:unit | 41 passed | ~2.9s |
| test:integration | 9 passed | ~2.8s |
| build | PASS | ~10.3s |
| test:e2e | 13 passed | ~20.4s |
| test:visual | 5 passed | ~15.1s |

真实实测（与 mock 分开）：
- 真实视觉接口：`artifacts/test-results/live-ai.json`（3/3 成功，17–22s）+ `live-http.json`（应用 HTTP 路径成功，`mode=live`）。
- 真实在线地图：`artifacts/test-results/map-smoke.json`（9 瓦片成功，署名可见，0 失败）。

## 视觉检查

- 已实际查看：首页（桌面 1440×1000、手机 390×844、窄屏 360）、登录、发现（真实地图 + 列表联动）、工作台（mock 与真实结果）、机位相关流程空态。
- 修复：手机端导航文字换行错乱（改为图标 + 紧凑标签）；登录/退出后导航状态不刷新（`useSession` 随路由刷新）；生产 HTTP 下 Secure Cookie 丢失。
- 截图路径：`artifacts/screenshots/`（含 `workbench-live.png`、`explore-real-map.png`）与视觉基准 `artifacts/screenshots/visual/`。
- 无横向溢出（脚本检测 8 个视口组合均为 0）。

## API 使用

- 供应商：阿里云百炼 OpenAI 兼容端点（host `llm-n6ek9ifblx1h1iov.cn-beijing.maas.aliyuncs.com`）；模型 `qwen3.8-max-0902`。
- 账本记录真实请求：`live_budget.used = 7`（上限 12）；实际计费型 completion 约 8 次（含 1 次未入账的受控探测）。
- 返回用量可追踪（如 input/output tokens、request id，见 `live-ai.json`）。
- **未取得费用数据**（未从供应商控制台读取金额），报告中不推测金额。

## 已知问题与外部阻塞

- 无阻断性必做项；无外部阻塞。
- 已知限制（非阻塞）：仅 Windows 实测；`bootstrap.sh` 未在本机执行；地图为 OSM 标准瓦片仅限本地/低流量；编辑功能限于文档规定的五类；地图地理编码未接入。详见 `docs/KNOWN_LIMITATIONS.md`。

## 数据与运行边界

- 持久化：SQLite `./data/onlyphoto.db` + 上传目录 `./data/uploads/`；需要持久磁盘。
- 演示内容：两个演示用户与 8 个演示机位（`isDemo=true`，明确标注“配图非此地实拍”）——**非真实用户规模或真实摄影攻略**。
- 隐私：分析记录默认私有；发布仅使用清理过元数据的公开派生图；EXIF 位置需单独确认。
- 公开部署限制：未部署、未开通付费服务、未推送仓库。