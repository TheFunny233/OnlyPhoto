# 环境记录（Python 版）

机器可读版本：`artifacts/environment.json`。不含任何密钥。

## 起始状态

- Windows 11 企业版 64 位；未安装 Python、uv（PATH 中不可用；仅有一个第三方软件自带的 uv，不予依赖）。

## 安装结果（项目内，无需管理员权限）

| 组件 | 版本 | 位置 | 来源 |
|---|---|---|---|
| uv | 0.13.0 | `.tools/uv/uv.exe` | GitHub 官方 `astral-sh/uv` 发布包 |
| Python | 3.12.15 | `.tools/python/cpython-3.12.15-windows-x86_64-none/` | `uv python install`（uv 管理的独立发行版） |
| 虚拟环境 | — | `.venv/` | `uv sync` 创建 |
| 测试浏览器 | Chromium（复用共享缓存） | `%LOCALAPPDATA%\ms-playwright` | Node 版下载的同一缓存 |

## 依赖（`uv.lock` 锁定）

fastapi、uvicorn[standard]、jinja2、python-multipart、httpx、pillow、python-dotenv；开发组：pytest、pytest-asyncio、pytest-json-report、playwright。

- 镜像/加速：npm 侧不改；Playwright 浏览器使用 npmmirror 二进制镜像（`PLAYWRIGHT_DOWNLOAD_HOST`），仅在需要下载时使用。

## 配置变更

- `.env.local`：追加 `SESSION_SECRET`（缺失时）；沿用同一 AI 配置（与 Node 版一致）。
- 未修改系统 PATH 或全局安全策略；命令通过 `.tools\run-py.cmd`（uv 包装）运行。

## 验证证据

- `uv sync` 退出码 0，生成 `uv.lock`。
- `uv run python -c "import app.main"` 成功；`api/health` 返回 `ok=true, app=OnlyPhoto`。
- 页面冒烟 12 项全部 200；E2E 11/11 通过。
- `scripts/bootstrap.ps1` 幂等（复用 uv/Python，不覆盖数据）。

## 未能自动解决

- 无阻断性环境问题。
- Python Playwright 浏览器未单独下载（复用了 Node 版共享缓存以满足 E2E）；不影响功能。