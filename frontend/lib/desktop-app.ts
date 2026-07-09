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

export type DesktopAppBridge = {
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  quit: () => Promise<void>;
  restart: () => Promise<void>;
  getWindowState: () => Promise<DesktopWindowState>;
  getDisplaySettings: () => Promise<DesktopDisplaySettings>;
  saveDisplaySettings: (settings: DesktopDisplaySettings) => Promise<DesktopDisplaySettings>;
  getDisplaySettingsState: () => Promise<DesktopDisplaySettingsState>;
  previewDisplaySettings: (settings: DesktopDisplaySettings) => Promise<DesktopDisplaySettingsState>;
  confirmDisplaySettings: () => Promise<DesktopDisplaySettingsState>;
  rollbackDisplaySettings: () => Promise<DesktopDisplaySettingsState>;
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
