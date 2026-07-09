export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3979/api";

export type ApiResult<T = unknown> = {
  success: boolean;
  code: string;
  message: string;
  data?: T;
};

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}

export async function apiPost<T, TBody = unknown>(path: string, body: TBody): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}
