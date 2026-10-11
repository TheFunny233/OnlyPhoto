# 决策记录（Python 重写）

- **FastAPI + Jinja2（服务端渲染）+ 原生 JS**：与 Next.js 的“页面 + API 路由”等价；地图与图像编辑本就需要浏览器 JS，与 Node 版一致。
- **uv 管理 Python 与依赖**：`uv python install` 使用 uv 管理的独立 CPython（项目内 `.tools/python`），`uv sync` + `uv.lock` 锁定依赖。
- **数据库用标准库 sqlite3 + 幂等 SQL 迁移**：不引入 ORM；与 Node/Drizzle 同 schema，且迁移幂等，可直接打开 Node 版数据库。
- **时间戳为 epoch 毫秒、口令为 `scrypt$N$r$p$salt$key`**：与 Node 版完全一致，实现数据库与账号跨版本互通。
- **样式复用 Node 构建产物 `app.css`**：模板沿用相同 Tailwind 类名，保证“一模一样”的视觉，不重复实现 Tailwind 工具链。
- **Pillow 替代 sharp**；**httpx 替代 fetch**；错误分类、重试、修复与预算语义保持一致。
- **同步端点（def）**：路由使用普通函数，由 Starlette 线程池执行，避免阻塞事件循环，并让同步 sqlite3 使用安全。
- **模板自动重载**：开发时修改模板可能需要重启服务（本项目在改动模板后重启验证）。
- **该分支移除 Node 专属文件**（src、package.json、next 配置、Drizzle 迁移与 Node 测试/脚本），以体现“用 Python 重写”；原实现保留在 `main` 分支。