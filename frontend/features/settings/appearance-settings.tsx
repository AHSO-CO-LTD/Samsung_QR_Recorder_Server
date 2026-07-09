"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Expand, Languages, MonitorUp, Moon, Pin, Save, Square, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getDesktopApp,
  type DesktopDisplaySettings,
  type DesktopDisplaySettingsState,
  type DisplayMode,
  type WindowResolutionPreset
} from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

const defaultDisplaySettings: DesktopDisplaySettings = {
  mode: "windowed",
  resolution: "1440x900",
  alwaysOnTop: false
};

const displayModeOptions: {
  value: DisplayMode;
  labelKey: "windowModeWindowed" | "windowModeFullscreen" | "windowModeBorderless";
  tooltipKey: "windowModeWindowedTip" | "windowModeFullscreenTip" | "windowModeBorderlessTip";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}[] = [
  { value: "windowed", labelKey: "windowModeWindowed", tooltipKey: "windowModeWindowedTip", icon: Square },
  { value: "fullscreen", labelKey: "windowModeFullscreen", tooltipKey: "windowModeFullscreenTip", icon: Expand },
  { value: "borderless", labelKey: "windowModeBorderless", tooltipKey: "windowModeBorderlessTip", icon: MonitorUp }
];

const resolutionOptions: WindowResolutionPreset[] = [
  "1280x720",
  "1280x1080",
  "1366x768",
  "1440x900",
  "1600x900",
  "1680x1050",
  "1920x1080"
];

const displayModeIcons = displayModeOptions.reduce(
  (icons, option) => ({
    ...icons,
    [option.value]: option.icon
  }),
  {} as Record<DisplayMode, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>
);

