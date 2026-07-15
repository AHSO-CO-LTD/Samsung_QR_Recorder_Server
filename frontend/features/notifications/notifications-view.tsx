"use client";

import { FormEvent, useState } from "react";
import { CheckCheck, EyeOff, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";
import { CheckboxField, SelectField, TextAreaField, TextInputField } from "@/features/shared/form-fields";
import { ConfirmActionDialog } from "@/features/shared/confirm-action-dialog";
import { DataTablePanel, DateText, MonoText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { NotificationEvent, NotificationTemplate } from "@/features/shared/types";
import { getNotificationMessage, getNotificationTemplateMessage, getNotificationTemplateTitle, getNotificationTitle } from "./localized-notification";

type TemplateDraft = {
  noti_code: string;
  title_template: string;
  message_template: string;
  title_template_vi: string;
  message_template_vi: string;
  title_template_en: string;
  message_template_en: string;
  severity: NotificationTemplate["severity"];
  target: NotificationTemplate["target"];
  is_active: boolean;
};

const emptyTemplateDraft: TemplateDraft = {
  noti_code: "",
  title_template: "",
  message_template: "",
  title_template_vi: "",
  message_template_vi: "",
  title_template_en: "",
  message_template_en: "",
  severity: "INFO",
  target: "SERVER_UI",
  is_active: true
};

export function NotificationsView() {
  const { locale, t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(emptyTemplateDraft);
  const [deactivateTarget, setDeactivateTarget] = useState<NotificationTemplate | null>(null);

  const eventColumns: Column<NotificationEvent>[] = [
    { key: "time", header: t("colTime"), render: (item) => <DateText value={item.created_at} /> },
    { key: "code", header: t("fieldNotificationCode"), render: (item) => <MonoText value={item.noti_code} /> },
    { key: "title", header: t("colTitle"), render: (item) => getNotificationTitle(item, locale) },
    { key: "machine", header: t("colMachine"), render: (item) => <MonoText value={item.machine?.machine_code} /> },
    { key: "severity", header: t("colSeverity"), render: (item) => <StatusBadge value={item.severity} /> },
    { key: "status", header: t("colStatus"), render: (item) => <StatusBadge value={item.status} /> },
    {
      key: "actions",
      header: t("colActions"),
      className: "w-40 text-right",
      render: (item) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void updateEventStatus(item, "READ")} disabled={item.status === "READ"}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {t("read")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void updateEventStatus(item, "DISMISSED")} disabled={item.status === "DISMISSED"}>
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            {t("dismiss")}
          </Button>
        </div>
      )
    }
  ];

  const templateColumns: Column<NotificationTemplate>[] = [
    { key: "code", header: t("fieldNotificationCode"), render: (item) => <MonoText value={item.noti_code} /> },
    { key: "title", header: t("colTemplate"), render: (item) => getNotificationTemplateTitle(item, locale) },
    { key: "target", header: t("colTarget"), render: (item) => item.target },
    { key: "severity", header: t("colSeverity"), render: (item) => <StatusBadge value={item.severity} /> },
    { key: "active", header: t("colStatus"), render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: t("colUpdated"), render: (item) => <DateText value={item.updated_at} /> },
    {
      key: "actions",
      header: t("colActions"),
      className: "w-40 text-right",
      render: (item) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openTemplateDialog(item)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t("edit")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setDeactivateTarget(item)} disabled={!item.is_active}>
            <Power className="h-4 w-4" aria-hidden="true" />
            {t("deactivate")}
          </Button>
        </div>
      )
    }
  ];

  const openTemplateDialog = (template?: NotificationTemplate) => {
    setEditingTemplate(template ?? null);
    setTemplateDraft(
      template
        ? {
            noti_code: template.noti_code,
            title_template: template.title_template,
            message_template: template.message_template,
            title_template_vi: template.title_template_vi ?? "",
            message_template_vi: template.message_template_vi ?? "",
            title_template_en: template.title_template_en ?? "",
            message_template_en: template.message_template_en ?? "",
            severity: template.severity,
            target: template.target,
            is_active: template.is_active
          }
        : emptyTemplateDraft
    );
    setIsTemplateOpen(true);
  };

  const updateEventStatus = async (item: NotificationEvent, status: "READ" | "DISMISSED") => {
    setIsSaving(true);
    try {
      await apiPatch(`/notifications/${item.id}/status`, { status });
      toast.success(status === "READ" ? t("notificationMarkedRead") : t("notificationDismissed"));
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notificationStatusUpdateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (editingTemplate) {
        await apiPatch(`/notifications/templates/${editingTemplate.id}`, {
          title_template: templateDraft.title_template,
          message_template: templateDraft.message_template,
          title_template_vi: templateDraft.title_template_vi,
          message_template_vi: templateDraft.message_template_vi,
          title_template_en: templateDraft.title_template_en,
          message_template_en: templateDraft.message_template_en,
          severity: templateDraft.severity,
          target: templateDraft.target,
          is_active: templateDraft.is_active
        });
        toast.success(t("notificationTemplateUpdated"));
      } else {
        await apiPost("/notifications/templates", templateDraft);
        toast.success(t("notificationTemplateCreated"));
      }
      setIsTemplateOpen(false);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notificationTemplateSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateTemplate = async () => {
    if (!deactivateTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await apiDelete(`/notifications/templates/${deactivateTarget.id}`);
      toast.success(t("notificationTemplateDeactivated"));
      setDeactivateTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notificationTemplateDeactivateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <DataTablePanel
        title={t("notificationEvents")}
        endpoint={`/notifications?take=100&refresh=${refreshId}`}
        columns={eventColumns}
        getRowKey={(item) => item.id}
        searchableText={(item) =>
          `${item.noti_code} ${item.title} ${item.message} ${getNotificationTitle(item, locale)} ${getNotificationMessage(item, locale)} ${item.severity} ${item.status} ${item.machine?.machine_code ?? ""}`
        }
      />
      <DataTablePanel
        title={t("notificationTemplates")}
        endpoint={`/notifications/templates?refresh=${refreshId}`}
        columns={templateColumns}
        getRowKey={(item) => item.id}
        searchableText={(item) =>
          `${item.noti_code} ${item.title_template} ${item.message_template} ${getNotificationTemplateTitle(item, locale)} ${getNotificationTemplateMessage(item, locale)} ${item.severity} ${item.target} ${item.is_active}`
        }
        actions={
          <Button type="button" size="sm" onClick={() => openTemplateDialog()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addNotificationTemplate")}
          </Button>
        }
      />

      <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? t("editNotificationTemplate") : t("createNotificationTemplate")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveTemplate}>
            <TextInputField required disabled={Boolean(editingTemplate)} label={t("fieldNotificationCode")} value={templateDraft.noti_code} onChange={(event) => setTemplateDraft({ ...templateDraft, noti_code: event.target.value })} />
            <TextInputField required label={t("fieldTitleTemplate")} value={templateDraft.title_template} onChange={(event) => setTemplateDraft({ ...templateDraft, title_template: event.target.value })} />
            <TextAreaField required label={t("fieldMessageTemplate")} value={templateDraft.message_template} onChange={(event) => setTemplateDraft({ ...templateDraft, message_template: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInputField label={`${t("fieldTitleTemplate")} VI`} value={templateDraft.title_template_vi} onChange={(event) => setTemplateDraft({ ...templateDraft, title_template_vi: event.target.value })} />
              <TextInputField label={`${t("fieldTitleTemplate")} EN`} value={templateDraft.title_template_en} onChange={(event) => setTemplateDraft({ ...templateDraft, title_template_en: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextAreaField label={`${t("fieldMessageTemplate")} VI`} value={templateDraft.message_template_vi} onChange={(event) => setTemplateDraft({ ...templateDraft, message_template_vi: event.target.value })} />
              <TextAreaField label={`${t("fieldMessageTemplate")} EN`} value={templateDraft.message_template_en} onChange={(event) => setTemplateDraft({ ...templateDraft, message_template_en: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label={t("fieldSeverity")} value={templateDraft.severity} onChange={(event) => setTemplateDraft({ ...templateDraft, severity: event.target.value as NotificationTemplate["severity"] })}>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </SelectField>
              <SelectField label={t("fieldTarget")} value={templateDraft.target} onChange={(event) => setTemplateDraft({ ...templateDraft, target: event.target.value as NotificationTemplate["target"] })}>
                <option value="SERVER_UI">SERVER_UI</option>
                <option value="LOCAL_UI">LOCAL_UI</option>
                <option value="BOTH">BOTH</option>
              </SelectField>
            </div>
            <CheckboxField label={t("notificationTemplateActiveField")} checked={templateDraft.is_active} onCheckedChange={(checked) => setTemplateDraft({ ...templateDraft, is_active: checked })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateOpen(false)} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={t("notificationTemplateDeactivateTitle")}
        description={t("notificationTemplateDeactivateDesc", { code: deactivateTarget?.noti_code ?? "" })}
        confirmLabel={t("deactivate")}
        isRunning={isSaving}
        onConfirm={() => void deactivateTemplate()}
      />
    </div>
  );
}
