export type DisplayMode = "windowed" | "fullscreen" | "borderless";
export type WindowResolutionPreset =
  | "1280x720"
  | "1280x1080"
  | "1366x768"
  | "1440x900"
  | "1600x900"
  | "1680x1050"
  | "1920x1080";

export type DesktopDisplaySettings = {
  mode: DisplayMode;
  resolution: WindowResolutionPreset;
  alwaysOnTop: boolean;
};

export type DesktopDisplaySettingsState = {
  settings: DesktopDisplaySettings;
  previousSettings: DesktopDisplaySettings | null;
  confirmationDeadline: number | null;
};

export type DesktopWindowState = {
  width: number;
  height: number;
  displaySettings: DesktopDisplaySettings;
};

export type DesktopUpdateRelease = {
  version: string;
  tagName: string;
  name: string;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
  assetName: string;
  assetSize: number;
};

export type DesktopUpdateState = {
  success: boolean;
  currentVersion: string;
  repository: string;
  packaged: boolean;
  releases: DesktopUpdateRelease[];
  message: string;
};

export type DesktopLicensePayload = {
  lic_id?: string;
  customer_id?: string;
  project?: string;
  product?: string;
  purchased_version?: string;
  max_major?: number;
  update_until?: string | null;
  machine_id?: string;
  type?: string;
  expires_at?: string | null;
  features?: string[];
  issued_at?: string;
  edition?: string;
  v?: number;
  [key: string]: unknown;
};

export type DesktopLicenseStatus = {
  state: "active" | "unactivated" | "invalid";
  ok: boolean;
  machineId: string;
  product: string;
  version: string;
  releaseDate: string;
  licensePath: string;
  lic: DesktopLicensePayload | null;
  why: string | null;
};

export type DesktopLicenseRequestInfo = {
  license_request_format: "SAMSUNG_QR_SERVER_LICENSE_REQUEST_V1";
  product: string;
  machine_id: string;
  app_version: string;
  release_date: string;
  app_name: string;
  generated_at: string;
};

export type DesktopAppBridge = {
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  quit: () => Promise<void>;
  restart: () => Promise<void>;
  onCloseRequest?: (handler: () => void) => () => void;
  getWindowState: () => Promise<DesktopWindowState>;
  getDisplaySettings: () => Promise<DesktopDisplaySettings>;
  saveDisplaySettings: (settings: DesktopDisplaySettings) => Promise<DesktopDisplaySettings>;
  getDisplaySettingsState: () => Promise<DesktopDisplaySettingsState>;
  previewDisplaySettings: (settings: DesktopDisplaySettings) => Promise<DesktopDisplaySettingsState>;
  confirmDisplaySettings: () => Promise<DesktopDisplaySettingsState>;
  rollbackDisplaySettings: () => Promise<DesktopDisplaySettingsState>;
  updates: {
    check: () => Promise<DesktopUpdateState>;
    install: (tagName: string) => Promise<{ success: boolean; message: string }>;
  };
  license: {
    getStatus: () => Promise<DesktopLicenseStatus>;
    getRequestInfo: () => Promise<DesktopLicenseRequestInfo>;
    activate: (licenseString: string) => Promise<DesktopLicenseStatus>;
    clear: () => Promise<DesktopLicenseStatus>;
  };
};

declare global {
  interface Window {
    serverApp?: DesktopAppBridge;
  }
}

export function getDesktopApp() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.serverApp ?? null;
}