export function AppearanceSettings() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [savedDisplaySettings, setSavedDisplaySettings] = useState<DesktopDisplaySettings>(defaultDisplaySettings);
  const [draftDisplaySettings, setDraftDisplaySettings] = useState<DesktopDisplaySettings>(defaultDisplaySettings);
  const [pendingDisplayConfirmation, setPendingDisplayConfirmation] = useState<{
    previousSettings: DesktopDisplaySettings;
    confirmationDeadline: number;
  } | null>(null);
  const [confirmationSeconds, setConfirmationSeconds] = useState(5);
  const [isLoadingDisplaySettings, setIsLoadingDisplaySettings] = useState(true);
  const [isSavingDisplaySettings, setIsSavingDisplaySettings] = useState(false);
  const rollbackInProgressRef = useRef(false);

  useEffect(() => {
    const desktopApp = getDesktopApp();
    if (!desktopApp) {
      setIsLoadingDisplaySettings(false);
      return;
    }

    let isMounted = true;

    const loadDisplaySettings =
      typeof desktopApp.getDisplaySettingsState === "function"
        ? desktopApp.getDisplaySettingsState()
        : desktopApp.getDisplaySettings().then((settings) => toDisplaySettingsState(settings));

    void loadDisplaySettings
      .then((state) => {
        if (!isMounted) {
          return;
        }
        syncDisplaySettingsState(state);
      })
      .catch(() => {
        if (isMounted) {
          toast.error(t("desktopActionFailed"));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDisplaySettings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const isFullscreen = draftDisplaySettings.mode === "fullscreen";
  const hasPendingDisplayConfirmation = Boolean(pendingDisplayConfirmation);
  const hasDisplayChanges = !areDisplaySettingsEqual(savedDisplaySettings, draftDisplaySettings);
  const isDisplayControlDisabled = isLoadingDisplaySettings || isSavingDisplaySettings || hasPendingDisplayConfirmation;

  useEffect(() => {
    if (!pendingDisplayConfirmation) {
      return;
    }

    const tick = () => {
      const nextSeconds = Math.max(0, Math.ceil((pendingDisplayConfirmation.confirmationDeadline - Date.now()) / 1000));
      setConfirmationSeconds(nextSeconds);
      if (nextSeconds <= 0) {
        void rollbackDisplaySettings(false);
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [pendingDisplayConfirmation?.confirmationDeadline]);

  const syncDisplaySettingsState = (state: DesktopDisplaySettingsState) => {
    setDraftDisplaySettings(state.settings);
    if (state.previousSettings && state.confirmationDeadline) {
      setSavedDisplaySettings(state.previousSettings);
      setPendingDisplayConfirmation({
        previousSettings: state.previousSettings,
        confirmationDeadline: state.confirmationDeadline
      });
      return;
    }

    setSavedDisplaySettings(state.settings);
    setPendingDisplayConfirmation(null);
  };

  const updateDisplayDraft = (settings: Partial<DesktopDisplaySettings>) => {
    setDraftDisplaySettings((current) => ({ ...current, ...settings }));
  };

  const saveDisplaySettings = async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp) {
      toast.warning(t("desktopActionUnavailable"));
      return;
    }

    setIsSavingDisplaySettings(true);
    try {
      if (typeof desktopApp.previewDisplaySettings !== "function") {
        const settings = await desktopApp.saveDisplaySettings(draftDisplaySettings);
        syncDisplaySettingsState(toDisplaySettingsState(settings));
        toast.success(t("windowSettingSaved"));
        return;
      }

      const state = await desktopApp.previewDisplaySettings(draftDisplaySettings);
      syncDisplaySettingsState(state);
      toast.success(t("windowSettingPreview"));
    } catch {
      toast.error(t("desktopActionFailed"));
    } finally {
      setIsSavingDisplaySettings(false);
    }
  };

  const confirmDisplaySettings = async () => {
    const desktopApp = getDesktopApp();
    if (!desktopApp) {
      toast.warning(t("desktopActionUnavailable"));
      return;
    }

    setIsSavingDisplaySettings(true);
    try {
      if (typeof desktopApp.confirmDisplaySettings !== "function") {
        syncDisplaySettingsState(toDisplaySettingsState(draftDisplaySettings));
        return;
      }

      const state = await desktopApp.confirmDisplaySettings();
      syncDisplaySettingsState(state);
      toast.success(t("windowSettingConfirmed"));
    } catch {
      toast.error(t("desktopActionFailed"));
    } finally {
      setIsSavingDisplaySettings(false);
    }
  };

  const rollbackDisplaySettings = async (showToast = true) => {
    if (rollbackInProgressRef.current) {
      return;
    }

    const desktopApp = getDesktopApp();
    if (!desktopApp) {
      toast.warning(t("desktopActionUnavailable"));
      return;
    }

    rollbackInProgressRef.current = true;
    setIsSavingDisplaySettings(true);
    try {
      if (typeof desktopApp.rollbackDisplaySettings !== "function") {
        syncDisplaySettingsState(toDisplaySettingsState(pendingDisplayConfirmation?.previousSettings ?? savedDisplaySettings));
        return;
      }

      const state = await desktopApp.rollbackDisplaySettings();
      syncDisplaySettingsState(state);
      if (showToast) {
        toast.success(t("windowSettingRolledBack"));
      }
    } catch {
      toast.error(t("desktopActionFailed"));
    } finally {
      rollbackInProgressRef.current = false;
      setIsSavingDisplaySettings(false);
    }
  };

  const applyTheme = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    toast.success(nextTheme === "dark" ? t("dark") : t("light"));
  };

  const applyLocale = (nextLocale: "vi" | "en") => {
    setLocale(nextLocale);
    toast.success(nextLocale === "vi" ? t("vietnamese") : t("english"));
  };

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-col items-stretch justify-between gap-4 space-y-0 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="truncate">{t("windowControls")}</CardTitle>
            <InfoTooltip content={t("windowControlsDesc")} />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void saveDisplaySettings()}
            disabled={isDisplayControlDisabled || !hasDisplayChanges}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSavingDisplaySettings ? t("saving") : t("save")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <TooltipProvider delayDuration={180}>
            <SettingBlock icon={MonitorUp} title={t("windowDisplayMode")} description={t("windowDisplayModeDesc")}>
              <DisplayDropdown
                label={t(getDisplayModeOption(draftDisplaySettings.mode).labelKey)}
                tooltip={t(getDisplayModeOption(draftDisplaySettings.mode).tooltipKey)}
                icon={displayModeIcons[draftDisplaySettings.mode]}
                disabled={isDisplayControlDisabled}
              >
                <DropdownMenuRadioGroup
                  value={draftDisplaySettings.mode}
                  onValueChange={(value) => updateDisplayDraft({ mode: value as DisplayMode })}
                >
                  {displayModeOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DisplayDropdown>
            </SettingBlock>

            <SettingBlock
              icon={MonitorUp}
              title={t("windowResolution")}
              description={isFullscreen ? t("windowResolutionLocked") : t("windowResolutionDesc")}
            >
              <DisplayDropdown
                label={draftDisplaySettings.resolution}
                tooltip={isFullscreen ? t("windowResolutionLocked") : draftDisplaySettings.resolution}
                disabled={isDisplayControlDisabled || isFullscreen}
              >
                <DropdownMenuRadioGroup
                  value={draftDisplaySettings.resolution}
                  onValueChange={(value) => updateDisplayDraft({ resolution: value as WindowResolutionPreset })}
                >
                  {resolutionOptions.map((resolution) => (
                    <DropdownMenuRadioItem key={resolution} value={resolution}>
                      {resolution}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DisplayDropdown>
            </SettingBlock>

            <div
              className={cn(
                "flex items-center justify-between gap-4 rounded-md border p-3",
                isDisplayControlDisabled && "opacity-70"
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Pin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 items-center gap-2">
                  <span id="always-on-top-label" className="truncate text-sm font-medium">
                    {t("alwaysOnTop")}
                  </span>
                  <InfoTooltip content={t("alwaysOnTopDesc")} />
                </span>
              </span>
              <Checkbox
                aria-labelledby="always-on-top-label"
                checked={draftDisplaySettings.alwaysOnTop}
                disabled={isDisplayControlDisabled}
                onChange={(event) => updateDisplayDraft({ alwaysOnTop: event.target.checked })}
              />
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-0">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="truncate">{t("themeAndLanguage")}</CardTitle>
            <InfoTooltip content={t("themeAndLanguageDesc")} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingBlock icon={theme === "light" ? Sun : Moon} title={t("theme")} description={t("themeDesc")}>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant={theme === "light" ? "default" : "outline"} onClick={() => applyTheme("light")}>
                <Sun className="h-4 w-4" aria-hidden="true" />
                {t("light")}
              </Button>
              <Button type="button" variant={theme === "dark" ? "default" : "outline"} onClick={() => applyTheme("dark")}>
                <Moon className="h-4 w-4" aria-hidden="true" />
                {t("dark")}
              </Button>
            </div>
          </SettingBlock>

          <SettingBlock icon={Languages} title={t("language")} description={t("languageDesc")}>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant={locale === "vi" ? "default" : "outline"} onClick={() => applyLocale("vi")}>
                {t("vietnamese")}
              </Button>
              <Button type="button" variant={locale === "en" ? "default" : "outline"} onClick={() => applyLocale("en")}>
                {t("english")}
              </Button>
            </div>
          </SettingBlock>
        </CardContent>
      </Card>

      <Dialog open={hasPendingDisplayConfirmation} onOpenChange={(open) => !open && void rollbackDisplaySettings()}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-200">
              <MonitorUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>{t("displayConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("displayConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            {t("displayConfirmCountdown").replace("{seconds}", String(confirmationSeconds))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void rollbackDisplaySettings()} disabled={isSavingDisplaySettings}>
              {t("rollbackDisplaySettings")}
            </Button>
            <Button type="button" onClick={() => void confirmDisplaySettings()} disabled={isSavingDisplaySettings}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {t("keepDisplaySettings")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingBlock({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden={true} />
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          <InfoTooltip content={description} />
        </div>
      </div>
      {children}
    </section>
  );
}

function DisplayDropdown({
  icon: Icon,
  label,
  tooltip,
  disabled,
  children
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  tooltip: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-10 w-full justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden={true} /> : null}
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden={true} />
          </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function areDisplaySettingsEqual(left: DesktopDisplaySettings, right: DesktopDisplaySettings) {
  return left.mode === right.mode && left.resolution === right.resolution && left.alwaysOnTop === right.alwaysOnTop;
}

function toDisplaySettingsState(settings: DesktopDisplaySettings): DesktopDisplaySettingsState {
  return {
    settings,
    previousSettings: null,
    confirmationDeadline: null
  };
}

function getDisplayModeOption(mode: DisplayMode) {
  return displayModeOptions.find((option) => option.value === mode) ?? displayModeOptions[0];
}
