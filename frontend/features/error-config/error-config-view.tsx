"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiPut } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { CheckboxField, SelectField, TextAreaField, TextInputField } from "@/features/shared/form-fields";
import { DataTablePanel, DateText, MonoText, type Column } from "@/features/shared/data-view";

type ErrorSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
type IdentificationFilter = "all" | "identified" | "unidentified";

type ErrorDefinition = {
  id: number;
  code: string;
  name_vi: string | null;
  name_en: string | null;
  group_name: string | null;
  severity: ErrorSeverity;
  default_message: string | null;
  local_action: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ErrorConfigItem = {
  code: string;
  identified: boolean;
  definition: ErrorDefinition | null;
  scan_count: number;
  led_count: number;
  occurrence_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

type ErrorDefinitionDraft = {
  name_vi: string;
  name_en: string;
  default_message: string;
  group_name: string;
  severity: ErrorSeverity;
  local_action: string;
  is_active: boolean;
};

const emptyDraft: ErrorDefinitionDraft = {
  name_vi: "",
  name_en: "",
  default_message: "",
  group_name: "",
  severity: "ERROR",
  local_action: "",
  is_active: true
};

export function ErrorConfigView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<ErrorConfigItem[]>([]);
  const [filter, setFilter] = useState<IdentificationFilter>("all");
  const [selectedItem, setSelectedItem] = useState<ErrorConfigItem | null>(null);
  const [draft, setDraft] = useState<ErrorDefinitionDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const canManage = user?.role === "ADMIN" || user?.role === "ENGINEER" || user?.role === "DEV";

  const captureItems = useCallback((data: ErrorConfigItem[]) => setItems(data), []);
  const counts = useMemo(
    () => ({
      total: items.length,
      identified: items.filter((item) => item.identified).length,
      unidentified: items.filter((item) => !item.identified).length
    }),
    [items]
  );

  const openDefinition = (item: ErrorConfigItem) => {
    if (!canManage) {
      return;
    }
    setSelectedItem(item);
    setDraft(
      item.definition
        ? {
            name_vi: item.definition.name_vi ?? "",
            name_en: item.definition.name_en ?? "",
            default_message: item.definition.default_message ?? "",
            group_name: item.definition.group_name ?? "",
            severity: item.definition.severity,
            local_action: item.definition.local_action ?? "",
            is_active: item.definition.is_active
          }
        : { ...emptyDraft }
    );
  };

  const saveDefinition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem) {
      return;
    }
    if (!draft.name_vi.trim()) {
      toast.warning(t("errorDefinitionRequired"));
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(t("saving"));
    try {
      await apiPut("/error-config", {
        code: selectedItem.code,
        name_vi: draft.name_vi,
        name_en: draft.name_en || null,
        default_message: draft.default_message || null,
        group_name: draft.group_name || null,
        severity: draft.severity,
        local_action: draft.local_action || null,
        is_active: draft.is_active
      });
      toast.success(t("errorDefinitionSaved"), { id: toastId });
      setSelectedItem(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errorDefinitionSaveFailed"), { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<ErrorConfigItem>[] = [
    { key: "code", header: t("errorCode"), className: "min-w-56", render: (item) => <MonoText value={item.code} /> },
    {
      key: "identified",
      header: t("errorIdentificationStatus"),
      className: "min-w-36",
      render: (item) => <IdentificationBadge identified={item.identified} active={item.definition?.is_active ?? false} />
    },
    {
      key: "nameVi",
      header: t("errorNameVi"),
      className: "min-w-64",
      render: (item) => item.definition?.name_vi || <span className="text-muted-foreground">-</span>
    },
    {
      key: "nameEn",
      header: t("errorNameEn"),
      className: "min-w-64",
      render: (item) => item.definition?.name_en || <span className="text-muted-foreground">-</span>
    },
    {
      key: "group",
      header: t("errorGroup"),
      className: "min-w-32",
      render: (item) => item.definition?.group_name || <span className="text-muted-foreground">-</span>
    },
    {
      key: "severity",
      header: t("errorSeverity"),
      className: "min-w-28",
      render: (item) => (item.definition ? <SeverityBadge severity={item.definition.severity} /> : <span className="text-muted-foreground">-</span>)
    },
    { key: "count", header: t("errorOccurrenceCount"), className: "w-28 text-right", render: (item) => <span className="font-mono text-xs">{item.occurrence_count}</span> },
    {
      key: "lastSeen",
      header: t("errorLastSeen"),
      className: "min-w-40",
      render: (item) => (item.last_seen_at ? <DateText value={item.last_seen_at} /> : <span className="text-muted-foreground">{t("errorNeverObserved")}</span>)
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: t("colActions"),
            className: "w-32 text-right",
            render: (item: ErrorConfigItem) => (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDefinition(item);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {item.identified ? t("edit") : t("configureError")}
                </Button>
              </div>
            )
          } satisfies Column<ErrorConfigItem>
        ]
      : [])
  ];

  return (
    <div className="min-w-0 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("errorConfigTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("errorConfigPageDesc")}</p>
      </header>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-y py-3 text-sm" aria-label={t("errorIdentificationStatus")}>
        <SummaryValue label={t("all")} value={counts.total} />
        <SummaryValue label={t("errorIdentified")} value={counts.identified} />
        <SummaryValue label={t("errorUnidentified")} value={counts.unidentified} emphasized={counts.unidentified > 0} />
      </div>

      <DataTablePanel
        title={t("errorConfigTitle")}
        endpoint={`/error-config?refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.code}
        onData={captureItems}
        onRowClick={canManage ? openDefinition : undefined}
        searchableText={(item) => item.code}
        searchPlaceholder={t("errorSearchPlaceholder")}
        emptyText={t("errorConfigEmpty")}
        filterItem={(item) => filter === "all" || (filter === "identified" ? item.identified : !item.identified)}
        pagination={{ pageSize: 25 }}
        toolbarContent={
          <div className="w-full sm:w-48">
            <SelectField label={t("errorFilterStatus")} value={filter} onChange={(event) => setFilter(event.target.value as IdentificationFilter)}>
              <option value="all">{t("all")}</option>
              <option value="identified">{t("errorIdentified")}</option>
              <option value="unidentified">{t("errorUnidentified")}</option>
            </SelectField>
          </div>
        }
      />

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("errorDefinitionDialogTitle")}</DialogTitle>
            <DialogDescription>{t("errorDefinitionDialogDesc", { code: selectedItem?.code ?? "" })}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveDefinition}>
            <TextInputField label={t("errorCode")} value={selectedItem?.code ?? ""} disabled className="font-mono" />
            <TextInputField
              required
              maxLength={240}
              label={t("errorNameVi")}
              value={draft.name_vi}
              onChange={(event) => setDraft({ ...draft, name_vi: event.target.value })}
            />
            <TextInputField
              maxLength={240}
              label={t("errorNameEn")}
              hint={t("errorNameEnHint")}
              value={draft.name_en}
              onChange={(event) => setDraft({ ...draft, name_en: event.target.value })}
            />
            <TextAreaField
              maxLength={500}
              label={t("errorDefaultMessage")}
              hint={t("errorDefaultMessageHint")}
              value={draft.default_message}
              onChange={(event) => setDraft({ ...draft, default_message: event.target.value })}
            />
            <TextInputField
              maxLength={80}
              label={t("errorGroup")}
              hint={t("errorGroupHint")}
              value={draft.group_name}
              onChange={(event) => setDraft({ ...draft, group_name: event.target.value })}
            />
            <SelectField label={t("errorSeverity")} value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as ErrorSeverity })}>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </SelectField>
            <TextAreaField
              maxLength={500}
              label={t("errorLocalAction")}
              hint={t("errorLocalActionHint")}
              value={draft.local_action}
              onChange={(event) => setDraft({ ...draft, local_action: event.target.value })}
            />
            <CheckboxField
              label={t("errorDefinitionActive")}
              hint={t("errorDefinitionActiveHint")}
              checked={draft.is_active}
              onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedItem(null)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IdentificationBadge({ identified, active }: { identified: boolean; active: boolean }) {
  const { t } = useI18n();
  if (!identified) {
    return <Badge variant="outline">{t("errorUnidentified")}</Badge>;
  }
  return <Badge variant={active ? "default" : "secondary"}>{t("errorIdentified")}</Badge>;
}

function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  const variant = severity === "CRITICAL" || severity === "ERROR" ? "destructive" : severity === "WARNING" ? "outline" : "secondary";
  return <Badge variant={variant}>{severity}</Badge>;
}

function SummaryValue({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <span className={emphasized ? "font-medium text-destructive" : "text-muted-foreground"}>
      {label}: <span className="font-mono text-foreground">{value}</span>
    </span>
  );
}
