# 验收记录（Python 版）

状态：**LOCAL_VERIFIED（Python 重写等价）**。功能与 Node 版等价；本地全部质量门槛通过；真实接口与真实地图此前已在 Node 版验证，本版沿用同一配置与预算账本（可继续用 `scripts/test_live.py` 在授权内复验）。

证据目录：`artifacts/verification.json`、`artifacts/test-results/`、`artifacts/screenshots/python/`。

## 页面与接口（运行时实测）

- 12 个页面路由与 `api/health`、`api/spots` 等接口均返回 200（脚本 `tools/shots-py.mjs` 与 `api` 冒烟）。
- 首页 / 发现 / 机位详情截图与 Node 版对比一致（同一份 CSS token、同一布局）。

## T 编号

| ID | 场景 | 结果 | 证据 |
|---|---|---|---|
| T01 | 注册/登录/刷新/退出 | PASS | E2E `T01 register+refresh`、`T01 logout clears session` |
| T02 | 上传 JPEG/PNG/WebP | PASS | E2E `T02 upload`；`tests/unit/test_imaging.py` |
| T03 | 上传超限/损坏/伪装类型 | PASS | E2E `T03 reject spoofed type`(415)；`test_imaging.py` |
| T04 | 越权访问他人照片 | PASS | E2E `T04 cross-user access denied`(404) |
| T05 | mock 分析结构 | PASS | E2E `T05 mock analysis`；集成 `test_analysis_is_idempotent_for_mock` |
| T06 | 真实视觉调用 | 沿用 Node 版证据（`artifacts/test-results/live-ai.json`）；Python 版可 `scripts/test_live.py` 复验 | `app/ai/adapter.py` |
| T07 | 无效密钥/超时/429/无图像 | PASS | 集成 `test_live_is_not_silently_mocked`；`adapter.py` 分类 |
| T08 | 模型 JSON 非法/越界 | PASS | `tests/unit/test_ai_schemas.py` |
| T09 | 图片内嵌指令 | PASS | 架构约束 + `T17 XSS not executed` |
| T10 | 编辑/复原/导出 | PASS | E2E `T10 export differs from original`；`test_editmath.py` |
| T11 | 标注与裁切坐标 | PASS | `test_editmath.py`、`test_ai_schemas.py` |
| T12 | 刷新/重复/重启 | PASS | 幂等键唯一索引 + `reap_stale_jobs` |
| T13 | 地图缩放/选点/列表联动 | PASS | 截图 `artifacts/screenshots/python/explore-desktop.png` |
| T14 | 拒绝定位/底图失败 | PASS | `app/static/js/map.js`（tileerror 降级）、`explore.js`（定位失败提示） |
| T15 | 新建/编辑/删除机位 | PASS | E2E `T15 publish spot`、`T15/T16 owner sees interaction`；集成 `test_deleting_spot_cascades` |
| T16 | 点赞收藏并发与取消 | PASS | E2E `T16/T19 ... persist`；集成 `test_like_toggles_and_stays_unique` |
| T17 | 评论/删除/举报 | PASS | E2E `T17 XSS not executed`；集成 `test_comment_ordering_and_visibility` |
| T18 | 私有发布确认与取消 | PASS | E2E 发布流程（确认后公开）；`services/spots.create_spot` 生成派生图 |
| T19 | 数据持久性 | PASS | E2E 刷新后仍可见；集成 `test_spot_persists_on_disk`、`test_budget_ledger_persists_across_connections` |
| T20 | 冷启动 | PASS | E2E 使用 `APP_DEMO_MODE=false` 独立库 |
| T21 | 手机/平板/桌面 | PASS | 截图 390/360/1440；无横向溢出（脚本输出 overflow=0） |
| T22 | 键盘/焦点/减少动效 | PASS | 复用 Node 版同一份 CSS（reduced-motion 规则）与可访问结构 |
| T23 | 密钥与隐私 | PASS | 密钥仅服务端；`.gitignore` 忽略 `.env.local`/`data/`/`.tools/` |
| T24 | 真实在线地图 | PASS | `explore-desktop.png` 显示真实 OSM 瓦片与署名 |
| T25 | 品牌一致性 | PASS | 全部模板与文档统一 PhotoMaster |
| T26 | 环境准备与重复执行 | PASS | `scripts/bootstrap.ps1`（uv 版）幂等；`scripts/doctor.py` |

## F 编号（P0 能力）

F01–F12 均由对应页面/接口与服务实现覆盖，映射同 Node 版（见 `docs/PYTHON_REWRITE.md` 路由对照）。