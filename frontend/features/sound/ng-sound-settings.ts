export const DEFAULT_NG_SOUND_URL = "/sounds/ng-default.wav";
export const DEFAULT_NG_SOUND_FILE_NAME = "NG.wav";
export const MAX_CUSTOM_NG_SOUND_BYTES = 10 * 1024 * 1024;

export type NgSoundSettings = {
  enabled: boolean;
  volume: number;
  source: "default" | "custom";
  customFileName: string | null;
};

type StoredNgSound = {
  id: "current";
  blob: Blob;
  fileName: string;
  mimeType: string;
};

const SETTINGS_STORAGE_KEY = "qr-recorder-ng-sound-settings-v1";
const SETTINGS_CHANGE_EVENT = "qr-recorder-ng-sound-settings-changed";
const DATABASE_NAME = "qr-recorder-sound-assets";
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = "sounds";

export const defaultNgSoundSettings: NgSoundSettings = {
  enabled: true,
  volume: 100,
  source: "default",
  customFileName: null
};

export function readNgSoundSettings(): NgSoundSettings {
  if (typeof window === "undefined") {
    return defaultNgSoundSettings;
  }

  try {
    const rawValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return defaultNgSoundSettings;
    }

    const parsed = JSON.parse(rawValue) as Partial<NgSoundSettings>;
    return normalizeNgSoundSettings(parsed);
  } catch {
    return defaultNgSoundSettings;
  }
}

export function updateNgSoundSettings(nextSettings: Partial<NgSoundSettings>) {
  const settings = normalizeNgSoundSettings({
    ...readNgSoundSettings(),
    ...nextSettings
  });

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent<NgSoundSettings>(SETTINGS_CHANGE_EVENT, { detail: settings }));
  return settings;
}

export function subscribeNgSoundSettings(listener: (settings: NgSoundSettings) => void) {
  const handleSettingsChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail) {
      listener(normalizeNgSoundSettings(event.detail as Partial<NgSoundSettings>));
      return;
    }
    listener(readNgSoundSettings());
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      listener(readNgSoundSettings());
    }
  };

  window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
  window.addEventListener("storage", handleStorageChange);
  return () => {
    window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export async function saveCustomNgSound(file: File) {
  const database = await openSoundDatabase();
  const storedSound: StoredNgSound = {
    id: "current",
    blob: file,
    fileName: file.name,
    mimeType: file.type
  };

  await runSoundStoreRequest(database, "readwrite", (store) => store.put(storedSound));
}

export async function loadCustomNgSound() {
  const database = await openSoundDatabase();
  return runSoundStoreRequest<StoredNgSound | undefined>(database, "readonly", (store) => store.get("current"));
}

export async function clearCustomNgSound() {
  const database = await openSoundDatabase();
  await runSoundStoreRequest(database, "readwrite", (store) => store.delete("current"));
}

function normalizeNgSoundSettings(settings: Partial<NgSoundSettings>): NgSoundSettings {
  const volume = Number(settings.volume);
  const source = settings.source === "custom" && settings.customFileName ? "custom" : "default";

  return {
    enabled: settings.enabled !== false,
    volume: Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : defaultNgSoundSettings.volume,
    source,
    customFileName: source === "custom" ? settings.customFileName ?? null : null
  };
}

function openSoundDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        database.createObjectStore(OBJECT_STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Unable to open sound storage.")));
  });
}

function runSoundStoreRequest<T = undefined>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(OBJECT_STORE_NAME));
    let requestResult: T;
    request.addEventListener("success", () => {
      requestResult = request.result as T;
    });
    request.addEventListener("error", () => {
      database.close();
      reject(request.error ?? new Error("Unable to access sound storage."));
    });
    transaction.addEventListener("complete", () => {
      database.close();
      resolve(requestResult);
    });
    transaction.addEventListener("abort", () => {
      database.close();
      reject(transaction.error ?? new Error("Sound storage transaction was aborted."));
    });
  });
}
