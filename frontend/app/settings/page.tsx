"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";
import { AppearanceSettings } from "@/features/settings/appearance-settings";
import { LicenseSettings } from "@/features/settings/license-settings";
import { ServerSettingsForm } from "@/features/settings/server-settings-form";
import { UpdateSettings } from "@/features/settings/update-settings";
import { useI18n } from "@/lib/i18n-provider";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="appearance" className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="appearance">{t("appearanceTab")}</TabsTrigger>
          <TabsTrigger value="server">{t("serverTab")}</TabsTrigger>
          <TabsTrigger value="license">License</TabsTrigger>
          <TabsTrigger value="updates">Cập nhật</TabsTrigger>
          <TabsTrigger value="api">{t("apiTab")}</TabsTrigger>
        </TabsList>
        <PageGuideToolbar guideIds={["19-cai-dat-cap-nhat"]} />
      </div>

      <TabsContent value="appearance">
        <AppearanceSettings />
      </TabsContent>

      <TabsContent value="server">
        <ServerSettingsForm />
      </TabsContent>

      <TabsContent value="license">
        <LicenseSettings />
      </TabsContent>

      <TabsContent value="updates">
        <UpdateSettings />
      </TabsContent>

      <TabsContent value="api">
        <Card>
          <CardHeader>
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle className="truncate">{t("apiContract")}</CardTitle>
              <InfoTooltip content={t("apiContractDesc")} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                <span className="truncate">{t("duplicateWindow")}</span>
                <InfoTooltip content={t("duplicateRule")} />
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                <span className="truncate">{t("localNgLabel")}</span>
                <InfoTooltip content={t("localRule")} />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
