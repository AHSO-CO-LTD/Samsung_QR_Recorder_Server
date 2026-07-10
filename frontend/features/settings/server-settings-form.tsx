"use client";

import { FormEvent, useEffect, useState } from "react";
import type React from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut } from "@/lib/api";
import type { ServerSettings } from "@/features/shared/types";

const fallbackSettings = {
  factory_code_default: "DYS3",
  full_code_length_default: 35,
  full_vendor_position_default: 18,
  led_scan_length_default: 22,
  led_vendor_position_default: 16,
  duplicate_days: 31,
  heartbeat_timeout_seconds: 60
};

export function ServerSettingsForm() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void apiGet<ServerSettings>("/settings/server")
      .then((result) => {
        if (isMounted && result.data) {
          setSettings({
            factory_code_default: result.data.factory_code_default,
            full_code_length_default: result.data.full_code_length_default,
            full_vendor_position_default: result.data.full_vendor_position_default,
            led_scan_length_default: result.data.led_scan_length_default,
            led_vendor_position_default: result.data.led_vendor_position_default,
            duplicate_days: result.data.duplicate_days,
            heartbeat_timeout_seconds: result.data.heartbeat_timeout_seconds
          });
        }
      })
      .catch((currentError) => {
        const message = currentError instanceof Error ? currentError.message : "Không tải được settings.";
        if (isMounted) {
          setError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiPut("/settings/server", settings);
      toast.success("Đã lưu server settings.");
    } catch (currentError) {
      toast.error(currentError instanceof Error ? currentError.message : "Không lưu được settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Server settings</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">Đang tải dữ liệu...</div> : null}
        {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
        {!isLoading ? (
          <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={saveSettings}>
            <Field label="Factory code">
              <Input value={settings.factory_code_default} onChange={(event) => setSettings({ ...settings, factory_code_default: event.target.value })} />
            </Field>
            <Field label="Duplicate days">
              <Input type="number" min={1} value={settings.duplicate_days} onChange={(event) => setSettings({ ...settings, duplicate_days: Number(event.target.value) })} />
            </Field>
            <Field label="Full code length">
              <Input type="number" min={1} value={settings.full_code_length_default} onChange={(event) => setSettings({ ...settings, full_code_length_default: Number(event.target.value) })} />
            </Field>
            <Field label="Full vendor position">
              <Input type="number" min={1} value={settings.full_vendor_position_default} onChange={(event) => setSettings({ ...settings, full_vendor_position_default: Number(event.target.value) })} />
            </Field>
            <Field label="LED scan length">
              <Input type="number" min={1} value={settings.led_scan_length_default} onChange={(event) => setSettings({ ...settings, led_scan_length_default: Number(event.target.value) })} />
            </Field>
            <Field label="LED vendor position">
              <Input type="number" min={1} value={settings.led_vendor_position_default} onChange={(event) => setSettings({ ...settings, led_vendor_position_default: Number(event.target.value) })} />
            </Field>
            <Field label="Heartbeat timeout seconds">
              <Input type="number" min={1} value={settings.heartbeat_timeout_seconds} onChange={(event) => setSettings({ ...settings, heartbeat_timeout_seconds: Number(event.target.value) })} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "Đang lưu..." : "Lưu settings"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
