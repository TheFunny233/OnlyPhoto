import { env } from '../env';
import { extractJsonObject } from './schema';
import { SYSTEM_PROMPT, buildUserPrompt, buildRepairPrompt } from './prompt';

export type AdapterInput = {
  imageBase64: string;
  mimeType: string;
  scene: string;
  goals: string[];
};

export type AdapterSuccess = {
  raw: unknown;
  providerRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
};

export type ProviderErrorKind =
  | 'config'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'network'
  | 'unsupported_image'
  | 'invalid_response';

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status?: number;
  retryable: boolean;
  constructor(kind: ProviderErrorKind, message: string, opts?: { status?: number; retryable?: boolean }) {
    super(message);
    this.kind = kind;
    this.status = opts?.status;
    this.retryable = opts?.retryable ?? false;
  }
}

export function validateBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderError('config', 'AI_BASE_URL 不是合法 URL');
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !isLocal) {
    throw new ProviderError('config', 'AI_BASE_URL 必须使用 https（本地开发除外）');
  }
  return url.toString().replace(/\/$/, '');
}

type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

async function callOnce(
  endpoint: string,
  input: AdapterInput,
  repair: boolean,
  attemptPrompt: string,
): Promise<AdapterSuccess> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ai.requestTimeoutMs);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: attemptPrompt },
        {
          type: 'image_url',
          image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
        },
      ] as ChatContentPart[],
    },
  ];

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: env.ai.visionModel,
        max_tokens: env.ai.maxOutputTokens,
        temperature: 0.3,
        ...(env.ai.disableThinking ? { enable_thinking: false } : {}),
        messages,
      }),
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError('timeout', `请求超时（${env.ai.requestTimeoutMs}ms）`, { retryable: true });
    }
    throw new ProviderError('network', `网络请求失败：${(error as Error).message}`, { retryable: true });
  }
  clearTimeout(timer);

  const requestId =
    response.headers.get('x-request-id') ??
    response.headers.get('x-dashscope-request-id') ??
    null;

  const text = await response.text();

  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const lower = text.toLowerCase();
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('auth', `鉴权失败（HTTP ${response.status}）`, { status: response.status });
    }
    if (response.status === 429) {
      throw new ProviderError('rate_limit', `触发限流（HTTP 429）${retryAfter ? `，建议等待 ${retryAfter}s` : ''}`, {
        status: 429,
        retryable: true,
      });
    }
    if (response.status >= 500) {
      throw new ProviderError('server', `供应商服务错误（HTTP ${response.status}）`, {
        status: response.status,
        retryable: true,
      });
    }
    if (lower.includes('image') && (lower.includes('support') || lower.includes('not supported') || lower.includes('invalid'))) {
      throw new ProviderError('unsupported_image', '该模型可能不支持图像输入', { status: response.status });
    }
    throw new ProviderError('invalid_response', `供应商返回错误（HTTP ${response.status}）：${text.slice(0, 300)}`, {
      status: response.status,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ProviderError('invalid_response', '供应商返回的响应不是 JSON', { retryable: false });
  }

  const obj = body as {
    id?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = obj.choices?.[0]?.message?.content;
  let contentText = '';
  if (typeof content === 'string') contentText = content;
  else if (Array.isArray(content)) {
    contentText = content
      .map((part) => (typeof part === 'string' ? part : typeof (part as { text?: string }).text === 'string' ? (part as { text: string }).text : ''))
      .join('');
  }

  if (!contentText.trim()) {
    throw new ProviderError('invalid_response', '供应商返回了空内容', { retryable: false });
  }

  let raw: unknown;
  try {
    raw = extractJsonObject(contentText);
  } catch (error) {
    throw new ProviderError('invalid_response', (error as Error).message, { retryable: false });
  }

  return {
    raw,
    providerRequestId: requestId ?? obj.id ?? null,
    inputTokens: obj.usage?.prompt_tokens ?? null,
    outputTokens: obj.usage?.completion_tokens ?? null,
    model: env.ai.visionModel,
  };
}

export async function analyzeWithProvider(input: AdapterInput): Promise<AdapterSuccess> {
  if (!env.ai.baseUrl) throw new ProviderError('config', '未配置 AI_BASE_URL');
  if (!env.ai.apiKey) throw new ProviderError('config', '未配置 AI_API_KEY');
  if (!env.ai.visionModel) throw new ProviderError('config', '未配置 AI_VISION_MODEL');

  const base = validateBaseUrl(env.ai.baseUrl);
  const endpoint = `${base}/chat/completions`;
  const userPrompt = buildUserPrompt(input.scene, input.goals);

  let lastError: unknown;
  const maxAttempts = env.ai.maxRetries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await callOnce(endpoint, input, false, userPrompt);
    } catch (error) {
      lastError = error;
      const providerError = error as ProviderError;
      if (!providerError.retryable) break;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  const providerError = lastError as ProviderError;
  if (providerError?.kind === 'invalid_response') {
    // one bounded repair attempt for malformed JSON
    try {
      return await callOnce(endpoint, input, true, buildRepairPrompt());
    } catch (repairError) {
      throw repairError;
    }
  }
  throw lastError;
}