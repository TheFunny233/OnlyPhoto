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

12. **邻近排序测试不稳定**
    - 根因：共享测试库中多个机位使用同一坐标，距离均为 0。
    - 修复：测试改用远离公共坐标的独特经纬度。状态：已解决。