export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3979/api";
const SESSION_STORAGE_KEY = "server-session-token";
const REMEMBER_STORAGE_KEY = "server-remember-token";
const DEFAULT_API_TIMEOUT_MS = 30_000;

export type ApiRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

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

export async function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    headers: buildAuthHeaders(),
    cache: "no-store"
  }, options);

  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok) {
    throw new Error(payload.message || `API request failed: ${response.status}`);
  }

  return payload;
}

export async function apiPost<T, TBody = unknown>(path: string, body: TBody): Promise<ApiResult<T>> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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

export async function apiDownloadBlob(path: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    headers: buildAuthHeaders(),
    cache: "no-store"
  }, { timeoutMs: 120_000 });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `API request failed: ${response.status}`);
  }

  return {
    blob: await response.blob(),
    fileName: getDownloadFileName(response.headers.get("content-disposition")) ?? "download.xlsx"
  };
}

async function fetchWithTimeout(input: string, init: RequestInit, options: ApiRequestOptions = {}) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS);
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`API không phản hồi trong ${Math.round(timeoutMs / 1000)} giây.`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
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

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Partial<ApiResult>;
      return payload.message;
    } catch {
      return undefined;
    }
  }

  return response.text();
}

function getDownloadFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? null;
}
