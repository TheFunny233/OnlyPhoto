# 架构说明

## 总览

单体全栈应用：Next.js 16（App Router）同时承载页面与 API 路由；SQLite 单实例本地部署；无独立后端服务。

```
浏览器
  ├─ 页面（React Server/Client Components，Apple 风格 token 化）
  ├─ 客户端地图（Leaflet，动态 import，ssr:false）
  └─ 客户端编辑（Canvas + 共享像素函数）
        │ fetch / form-data
        ▼
Next.js Route Handlers（/src/app/api/**）
  ├─ 认证与会话（scrypt 哈希 + 服务端会话 + HttpOnly Cookie）
  ├─ 图片导入（sharp：校验 / EXIF 方向纠正 / 缩略图 / AI 输入）
  ├─ AI 分析编排（幂等任务 / 预算 / schema 校验 / receipt）
  ├─ 机位与社区（点赞 / 收藏 / 评论 / 举报）
  └─ 媒体读取（所有权或“已发布”校验）
        ▼
SQLite（better-sqlite3 + Drizzle ORM，migrations/）
  + 私有上传目录 data/uploads/（原图、缩略图、AI 输入、公开派生图）
```

## 关键模块

| 路径 | 职责 |
|---|---|
| `src/lib/env.ts` | 集中环境配置与默认值；`AI_PROMPT_VERSION` |
| `src/lib/db/schema.ts` | 14 张表：users / sessions / photos / analysis_jobs / analysis_results / edit_recipes / spots / spot_media / likes / favorites / comments / reports / api_usage / live_budget |
| `src/lib/db/client.ts` | better-sqlite3 连接（WAL、外键开、busy_timeout），进程级缓存 |
| `src/lib/auth/*` | scrypt 口令哈希、服务端会话、Cookie 选项 |
| `src/lib/images/ingest.ts` | 魔数校验、HEIC 明确拒绝、像素上限、EXIF 旋转、缩略图、AI 输入压缩 |
| `src/lib/ai/adapter-openai.ts` | OpenAI 兼容 Chat Completions 适配、超时/重试/错误分类、SSRF 防护 |
| `src/lib/ai/analyze.ts` | 幂等键、任务状态机、用户日限与运行预算、schema 校验、服务端 receipt |
| `src/lib/ai/schema.ts` | zod 校验 + 规范化（坐标裁剪、数量上限、文本清理） |
| `src/lib/edit/pixel.ts` | 确定性像素处理（裁切→曝光→对比度→饱和度→暖冷） |
| `src/lib/services/*` | 照片、个人空间、机位与社区的业务查询 |
| `src/instrumentation.ts` | 服务启动自动迁移 |

## 任务状态机

`analysis_jobs.status`：`queued → processing → succeeded | failed | canceled`。
- 幂等键 = `sha256(contentHash | scene | goals | mode | provider | model | promptVersion)`，唯一索引保证不重复消耗。
- 服务重启后，`processing` 且超期（> 2×超时 + 30s）的任务会被标记 `failed`（可重试），不会永久卡住。
- 成功以“供应商有效响应 + 本地 schema 校验通过”为准，而非 HTTP 200。

## 数据隔离与公开

- 分析与编辑默认私有；`photos.privacy` 默认 `private`。
- 发布机位时生成**独立公开派生图**（去元数据的 JPEG），不暴露原图、EXIF、私人分析。
- 媒体读取：私有照片校验所有权；机位媒体仅当机位 `published` 时公开。

## 坐标与方向

- 标注/裁切坐标均基于**方向纠正后的规范化原图**（0..1）；展示层包裹容器与图像同宽高比，百分比坐标直接映射。
- 机位统一 **WGS84**，保留 `coord_system` 字段以便未来坐标转换。

## 可测试性

- 像素处理为纯函数，浏览器预览/导出与服务端测试共用。
- AI 适配器与供应商可替换；自动测试注入确定性 mock，真实测试单独命令运行。
- E2E 使用隔离数据库与上传目录，穿透真实后端。