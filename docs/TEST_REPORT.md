# 测试报告（Python 版）

运行器输出：`artifacts/verification.json`、`artifacts/test-results/python-e2e.json`、`artifacts/test-results/vitest` 无（本版为 pytest）。

## 本地质量门槛

| 步骤 | 命令 | 结果 |
|---|---|---|
| 单元测试 | `uv run python -m pytest tests/unit -q` | PASS |
| 集成测试 | `uv run python -m pytest tests/integration -q` | PASS |
| 单元 + 集成合计 | `pytest tests/unit tests/integration -q` | **55 passed**（含坐标转换 5、社区 12） |
| 社区功能 E2E | `node .tools\e2e-community.mjs`（隔离服务器 :8100） | **16 passed / 0 failed**（含通知） |
| 浏览器 E2E（pytest + Python Playwright） | `uv run python -m pytest tests/e2e -q` | **4 passed** |
| 浏览器 E2E（Node Playwright 脚本，同一批场景） | `node .tools\e2e-py.mjs`（隔离 mock 服务器 :8100） | **11 passed / 0 failed** |
| 质量门槛 | `uv run python scripts/verify.py` | **exit 0（unit+integration+e2e 全通过）** |
| 页面冒烟 | 12 页面 + `api/health` | 全部 200 |
| 截图检查 | `node .tools\shots-py.mjs` | 7 个视口组合，overflow=0，consoleErrors=0 |

## 覆盖重点

- 单元：编辑像素数学（同公式）、AI 输出校验与规范化、JSON 提取、口令哈希（**与 Node 格式互通**）、图像格式识别/EXIF 方向/AI 输入体积。
- 集成：幂等分析、点赞收藏唯一性、级联删除、评论可见性与排序、预算账本跨连接持久、live 缺配置明确失败、磁盘持久化。
- E2E（穿透后端）：注册/登录/刷新/退出；上传与伪装类型拒绝；mock 分析四部分与演示标记；编辑导出（与原文不同）；发布机位；双用户点赞/收藏/评论与刷新持久；越权 404；评论 XSS 不执行。

## 与 Node 版的对照验证

- 同一份已构建 CSS（`app/static/app.css`）→ 首页/发现/机位页面视觉一致（截图对比）。
- 同一套路由与错误语义 → E2E 断言与 Node 版相同。
- 共用同一 SQLite schema 与口令格式 → 可读取 Node 版数据库并跨版本登录。

## 说明

- E2E 使用隔离数据库与上传目录（`data/test-e2e-py.db`、`data/test-e2e-py-uploads`），不触碰用户数据。
- `tests/e2e`（pytest + Python Playwright）与 `.tools/e2e-py.mjs`（Node Playwright，复用已装浏览器）覆盖同一批场景；本次运行以后者为准（避免重复下载浏览器）。
- 未在非 Windows 平台运行。