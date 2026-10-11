# Python 重写说明（等价性对照）

目标：在分支 `python-rewrite` 上，用 Python 重写 PhotoMaster，**保留全部功能、保持一模一样的行为与外观**，仅更换实现语言；依赖用 **uv** 管理。原 Node/Next.js 实现保留在 `main` 分支。

## 技术映射

| 关注点 | Node 版 | Python 版 | 等价性验证 |
|---|---|---|---|
| Web | Next.js App Router（React） | FastAPI + Jinja2 服务端渲染 + 原生 JS | 全部页面 SSR 返回 200；截图对比一致 |
| 依赖/版本 | pnpm | uv（`pyproject.toml`、`uv.lock`） | `uv sync` 成功；`uv.lock` 锁定版本 |
| 路由 | `src/app/**` | `app/routers/*` | 路径一一对应（见下表） |
| 数据库 | better-sqlite3 + Drizzle | 标准库 `sqlite3` + 幂等 SQL | 同 14 表与索引；**可共用同一 `data/photometer.db`** |
| 时间戳 | epoch 毫秒（integer） | epoch 毫秒（integer） | 同格式，互通 |
| 口令 | `crypto.scrypt`（`scrypt$N$r$p$salt$key`） | `hashlib.scrypt`（同格式、同 base64） | 单元测试 `test_interoperable_with_reference_format` |
| 图像 | sharp（EXIF 纠正、缩略图、AI 输入） | Pillow（`ImageOps.exif_transpose` 等） | `tests/unit/test_imaging.py`（方向、格式、拒绝、体积） |
| 编辑 | Canvas + `pixel.ts` | Canvas + `edit.js`（同公式）；服务端 `editmath.py` | `tests/unit/test_editmath.py`；E2E 导出像素变化 |
| AI | fetch + OpenAI 兼容 | httpx + OpenAI 兼容 | 同协议、同错误分类、同重试与修复、同 `live_budget` 账本 |
| 地图 | react-leaflet | 原生 Leaflet（同一瓦片 URL、署名、降级提示） | 截图含真实 OSM 瓦片与署名 |
| 样式 | Tailwind v4 `@theme` token | 复用 Node 构建产物 `app.css`（同一份类名） | 首页/发现页截图逐像素级一致 |

## 路由对照

| 路径 | Node 入口 | Python 入口 |
|---|---|---|
| `/` `/studio` `/studio/{id}` `/explore` `/spots/{id}` `/publish` `/me` `/settings` `/privacy` `/about` `/login` `/register` | `src/app/**/page.tsx` | `app/routers/pages.py` + `app/templates/*` |
| `/api/health` | `api/health` | `app/routers/health.py` |
| `/api/auth/{register,login,logout,session}` | `api/auth/*` | `app/routers/auth.py` |
| `/api/photos`（GET/POST）、`/api/photos/{id}`（GET/DELETE） | `api/photos/*` | `app/routers/photos.py` |
| `/api/photos/{id}/media`、`/api/spots/{id}/media/{mid}` | `api/.../media` | `app/routers/media.py` |
| `/api/photos/{id}/analysis` | `api/.../analysis` | `app/routers/analysis.py` |
| `/api/photos/{id}/recipe`（GET/PUT） | `api/.../recipe` | `app/routers/recipes.py` |
| `/api/spots`（GET/POST）、`/api/spots/{id}`（GET/PATCH/DELETE）、`like`、`favorite`、`comments` | `api/spots/*` | `app/routers/spots.py` |
| `/api/comments/{id}`（DELETE） | `api/comments/*` | `app/routers/comments.py` |
| `/api/reports`（POST） | `api/reports` | `app/routers/reports.py` |
| `/api/admin/reports`（GET/POST，维护令牌） | `api/admin/reports` | `app/routers/admin.py` |
| `/api/me`（GET） | `api/me` | `app/routers/me.py` |

## 行为一致性要点

- **真实 / 演示模式**：`AI_MODE=mock` 时结果标注“演示模式”，不假装识图；`live` 未配置时明确失败（集成测试 `test_live_is_not_silently_mocked`），绝不回退 mock。
- **任务状态机与幂等**：`queued → processing → succeeded | failed | canceled`；幂等键 = `sha256(contentHash|scene|goals|mode|provider|model|promptVersion)`；服务重启后回收超期 `processing`（`reap_stale_jobs`）。
- **预算**：`live_budget` 账本（taskId `photomaster-dev-run`）跨进程累计；用户日限 `AI_USER_DAILY_REQUEST_LIMIT`。
- **权限**：会话 Cookie（HttpOnly、SameSite=Lax、按 `APP_URL` 决定 Secure）、Origin 校验、上传/登录限流、所有权校验（越权返回 404）。
- **坐标与标注**：region 与 crop 均基于方向纠正后的规范化原图（0..1）；`normalize_crop` 丢弃越界/全图框选。
- **发布**：仅生成去元数据的公开派生图；不公开原图、EXIF 或私人分析。
- **样式与无障碍**：同一份 CSS token；跳转链接、alt、可访问名、AA 对比、reduced-motion、≥44px 触控目标。

## 共用同一数据库

两版使用相同表名、列名与索引，迁移均为幂等（`CREATE TABLE IF NOT EXISTS`）。因此 Python 版可直接打开 Node 版创建的 `data/photomaster.db`，已有用户、机位、分析结果继续可用；口令哈希格式相同，账号可跨版本登录。

## 未改变的部分

- 产品范围、页面结构、交互流程、文案、错误语义、预算与授权规则、演示数据标注、素材来源与许可说明，均与 Node 版一致。
- 浏览器端仍然需要 JavaScript（地图与图像编辑），这与 Node 版相同；本重写改变的是服务端与页面渲染语言。