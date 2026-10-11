# PhotoMaster（Python 版）

> 看懂这张照片，拍好下一张。

这是 **PhotoMaster 的 Python 重写版**：功能与 `main` 分支的 Node/Next.js 版**完全等价**（同样的页面、同样的 API 契约、同样的数据库 schema、同样的视觉风格），只是实现语言不同。依赖与 Python 版本由 **uv** 管理与锁定。

- 分支：`python-rewrite`（`main` 分支保留原 Node/Next.js 实现）
- 技术栈：Python 3.12 + FastAPI + Jinja2 + 原生 JS（Leaflet / Canvas）+ SQLite
- 等价性说明与对照：`docs/PYTHON_REWRITE.md`

## 快速开始

### 1. 环境自动准备（从“缺少 uv/Python”开始也行）

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

幂等：复用已有 uv/Python，**不会覆盖 `.env.local`、上传目录或数据库**；缺少 uv 时下载官方构建到项目内 `.tools/uv`，Python 由 uv 安装到 `.tools/python`。

### 2. 数据库与演示数据

```powershell
.tools\run-py.cmd run python scripts/migrate.py   # 应用迁移（幂等，可在已有数据库上运行）
.tools\run-py.cmd run python scripts/seed.py      # 幂等演示数据（APP_DEMO_MODE=false 时跳过）
```

### 3. 启动

```powershell
# 开发/本地运行
.tools\run-py.cmd run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 生产（单实例）
.tools\run-py.cmd run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

浏览器打开 `http://localhost:8000`；健康检查 `http://localhost:8000/api/health`。

> `.tools\run-py.cmd` 是项目内的 uv 包装脚本（自动设置 `UV_PYTHON_INSTALL_DIR` 与 `UV_CACHE_DIR`）。
> 也可在已配置 uv 的环境中直接使用 `uv run uvicorn app.main:app --port 8000`。

## 配置

复制 `.env.example` 为 `.env.local`（`bootstrap` 会在缺失时创建并生成 `SESSION_SECRET`）。

- 无 AI Key：保持 `AI_MODE=mock`，可完整演示流程（结果明确标注“演示模式”）。
- 有 AI Key：

```dotenv
AI_MODE=live
AI_BASE_URL=https://<host>/compatible-mode/v1
AI_API_KEY=<你的密钥>
AI_VISION_MODEL=<支持图片输入的模型 ID>
```

- 密钥仅服务端使用，不要写入浏览器可见位置。
- 推理型模型（如 Qwen3）建议 `AI_DISABLE_THINKING=true` 与更长 `AI_REQUEST_TIMEOUT_MS`。

## 测试

```powershell
.tools\run-py.cmd run python -m pytest tests/unit -q          # 单元（编辑像素、AI 校验、口令、图像）
.tools\run-py.cmd run python -m pytest tests/integration -q   # 集成（幂等、唯一约束、级联、预算、持久化）
.tools\run-py.cmd run python -m pytest tests/e2e -q           # 浏览器端到端（需 Playwright 浏览器）
.tools\run-py.cmd run python scripts/doctor.py                # 环境自检 -> artifacts/environment.json
.tools\run-py.cmd run python scripts/verify.py                # 本地质量门槛 -> artifacts/verification.json
.tools\run-py.cmd run python scripts/test_live.py             # 真实接口（需授权与预算）
```

浏览器 E2E 与 Node 版一致，覆盖：注册/登录/刷新/退出、上传与拒绝伪装类型、mock 分析四部分、编辑导出（像素确实变化）、发布机位、双用户点赞/收藏/评论与持久化、评论 XSS 不执行、越权 404。

## 社区功能（本轮增强）

- **发现**：关键词/作者搜索、城市与题材筛选、排序（最新/最热/讨论最多）、**离我最近**（定位 + 距离排序）、分页“加载更多”、卡片展示点赞/收藏/评论/浏览量。
- **互动**：机位点赞与收藏、一级评论 + **二级回复**、**评论点赞**、删除自己的评论、举报。
- **作者**：关注/取消关注；用户主页 `/u/{userId}` 展示机位与获赞、获收藏、粉丝数。
- **推荐**：首页/发现/详情页的**猜你喜欢**（基于题材、城市、作者偏好，带多样性约束与热度兜底）。
- **关注流**：发现页“关注的人”，只看你关注的作者发布。
- **通知**：被点赞/收藏/评论/回复/关注时生成站内通知，导航铃铛显示未读数，`/notifications` 支持全部标记已读。
- **浏览量**：机位详情按访问者去重计数。
- **分享**：机位详情可分享链接（Web Share 或复制链接）。

设计与数据模型见 `docs/COMMUNITY.md`。

## 地图提供方（高德 / OpenStreetMap）

- 配置 `AMAP_JS_KEY`（可选 `AMAP_SECURITY_CODE`）即自动使用**高德地图**；未配置时使用 OpenStreetMap（Leaflet）。也可用 `MAP_PROVIDER=amap|osm` 显式指定。
- 数据库统一存储 **WGS84**；高德使用 GCJ-02，前端渲染与点选自动双向转换（`app/geo.py`、`app/static/js/coord.js`），切换底图不会造成点位漂移。
- 高德 Key 只写入本地 `.env.local`（例如 `AMAP_JS_KEY=...`），**不要提交**；写入后重启服务生效。若配置为高德但加载失败，会自动回退 OSM 并提示。

## 与 Node 版的对应关系

| 关注点 | Node 版（main） | Python 版（本分支） |
|---|---|---|
| Web 框架 | Next.js App Router | FastAPI + Jinja2（服务端渲染 + 原生 JS） |
| 依赖管理 | pnpm | **uv**（`pyproject.toml` + `uv.lock`） |
| 数据库 | better-sqlite3 + Drizzle | 标准库 `sqlite3` + 幂等 SQL 迁移（同 14 表 schema，**可共用同一数据库文件**） |
| 图像 | sharp | Pillow |
| 口令 | Node `crypto.scrypt` | `hashlib.scrypt`（**同格式，哈希可互通**） |
| AI | fetch + OpenAI 兼容 | httpx + OpenAI 兼容（同协议、同失败语义、同预算账本 `live_budget`） |
| 地图 | react-leaflet | 原生 Leaflet（同一份瓦片地址、署名与降级提示） |
| 编辑 | Canvas + 共享像素函数 | Canvas + 同一套像素算法（JS 与 Python 各一份，公式一致） |
| 样式 | Tailwind v4 token | 复用同一份已构建 CSS（`app/static/app.css`），视觉一致 |

## 数据

- SQLite：`./data/photomaster.db`；上传：`./data/uploads/`（私有原图、缩略图、AI 输入、公开派生图）。
- 备份/恢复：停止服务后复制或还原 `data/` 目录。
- 部署需要持久磁盘；无持久盘的 serverless 环境不会保存数据。

## 限制

见 `docs/KNOWN_LIMITATIONS.md`。要点：仅 Windows 实测；地图为 OSM 标准瓦片（本地/低流量）；编辑限于文档规定的五类；未做公开部署。