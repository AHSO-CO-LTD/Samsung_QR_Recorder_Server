export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3979/api";
const SESSION_STORAGE_KEY = "server-session-token";
const REMEMBER_STORAGE_KEY = "server-remember-token";

export type ApiResult<T = unknown> = {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  meta?: ApiPaginationMeta;
};

export type ApiPaginationMeta = {
  total?: number;
  take?: number;
  skip?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  has_previous?: boolean;
  has_next?: boolean;
};

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildAuthHeaders(),
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
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}

export async function apiPatch<T, TBody = unknown>(path: string, body: TBody): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}

export async function apiPut<T, TBody = unknown>(path: string, body: TBody): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}

export async function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
    cache: "no-store"
  });

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}

function buildAuthHeaders(baseHeaders: Record<string, string> = {}) {
  if (typeof window === "undefined") {
    return baseHeaders;
  }

  const token = window.localStorage.getItem(REMEMBER_STORAGE_KEY) || window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  return token
    ? {
        ...baseHeaders,
        Authorization: `Bearer ${token}`
      }
    : baseHeaders;
}
