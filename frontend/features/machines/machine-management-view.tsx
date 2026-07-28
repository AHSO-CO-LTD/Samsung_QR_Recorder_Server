"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuideLauncher } from "@/features/guides/guide-launcher";
import { MachinesView } from "@/features/machines/machines-view";
import { RuntimeView } from "@/features/runtime/runtime-view";
import { useI18n } from "@/lib/i18n-provider";
import { usePermissions } from "@/lib/permissions";

type MachineManagementTab = "machines" | "runtime";

export function MachineManagementView({ defaultTab = "machines" }: { defaultTab?: MachineManagementTab }) {
  const { t } = useI18n();
  const { canAccess, isLoading } = usePermissions();
  const canViewMachines = canAccess("machines");
  const canViewRuntime = canAccess("runtime");
  const [activeTab, setActiveTab] = useState<MachineManagementTab>(defaultTab);
  const visibleTab: MachineManagementTab =
    activeTab === "runtime" && canViewRuntime ? "runtime" : canViewMachines ? "machines" : "runtime";

  if (isLoading) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <Tabs value={visibleTab} onValueChange={(value) => setActiveTab(value as MachineManagementTab)} className="min-w-0">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TabsList aria-label={t("machines")}>
          {canViewMachines ? <TabsTrigger value="machines">{t("machineListTab")}</TabsTrigger> : null}
          {canViewRuntime ? <TabsTrigger value="runtime">{t("runtimeHistoryTab")}</TabsTrigger> : null}
        </TabsList>
        <GuideLauncher
          guideIds={visibleTab === "runtime" ? ["08-lich-su-van-hanh"] : ["06-quan-ly-may"]}
        />
      </div>
      {canViewMachines ? (
        <TabsContent value="machines">
          <MachinesView />
        </TabsContent>
      ) : null}
      {canViewRuntime ? (
        <TabsContent value="runtime">
          <RuntimeView />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
