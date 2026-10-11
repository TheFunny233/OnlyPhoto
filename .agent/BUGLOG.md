# 缺陷日志

每条：现象 / 根因 / 修改 / 证据 / 状态。

1. **pnpm 安装报 `ERR_PNPM_IGNORED_BUILDS`**（esbuild、unrs-resolver）
   - 根因：pnpm 11+ 移除了 `onlyBuiltDependencies`，改用 `allowBuilds`。
   - 修改：`pnpm-workspace.yaml` 使用 `allowBuilds:` 映射。
   - 证据：`pnpm install` 退出码 0，`pnpm-lock.yaml` 生成。状态：已解决。

2. **`next build` 预渲染 `/publish` 失败**
   - 根因：客户端组件使用 `useSearchParams` 未包 `Suspense`。
   - 修改：`PublishInner` 包进 `<Suspense>`。
   - 证据：`next build` 退出码 0。状态：已解决。

3. **E2E 登录后会话丢失（`nav-me` 找不到）**
   - 根因：生产模式强制 `Secure` Cookie，测试服务器走 HTTP → 浏览器丢弃 Cookie。
   - 修改：`Secure` 依据 `APP_URL` 协议，`ALLOW_INSECURE_COOKIES` 可覆盖。
   - 证据：`core.spec.ts` T01 通过。状态：已解决。

4. **Turbopack 告警“动态文件系统访问导致追踪整个项目”**
   - 根因：动态 `fs` 路径导致静态分析保守追踪。
   - 修改：为相关 `path.join` 增加 `/* turbopackIgnore: true */`。
   - 证据：`next build` 无该告警。状态：已解决。

5. **评论排序在加入多条评论后不稳定**
   - 根因：同一毫秒 `createdAt` 使 `ORDER BY createdAt DESC` 结果不确定。
   - 修改：追加 `rowid DESC` 作为次序兜底。
   - 证据：`tests/integration/services.test.ts` “orders comments newest first” 通过。状态：已解决。

6. **登录/退出后顶部导航状态不刷新**
   - 根因：`useSession` 只在挂载时拉取一次，导航跨客户端路由常驻。
   - 修改：`useSession` 依赖 `usePathname()`，路由变化时重新拉取。
   - 证据：E2E T01 通过；导航正确。状态：已解决。

7. **真实视觉调用连续超时（约 90s 失败）**
   - 根因：`qwen3.8-max-0902` 为推理型模型，45s 超时过短，且大图 + 思考链耗时。
   - 修改：`AI_DISABLE_THINKING=true`、`AI_REQUEST_TIMEOUT_MS=90000`、`AI_MAX_IMAGE_EDGE=1024`。
   - 证据：3/3 分析成功（17–22s），`artifacts/test-results/live-ai.json`。状态：已解决。

8. **`bootstrap.ps1` 在 PowerShell 5.1 解析失败**
   - 根因：无 BOM 的 UTF-8 脚本被按 ANSI 读取，中文与 `…` 触发语法错误。
   - 修改：脚本改为纯 ASCII 文案。
   - 证据：`bootstrap.ps1` 退出码 0 且幂等。状态：已解决。

9. **测试服务器迁移步骤失败**
   - 根因：`spawnSync` 执行 `.cmd` 未启用 shell。
   - 修改：`shell: true`。
   - 证据：E2E WebServer 正常启动。状态：已解决。

10. **开发模式疑似未 hydrate（页面停在加载态）**
    - 根因：开发服务器 HMR WebSocket 握手失败（后台进程环境）造成的误导，非产品缺陷。
    - 处理：在生产模式复测，客户端请求/接口调用正常。
    - 证据：`diag.mjs` 生产模式显示 `/api/spots` 与 `/api/auth/session` 200。状态：已澄清。

11. **`tsc` 报 `Cannot find namespace 'sharp'`**
    - 根因：默认导入不携带命名空间类型。
    - 修改：`import sharp, { type Metadata } from 'sharp'`。
    - 证据：`tsc --noEmit` 退出码 0。状态：已解决。