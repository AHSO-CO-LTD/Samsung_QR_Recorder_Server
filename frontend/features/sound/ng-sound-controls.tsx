"use client";

import { useRef, useState } from "react";
import { Music2, Play, RotateCcw, Upload, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { playNgSound, stopActiveNgSound, updateActiveNgSoundVolume } from "@/features/sound/ng-sound-player";
import {
  clearCustomNgSound,
  DEFAULT_NG_SOUND_FILE_NAME,
  MAX_CUSTOM_NG_SOUND_BYTES,
  saveCustomNgSound
} from "@/features/sound/ng-sound-settings";
import { useNgSoundSettings } from "@/features/sound/use-ng-sound-settings";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

export function NgSoundControls({ className }: { className?: string }) {
  const { t } = useI18n();
  const { settings, updateSettings } = useNgSoundSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const currentFileName = settings.source === "custom" ? settings.customFileName : DEFAULT_NG_SOUND_FILE_NAME;

  const toggleSound = () => {
    const enabled = !settings.enabled;
    updateSettings({ enabled });
    if (!enabled) {
      stopActiveNgSound();
    }
    toast.success(enabled ? t("ngSoundEnabledToast") : t("ngSoundMutedToast"));
  };

  const updateVolume = (volume: number) => {
    updateSettings({ volume });
    updateActiveNgSoundVolume(volume);
  };

  const selectSoundFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!isSupportedAudioFile(file)) {
      toast.error(t("ngSoundUnsupportedFile"));
      return;
    }
    if (file.size > MAX_CUSTOM_NG_SOUND_BYTES) {
      toast.error(t("ngSoundFileTooLarge"));
      return;
    }

    setIsSavingFile(true);
    const toastId = toast.loading(t("ngSoundSavingFile"));
    try {
      await saveCustomNgSound(file);
      updateSettings({
        source: "custom",
        customFileName: file.name
      });
      toast.success(t("ngSoundFileSelected", { name: file.name }), { id: toastId });
    } catch {
      toast.error(t("ngSoundSaveFailed"), { id: toastId });
    } finally {
      setIsSavingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const restoreDefaultSound = async () => {
    const toastId = toast.loading(t("ngSoundRestoringDefault"));
    try {
      await clearCustomNgSound();
      updateSettings({
        source: "default",
        customFileName: null
      });
      toast.success(t("ngSoundDefaultRestored"), { id: toastId });
    } catch {
      toast.error(t("ngSoundSaveFailed"), { id: toastId });
    }
  };

  const testSound = async () => {
    try {
      const didPlay = await playNgSound({ force: true });
      if (!didPlay) {
        toast.warning(t("ngSoundZeroVolume"));
        return;
      }
      toast.success(t("ngSoundTestStarted"));
    } catch {
      toast.error(t("ngSoundPlaybackFailed"));
    }
  };

  return (
    <div
      className={cn("flex h-9 shrink-0 items-center gap-1 rounded-md border bg-background px-1.5", className)}
      role="group"
      aria-label={t("ngSoundControls")}
    >
      <Button
        type="button"
        variant={settings.enabled ? "ghost" : "secondary"}
        size="icon"
        className="h-7 w-7"
        aria-label={settings.enabled ? t("ngSoundMute") : t("ngSoundEnable")}
        aria-pressed={!settings.enabled}
        title={settings.enabled ? t("ngSoundMute") : t("ngSoundEnable")}
        onClick={toggleSound}
      >
        {settings.enabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
      </Button>

      <Slider
        min={0}
        max={100}
        step={1}
        value={settings.volume}
        disabled={!settings.enabled}
        className="w-20 sm:w-24"
        aria-label={t("ngSoundVolume")}
        title={`${t("ngSoundVolume")}: ${settings.volume}%`}
        onChange={(event) => updateVolume(Number(event.target.value))}
      />
      <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
        {settings.volume}%
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isSavingFile}
            aria-label={t("ngSoundChooseFile")}
            title={`${t("ngSoundChooseFile")}: ${currentFileName}`}
          >
            <Music2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="truncate" title={currentFileName ?? undefined}>
            {currentFileName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void testSound()}>
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("ngSoundTest")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t("ngSoundChooseFile")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={settings.source === "default"} onSelect={() => void restoreDefaultSound()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("ngSoundUseDefault")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void selectSoundFile(event.target.files?.[0])}
      />
    </div>
  );
}

function isSupportedAudioFile(file: File) {
  if (file.type.startsWith("audio/")) {
    return true;
  }
  return /\.(wav|mp3|ogg|m4a|aac)$/i.test(file.name);
}
