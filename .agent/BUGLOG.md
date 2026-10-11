# 缺陷日志（Python 重写）

1. **启动失败：`table analysis_jobs already exists`**
   - 根因：`migrations/` 仍含 Node 的 Drizzle 迁移（无 `IF NOT EXISTS`），在已有库上执行报错。
   - 修复：本分支移除 Node 迁移，仅保留幂等的 `0001_init.sql`。状态：已解决。

2. **机位详情页 500：`unsupported operand type(s) for /: 'str' and 'int'`**
   - 根因：`ts` 过滤器只接受 epoch 毫秒，而 `list_comments` 返回 ISO 字符串。
   - 修复：`localize_ms` 兼容 ISO 字符串与毫秒整数。状态：已解决。

3. **上传返回 400 `no_file`**
   - 根因：路由用 `fastapi.UploadFile` 做 `isinstance` 判断，而 `request.form()` 返回的是 `starlette.datastructures.UploadFile`（父类），判断失败。
   - 修复：改为 Starlette 的 `UploadFile` 类型判断。状态：已解决。

4. **工作台页 500（未分析时）**
   - 根因：模板中 `{% for f in (analysis.strengths + analysis.improvements) ... %}` 在 `analysis` 为 None 时求值失败。
   - 修复：外层加 `{% if analysis %}` 保护。状态：已解决。

5. **集成测试 `test_live_is_not_silently_mocked` 无法 monkeypatch**
   - 根因：`AiSettings` 为 frozen dataclass。
   - 修复：改为可变 dataclass（便于测试与运行时覆盖）。状态：已解决。

6. **发现页多出比例尺控件（与 Node 版不一致）**
   - 修复：移除 `L.control.scale`，保持视觉一致。状态：已解决。

7. **E2E 上传后未跳转（首轮）**
   - 根因：同 #3（400）。修复后 E2E 通过。状态：已解决。

8. **发现页筛选控件竖排（每个占一行）**
   - 根因：模板中筛选控件沿用了 `w-full`（表单默认），在 flex 中把每个控件撑满一行。
   - 修复：移除筛选控件的 `w-full`，保留 `max-w-*`。状态：已解决。

9. **列表卡片用 emoji（♥ ★ 💬）充当图标**
   - 根因：`explore.js` 动态渲染时图省事用了字符。
   - 修复：改为纯文本标签（点赞/收藏/评论/浏览），与 SVG 图标体系保持一致。状态：已解决。

10. **PowerShell 重写模板导致中文乱码**
    - 根因：用 `Get-Content -Raw`（PS5.1 默认 ANSI）读取 UTF-8 模板再写回，中文被固化为乱码。
    - 修复：改用 write 工具完整重建 `explore.html`，并加乱码扫描确认无残留。
    - 结论：**本项目禁止用 PowerShell 文本 cmdlet 改源码文件**（改用编辑工具）。状态：已解决。

11. **推荐在数据稀少时返回空**
    - 根因：池中唯一机位已被该用户互动，被“排除已互动”过滤后为空。
    - 修复：增加热度兜底（不足时用最热内容补齐），保证区块不为空。状态：已解决。

13. **高德地图中心经纬度传反（地图显示为极地空白）**
    - 现象：切到高德后容器与署名正常，但地图一片空白。
    - 根因：`map.js` 中 `toGcj(center[1], center[0])` 参数顺序错误（`options.center` 本就是 `[lng, lat]`），结果把经度当纬度 → 中心落到北极。
    - 修复：改为 `toGcj(center[0], center[1])`；验证中心回到上海（GCJ-02 121.4782, 31.2285），底图与 8 个标记正常显示。状态：已解决。

14. **相同图片内容复用时，新上传照片显示“未分析”**
    - 现象：上传与既有照片内容相同的图片，分析接口返回 `succeeded/reused`，但该照片详情页拿不到分析结果。
    - 根因：幂等键基于内容哈希，复用时返回的是**另一张照片**的 job；新照片没有自己的 job/result 记录，导致 `get_latest_succeeded_analysis(photo_id)` 查不到。
    - 修复：复用时若 `existing.photo_id != photo_id`，克隆一条 job + result 记录到当前照片（幂等键加 `#photo_id` 后缀）。验证：`detail analysis present: true`，核心 E2E 11/11。状态：已解决。

16. **点击标注框后气泡立即消失**
    - 现象：真实分析后点击图片上的高亮框，点评气泡一闪而过（最终仍为隐藏）。
    - 根因：气泡显示后，`focusFinding()` 内部用 `tabButton.click()` 切换分区，该**合成 click 冒泡到 document**，被“点击外部关闭气泡”的监听捕获并关闭。
    - 修复：抽出 `activateTab(key)` 直接切换分区样式，`focusFinding` 不再触发点击事件。验证：`popoverVisible: true`，内容正确。状态：已解决。

17. **演示模式给出 60 分评分**
    - 现象：初版 mock 输出固定 60 分，测试时看起来像对照片的真实评分。
    - 根因：mock 未识别图像却返回数字，易误导。
    - 修复：mock 的 `score` 改为 `null`，界面显示“演示模式不提供评分，配置真实模型后可获得”。状态：已解决。

19. **目标非空时工作台页面 500（模板过滤器缺失）**
    - 现象：真实分析（用户选择了目标）后打开工作台页面直接 500；演示模式（无目标）不受影响。
    - 根因：模板写成 `detail.analysisMeta.goals|map('goal_label')`，把**全局函数**当**过滤器**用，Jinja 抛 `No filter named 'goal_label'`。
    - 修复：将 `goal_label` / `scene_label` 同时注册为 Jinja filters（`app/templating.py`）。
    - 防回归：新增 `tests/integration/test_templates.py`，直接渲染 workbench/explore 模板（覆盖“目标非空”场景）。状态：已解决。

21. **E2E 偶发失败：发布页地图点选依赖外部高德服务**
    - 现象：`test_publish_and_community` 在发布步骤卡住（“下一步”未生效），因为地图点位未被选中。
    - 根因：测试服务器继承了 `.env.local` 的 `MAP_PROVIDER=amap`，AMap 是外部在线服务，加载时序/网络波动会让地图未就绪，点击无法触发选点。
    - 修复：`scripts/start_test_server.py` 显式设置 `MAP_PROVIDER=osm`，让自动化测试用本地优先的 Leaflet 渲染，与外部服务解耦（真实高德仍由 `amap-verify` 单独冒烟）。状态：已解决。

22. **verify 的 E2E 偶发失败：残留 uvicorn 进程**
    - 现象：单独跑 `pytest tests/e2e` 通过，但在 `verify` 中失败。
    - 根因：多轮 restart 留下未监听的 uvicorn 残留进程，端口/资源状态混乱。
    - 处理：清理残留进程后 `verify` 全绿。后续重启前先确认端口占用（`Get-NetTCPConnection -LocalPort 8000`）。状态：已解决。

23. **邻近排序测试不稳定**
    - 根因：共享测试库中多个机位使用同一坐标，距离均为 0。
    - 修复：测试改用远离公共坐标的独特经纬度。状态：已解决。