"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceSettings } from "@/features/settings/appearance-settings";
import { ServerSettingsForm } from "@/features/settings/server-settings-form";
import { UpdateSettings } from "@/features/settings/update-settings";
import { useI18n } from "@/lib/i18n-provider";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="appearance" className="min-w-0 space-y-4">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="appearance">{t("appearanceTab")}</TabsTrigger>
        <TabsTrigger value="server">{t("serverTab")}</TabsTrigger>
        <TabsTrigger value="updates">Cập nhật</TabsTrigger>
        <TabsTrigger value="api">{t("apiTab")}</TabsTrigger>
      </TabsList>

      <TabsContent value="appearance">
        <AppearanceSettings />
      </TabsContent>

      <TabsContent value="server">
        <ServerSettingsForm />
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
            <a href="http://127.0.0.1:3979/api/docs" target="_blank" rel="noreferrer">
              <Button className="w-full">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("openSwagger")}
              </Button>
            </a>
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
