# 环境记录

实际检测、安装与验证记录（不含任何密钥）。机器可读版本：`artifacts/environment.json`。

## 起始状态（M0 检测）

- 操作系统：Microsoft Windows 11 企业版 64 位。
- 初始 **未** 安装：`node`、`npm`、`pnpm`、`git`（PATH 中均不可用）。
- 已有：`.env.local`（含 AI 配置），空的 `.git/`，`.zhanlu/`。
- 网络：`nodejs.org` 与 `registry.npmjs.org` 可达（较慢）；`registry.npmmirror.com` 更快（约 0.3s 响应）。

## 安装结果（项目内，无需管理员权限）

| 工具 | 版本 | 位置 | 来源 |
|---|---|---|---|
| Node.js | v24.21.0 (LTS) | `.tools/node/` | nodejs.org 官方 win-x64 zip |
| npm | 11.19.0 | 随 Node | 同上 |
| pnpm | 12.11.2 | `.tools/npm-global/` | npm 全局（项目内前缀） |
| Playwright Chromium | 156.0.8078.4 | `%LOCALAPPDATA%\ms-playwright\chromium-1248` | npmmirror 二进制镜像 |

- npm registry：`.npmrc` 指向 `https://registry.npmmirror.com`（可信镜像，加快安装；锁文件锁定具体版本）。
- 原生模块：`better-sqlite3@13.0.3`、`sharp@0.35.5` 均安装成功并能实际加载（已运行内存库读写与图像编解码验证）。
- 未安装 `git`：本项目未进行任何提交/推送（任务书要求未经明确要求不得提交）。版本管理非本项目运行必需。

## 配置变更

- `.env.local`：追加生成的 `SESSION_SECRET`（缺失时），并追加 `AI_REQUEST_TIMEOUT_MS=90000`、`AI_MAX_IMAGE_EDGE=1024`、`AI_DISABLE_THINKING=true`（适配实测推理型模型）。**未覆盖任何已有键。**
- `pnpm-workspace.yaml`：`allowBuilds` 允许 `better-sqlite3`、`sharp`、`esbuild`、`unrs-resolver`、`@tailwindcss/oxide` 构建脚本。
- 未修改系统级 PATH 或全局安全策略；命令通过 `.tools\run.cmd` 或脚本内显式 PATH 运行。

## 验证证据

- `pnpm install` 退出码 0，生成 `pnpm-lock.yaml`。
- `better-sqlite3` 内存库建表/写入读取通过；`sharp` 生成并读取 JPEG 元数据通过。
- Playwright Chromium 实际启动并截图成功（`.tools/pw-smoke.png`）。
- `scripts/bootstrap.ps1` 重复执行退出码 0，复用已有环境且不覆盖数据（`artifacts/environment.json`）。
- `pnpm doctor` 关键检查全部 PASS。

## 未能自动解决的问题

- 无阻断性环境问题。
- 说明：`scripts/bootstrap.sh`（macOS/Linux）已提供但**未在本机执行**，不声称跨平台已验证。

## 恢复方法

- 重新准备环境：`powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`（幂等）。
- 自检：`.tools\run.cmd exec tsx scripts/doctor.ts`。