"use client";

import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";
import type { VirtualMachineRuntime } from "@/features/shared/virtual-machine-runtime";

export function DevVirtualMachineButton({
  onCreate,
  className,
  style
}: {
  onCreate: () => VirtualMachineRuntime;
  className?: string;
  style?: CSSProperties;
}) {
  const { user } = useAuth();
  const { t } = useI18n();

  if (user?.role !== "DEV") {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      className={className}
      style={style}
      onClick={() => {
        const created = onCreate();
        toast.success(t("virtualMachineCreated", { name: created.machine.machine_name }));
      }}
      title={t("createVirtualMachineDesc")}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span className="whitespace-nowrap">{t("createVirtualMachine")}</span>
    </Button>
  );
}
