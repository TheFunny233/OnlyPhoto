# AI 接口配置说明

## 你需要提供什么

- API Key
- 接口 Base URL（OpenAI 兼容端点）
- 支持图片输入的模型 ID
- 协议（默认 `chat_completions`）；如为 Responses 等原生协议需单独实现适配器
- 是否授权真实测试与请求上限

**不要把密钥写入聊天、文档、Git 或截图。** 密钥只放在被忽略的 `.env.local`。

## 环境变量

```dotenv
AI_MODE=live                 # mock | live
AI_PROTOCOL=chat_completions
AI_BASE_URL=https://<host>/compatible-mode/v1
AI_API_KEY=<服务端密钥>
AI_VISION_MODEL=<视觉模型 ID>
AI_REQUEST_TIMEOUT_MS=90000
AI_MAX_OUTPUT_TOKENS=1800
AI_MAX_RETRIES=1
AI_MAX_IMAGE_EDGE=1024
AI_MAX_IMAGE_BYTES=3000000
AI_USER_DAILY_REQUEST_LIMIT=10
AI_DISABLE_THINKING=true     # 关闭推理模型思考链（如 Qwen3）
RUN_LIVE_AI_TESTS=true
LIVE_TEST_MAX_REQUESTS=12
```

> `NEXT_PUBLIC_` 前缀会把变量暴露给浏览器。AI 配置**永远不要**加该前缀。

## 本项目实测配置（本地，非承诺）

- Base URL host：`llm-n6ek9ifblx1h1iov.cn-beijing.maas.aliyuncs.com`（OpenAI 兼容模式）
- 模型：`qwen3.8-max-0902`
- 该模型为推理型：需 `AI_DISABLE_THINKING=true` 与更长超时，否则 45s 内可能超时。

> 不同账号的地域地址与模型 ID 可能不同，请以你自己的控制台为准，不要照搬。

## 请求流程

1. 服务端将图片缩放到 `AI_MAX_IMAGE_EDGE`，编码为 JPEG，控制在 `AI_MAX_IMAGE_BYTES` 内。
2. 发送 `messages = [system, user(text + image_url:data URL)]`，`max_tokens = AI_MAX_OUTPUT_TOKENS`。
3. 解析 `choices[0].message.content` 为 JSON，经 zod 校验与规范化；不写入未通过校验的结果。
4. 记录服务端 `AnalysisReceipt`（mode/provider/model/promptVersion/requestId/tokens/imageHash/time）。

## 错误处理与重试

| 情况 | 行为 |
|---|---|
| 401/403 | 明确鉴权失败，不重试 |
| 429 | 遵守 `Retry-After`，计入预算后有限重试 |
| 部分 5xx / 网络 / 超时 | 有限重试（`AI_MAX_RETRIES`） |
| 模型不支持图片 | 返回 `unsupported_image` |
| JSON 不合法 | 一次有界修复请求；仍失败则记录失败，不伪造成功 |

失败会记录 `error_type`，前端展示明确错误与重试入口。**真实模式绝不回退到 mock。**

## 预算

- 运行预算：数据库账本 `live_budget`（taskId `onlyphoto-dev-run`），跨会话累计，不自动清零。
- 用户日限：`AI_USER_DAILY_REQUEST_LIMIT`。
- `pnpm test:live` 独立运行，未授权时报告 SKIPPED。

## 自助排错

- 先 `pnpm doctor` 查看 `mode / baseUrl / key / model` 是否就绪（不回显密钥）。
- 用最小化请求验证连通：GET `<AI_BASE_URL>/models`（鉴权探测通常不计费），确认模型 ID 存在。
- 超时：提高 `AI_REQUEST_TIMEOUT_MS`，或降低 `AI_MAX_IMAGE_EDGE`。