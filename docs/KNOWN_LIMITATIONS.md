# 已知限制（Python 版）

- 仅在 Windows 11 上实际验证；无 macOS/Linux 启动脚本。
- 地图使用 OpenStreetMap 标准瓦片，仅限本地/低流量演示，不适用于高并发生产。
- 编辑功能限于裁切、曝光、对比度、饱和度、暖冷倾向；暖冷为站点近似效果。
- 服务端渲染 + 原生 JS：与 Node 版行为等价，但浏览器仍需 JavaScript（地图、图像编辑），这与 Node 版一致。
- 数据库为本地 SQLite 单实例；多实例/高并发需更换存储方案。
- 真实接口的计费金额未从供应商控制台获取（未取得费用数据）；`live_budget` 仅为请求次数预算。
- `tests/e2e`（pytest + Python Playwright）已提供但本次以 Node Playwright 脚本运行同一批场景以避免重复下载浏览器；如需纯 Python 运行，执行 `uv run playwright install chromium` 后 `uv run python -m pytest tests/e2e`。
- 未做公开部署、未开通付费服务、未推送至除本分支外的远端。
- 样式复用 Node 版 Tailwind 构建产物 `app.css`：若后续新增模板类名，需要回 Node 侧重新生成或补充等价 CSS。