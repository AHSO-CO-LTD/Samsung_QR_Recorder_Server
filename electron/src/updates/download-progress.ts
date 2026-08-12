export type UpdateProgressPhase = "preparing" | "downloading" | "installing";

export type UpdateDownloadProgress = {
  tagName: string;
  phase: UpdateProgressPhase;
  transferredBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number;
  percent: number | null;
};

export function buildUpdateDownloadProgress(input: {
  tagName: string;
  phase: UpdateProgressPhase;
  transferredBytes: number;
  totalBytes?: number | null;
  startedAt?: number;
  now?: number;
}): UpdateDownloadProgress {
  const transferredBytes = Math.max(0, input.transferredBytes);
  const totalBytes = typeof input.totalBytes === "number" && Number.isFinite(input.totalBytes) && input.totalBytes > 0 ? input.totalBytes : null;
  const elapsedMs = input.startedAt === undefined ? 0 : Math.max(0, (input.now ?? Date.now()) - input.startedAt);
  const bytesPerSecond = elapsedMs > 0 ? transferredBytes / (elapsedMs / 1000) : 0;
  const percent = totalBytes === null ? null : Math.min(100, Math.max(0, (transferredBytes / totalBytes) * 100));

  return {
    tagName: input.tagName,
    phase: input.phase,
    transferredBytes,
    totalBytes,
    bytesPerSecond: Number.isFinite(bytesPerSecond) ? bytesPerSecond : 0,
    percent
  };
}
