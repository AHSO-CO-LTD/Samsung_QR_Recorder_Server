"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultNgSoundSettings,
  readNgSoundSettings,
  subscribeNgSoundSettings,
  updateNgSoundSettings,
  type NgSoundSettings
} from "@/features/sound/ng-sound-settings";

export function useNgSoundSettings() {
  const [settings, setSettings] = useState<NgSoundSettings>(defaultNgSoundSettings);

  useEffect(() => {
    setSettings(readNgSoundSettings());
    return subscribeNgSoundSettings(setSettings);
  }, []);

  const updateSettings = useCallback((nextSettings: Partial<NgSoundSettings>) => {
    setSettings(updateNgSoundSettings(nextSettings));
  }, []);

  return {
    settings,
    updateSettings
  };
}
