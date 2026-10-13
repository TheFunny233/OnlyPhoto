# AGENTS.md — OnlyPhoto

本文件是给编码代理的简短工作约定。完整规格在 `GOAL.md`。`main` 包含 Python 网站、移动端适配和 Capacitor Android WebView App；原 Node/Next.js 实现保留在 `nodejs` 分支。

## 品牌

- 正式产品名：**OnlyPhoto**（大小写固定）。主张：**看懂这张照片，拍好下一张**。界面语言：简体中文。

## 环境与安装授权（持续有效）

- 用户已授权：自行检测、下载、安装、配置所需缺失的运行时（uv、Python）、依赖与测试浏览器，无需逐项征询。
- 优先项目级安装（本项目使用 `.tools/uv`、`.tools/python`）；保护已有 `.env.local`、上传目录与数据库；不绕过平台限制，不购买服务，不提高 API 预算。

## 技术栈与关键路径

- Android 壳：`android/`、`capacitor.config.json`、`www/`；使用 pnpm 与 Gradle 构建。
- Python 3.12 + FastAPI + Jinja2 + 原生 JS（Leaflet/Canvas），依赖由 **uv** 管理（`pyproject.toml` + `uv.lock`）。
- 数据库：标准库 `sqlite3`，迁移在 `migrations/*.sql`（幂等，与 Node 版同 schema，可共用数据库文件）。
- 关键模块：`app/config.py`、`app/db.py`、`app/security.py`、`app/imaging.py`、`app/editmath.py`、`app/ai/*`、`app/services/*`、`app/routers/*`、`app/templates/*`、`app/static/*`。
- 静态样式复用 `app/static/app.css`（由 Node 版 Tailwind 产物导出，保证视觉一致）。

## 命令（Windows 项目内工具链）

- uv 包装脚本：`.tools\run-py.cmd <uv 参数>`（例如 `.tools\run-py.cmd run uvicorn app.main:app --port 8000`）。
- 环境准备：`powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`
- 自检：`.tools\run-py.cmd run python scripts/doctor.py`
- 质量门槛：`.tools\run-py.cmd run python scripts/verify.py`
- 真实 AI：`.tools\run-py.cmd run python scripts/test_live.py`（需 `RUN_LIVE_AI_TESTS=true` 且预算内）

## 硬性约束

- 只输出 OnlyPhoto 品牌；不残留脚手架默认标题或旧名。
- 不经用户明确要求不提交、不推送（本次推送已获用户明确要求）；不公开部署；不打印或提交密钥。
- 演示数据必须清楚标注；不伪造真实调用或真实地图；真实模式失败必须明确报错，不回退 mock。
- 遵守 Apple 风格（禁渐变、禁重阴影、禁嵌套卡片、禁禁用字体、AA 对比度、reduced-motion、≥44px 触控目标）。
- 保持与 Node 版功能等价：页面、API 契约、状态机、错误语义、预算与幂等行为一致。
- 恢复任务时先读：本文件 → `GOAL.md` → `.agent/PLAN.md` → `.agent/STATUS.json` → `.agent/BUGLOG.md` → 实际代码。