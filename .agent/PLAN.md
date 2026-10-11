# Python 重写执行计划

目标：在 `python-rewrite` 分支用 Python 重写 PhotoMaster，功能与 Node 版等价，uv 管理依赖，完成后 push。

## 里程碑与结果

| 阶段 | 任务 | 结果 | 证据 |
|---|---|---|---|
| P0 环境 | 安装 uv、uv 管理 Python 3.12、`uv sync` | 完成 | `docs/ENVIRONMENT.md`、`artifacts/environment.json` |
| P1 骨架 | 配置、数据库与迁移、安全、路由骨架、模板基座 | 完成 | 服务启动、`/api/health` 200 |
| P2 页面 | 全部 12 个页面服务端渲染（复用同一份 CSS） | 完成 | `artifacts/screenshots/python/`（与 Node 版一致） |
| P3 纵向切片 | 认证、上传、mock 分析、编辑预览/导出 | 完成 | E2E T01/T02/T05/T10 |
| P4 地图与发布 | Leaflet 地图、机位发布、社区互动 | 完成 | E2E T15/T16/T19、截图 |
| P5 测试 | pytest 单元/集成 + 浏览器 E2E | 完成 | 38 + 11 通过 |
| P6 交付 | bootstrap/doctor/verify/test_live、文档、清理 Node 文件、push | 进行中 | 本文件、`docs/*` |

## 当前步骤

- 全部页面 200；E2E 11/11 通过；单元+集成 38 通过。
- 待办：清理 Node 专属文件、提交并推送分支。

## 恢复入口

`.tools\run-py.cmd run python scripts/verify.py` → `artifacts/verification.json`