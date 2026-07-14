export type RequestWithClientIp = {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
};

export function getClientIp(request: RequestWithClientIp) {
  const forwardedFor = request.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return normalizeClientIp(forwardedFor.split(",")[0]);
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]?.trim()) {
    return normalizeClientIp(forwardedFor[0].split(",")[0]);
  }

  const realIp = request.headers?.["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return normalizeClientIp(realIp);
  }

  if (Array.isArray(realIp) && realIp[0]?.trim()) {
    return normalizeClientIp(realIp[0]);
  }

  return normalizeClientIp(request.ip || request.socket?.remoteAddress || null);
}

function normalizeClientIp(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  return trimmed;
}
