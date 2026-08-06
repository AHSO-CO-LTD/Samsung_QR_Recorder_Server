const REWORK_LOCAL_SCAN_ID_PREFIX = "RW-";

export function getReworkSourceLocalScanId(localScanId: string) {
  const normalized = localScanId.trim();
  if (!normalized.startsWith(REWORK_LOCAL_SCAN_ID_PREFIX)) {
    return null;
  }

  const sourceLocalScanId = normalized.slice(REWORK_LOCAL_SCAN_ID_PREFIX.length).trim();
  return sourceLocalScanId && !sourceLocalScanId.startsWith(REWORK_LOCAL_SCAN_ID_PREFIX) ? sourceLocalScanId : null;
}

export function isNgFinalStatus(status: string | null | undefined) {
  return status === "NG" || status === "NG_REWORK";
}

export function canReworkNgSource(status: string | null | undefined) {
  return status === "NG";
}

export { REWORK_LOCAL_SCAN_ID_PREFIX };
