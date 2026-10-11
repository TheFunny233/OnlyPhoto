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