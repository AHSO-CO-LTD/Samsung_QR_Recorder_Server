import { toast } from "sonner";
import {
  DEFAULT_NG_SOUND_URL,
  loadCustomNgSound,
  readNgSoundSettings
} from "@/features/sound/ng-sound-settings";

export type ServerScanUpdatedEvent = {
  machine_code?: string;
  local_scan_id?: string;
  result_code?: string;
  final_status?: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING" | null;
  source?: "LIVE" | "BATCH";
  is_replay?: boolean;
};

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let lastPlaybackErrorAt = 0;
const seenScanEvents = new Set<string>();
const seenScanEventQueue: string[] = [];
const MAX_SEEN_SCAN_EVENTS = 500;

export async function playNgSound(options: { force?: boolean } = {}) {
  const settings = readNgSoundSettings();
  if ((!settings.enabled && !options.force) || settings.volume <= 0) {
    return false;
  }

  stopActiveNgSound();
  let sourceUrl = DEFAULT_NG_SOUND_URL;
  let objectUrl: string | null = null;

  if (settings.source === "custom") {
    const storedSound = await loadCustomNgSound();
    if (storedSound?.blob) {
      objectUrl = URL.createObjectURL(storedSound.blob);
      sourceUrl = objectUrl;
    }
  }

  const audio = new Audio(sourceUrl);
  activeAudio = audio;
  activeObjectUrl = objectUrl;
  audio.preload = "auto";
  audio.volume = settings.volume / 100;
  const clearAudio = () => clearAudioInstance(audio, objectUrl);
  audio.addEventListener("ended", clearAudio, { once: true });
  audio.addEventListener("error", clearAudio, { once: true });
  try {
    await audio.play();
  } catch (error) {
    clearAudio();
    throw error;
  }
  return true;
}

export function stopActiveNgSound() {
  const audio = activeAudio;
  const objectUrl = activeObjectUrl;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  clearAudioInstance(audio, objectUrl);
}

export function updateActiveNgSoundVolume(volume: number) {
  if (activeAudio) {
    activeAudio.volume = Math.min(1, Math.max(0, volume / 100));
  }
}

export function handleNgSoundScanEvent(payload: unknown, playbackErrorMessage: string) {
  const event = normalizeScanUpdatedEvent(payload);
  const eventIdentity = getScanEventIdentity(event);
  if (!shouldPlayNgSound(event) || isSeenScanEvent(eventIdentity)) {
    return;
  }

  rememberScanEvent(eventIdentity);
  void playNgSound().catch(() => {
    const now = Date.now();
    if (now - lastPlaybackErrorAt >= 10_000) {
      lastPlaybackErrorAt = now;
      toast.error(playbackErrorMessage);
    }
  });
}

function normalizeScanUpdatedEvent(payload: unknown): ServerScanUpdatedEvent {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload as ServerScanUpdatedEvent;
}

function shouldPlayNgSound(event: ServerScanUpdatedEvent) {
  const isNg = event.final_status === "NG" || event.final_status === "NG_REWORK" || event.result_code === "LOCAL_NG_SAVED" || event.result_code === "SERVER_DUPLICATE";
  return isNg && event.source !== "BATCH" && event.is_replay !== true;
}

function getScanEventIdentity(event: ServerScanUpdatedEvent) {
  if (!event.local_scan_id) {
    return undefined;
  }
  return `${event.machine_code ?? "unknown"}:${event.local_scan_id}`;
}

function isSeenScanEvent(eventIdentity?: string) {
  return Boolean(eventIdentity && seenScanEvents.has(eventIdentity));
}

function rememberScanEvent(eventIdentity?: string) {
  if (!eventIdentity || seenScanEvents.has(eventIdentity)) {
    return;
  }

  seenScanEvents.add(eventIdentity);
  seenScanEventQueue.push(eventIdentity);
  if (seenScanEventQueue.length > MAX_SEEN_SCAN_EVENTS) {
    const oldestEventIdentity = seenScanEventQueue.shift();
    if (oldestEventIdentity) {
      seenScanEvents.delete(oldestEventIdentity);
    }
  }
}

function clearAudioInstance(audio: HTMLAudioElement | null, objectUrl: string | null) {
  if (activeAudio === audio) {
    activeAudio = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
  if (activeObjectUrl === objectUrl) {
    activeObjectUrl = null;
  }
}
