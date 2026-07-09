"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiGet, type ApiResult } from "@/lib/api";
import { type MessageKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-provider";

type ResourcePanelProps = {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  endpoint: string;
};

export function ResourcePanel({ titleKey, descriptionKey, endpoint }: ResourcePanelProps) {
  const { t } = useI18n();
  const [result, setResult] = useState<ApiResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet(endpoint);
      setResult(data);
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : t("error");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpoint]);

  const items = Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="truncate">{t(titleKey)}</CardTitle>
          <InfoTooltip content={t(descriptionKey)} />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("retry")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="min-w-0 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t("endpoint")}: <span className="font-mono">{endpoint}</span>
        </div>

        {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
        {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
        {!isLoading && !error && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div>
        ) : null}
        {!isLoading && !error && items.length > 0 ? (
          <div className="max-h-[520px] min-w-0 overflow-auto rounded-md border bg-background">
            <pre className="whitespace-pre-wrap break-words p-3 text-xs sm:p-4">{JSON.stringify(items, null, 2)}</pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
