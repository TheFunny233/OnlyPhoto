export type ApiError = { code: string; message: string };

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const err = (data as { error?: ApiError }).error;
    throw new ApiRequestError(response.status, err?.code ?? 'error', err?.message ?? `请求失败（${response.status}）`);
  }
  return data as T;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export function patchJson<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
}

export function putJson<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(body) });
}

export function del<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' });
}