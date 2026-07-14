"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";
import { CheckboxField, SelectField, TextInputField } from "@/features/shared/form-fields";
import { ConfirmActionDialog } from "@/features/shared/confirm-action-dialog";
import { DataTablePanel, DateText, StatusBadge, type Column } from "@/features/shared/data-view";
import type { AppUser, UserRole } from "@/features/shared/types";
import type { MessageKey } from "@/lib/i18n";

type UserDraft = {
  username: string;
  full_name: string;
  password: string;
  role: UserRole;
  is_active: boolean;
};

const roleLabelKeys: Record<UserRole, MessageKey> = {
  OPERATOR: "roleOperator",
  ENGINEER: "roleEngineer",
  ADMIN: "roleAdmin",
  DEV: "roleDev"
};

const emptyUser: UserDraft = {
  username: "",
  full_name: "",
  password: "",
  role: "OPERATOR",
  is_active: true
};

export function UsersView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [refreshId, setRefreshId] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<UserDraft>(emptyUser);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [target, setTarget] = useState<AppUser | null>(null);

  const availableRoles = useMemo<UserRole[]>(
    () => (user?.role === "DEV" ? ["OPERATOR", "ENGINEER", "ADMIN", "DEV"] : ["OPERATOR", "ENGINEER", "ADMIN"]),
    [user?.role]
  );

  const columns: Column<AppUser>[] = [
    { key: "username", header: t("fieldUsername"), render: (item) => item.username },
    { key: "name", header: t("fieldFullName"), render: (item) => item.full_name },
    { key: "role", header: t("colRole"), render: (item) => t(roleLabelKeys[item.role]) },
    { key: "active", header: t("colStatus"), render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: t("colUpdated"), render: (item) => <DateText value={item.updated_at} /> },
    {
      key: "actions",
      header: t("colActions"),
      className: "w-40 text-right",
      render: (item) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openForm(item)} disabled={item.id === user?.id && item.role === "DEV"}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t("edit")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setTarget(item)} disabled={!item.is_active || item.id === user?.id}>
            <Power className="h-4 w-4" aria-hidden="true" />
            {t("deactivate")}
          </Button>
        </div>
      )
    }
  ];

  const openForm = (targetUser?: AppUser) => {
    setEditingUser(targetUser ?? null);
    setDraft(
      targetUser
        ? {
            username: targetUser.username,
            full_name: targetUser.full_name,
            password: "",
            role: targetUser.role,
            is_active: targetUser.is_active
          }
        : { ...emptyUser, role: availableRoles[0] }
    );
    setIsFormOpen(true);
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (editingUser) {
        await apiPatch(`/users/${editingUser.id}`, {
          full_name: draft.full_name,
          role: draft.role,
          password: draft.password || undefined,
          is_active: draft.is_active
        });
        toast.success(t("userUpdated"));
      } else {
        await apiPost("/users", draft);
        toast.success(t("userCreated"));
      }
      setDraft({ ...emptyUser, role: availableRoles[0] });
      setIsFormOpen(false);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("userSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateUser = async () => {
    if (!target) {
      return;
    }

    setIsSaving(true);
    try {
      await apiDelete(`/users/${target.id}`);
      toast.success(t("userDeactivated"));
      setTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("userDeactivateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <DataTablePanel
        title={t("usersList")}
        endpoint={`/users?refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
        searchableText={(item) => `${item.username} ${item.full_name} ${item.role} ${item.is_active}`}
        actions={
          <Button type="button" size="sm" onClick={() => openForm()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addUser")}
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? t("editUser") : t("createUser")}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveUser}>
            <TextInputField required disabled={Boolean(editingUser)} label={t("fieldUsername")} value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
            <TextInputField required label={t("fieldFullName")} value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} />
            <TextInputField
              required={!editingUser}
              type="password"
              minLength={draft.password ? 8 : undefined}
              label={editingUser ? t("fieldNewPassword") : t("fieldPassword")}
              hint={editingUser ? t("passwordBlankHint") : undefined}
              value={draft.password}
              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
            />
            <SelectField label={t("colRole")} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {t(roleLabelKeys[role])}
                </option>
              ))}
            </SelectField>
            <CheckboxField label={t("userActiveField")} checked={draft.is_active} onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
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
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title={t("userDeactivateTitle")}
        description={t("userDeactivateDesc", { username: target?.username ?? "" })}
        confirmLabel={t("deactivate")}
        isRunning={isSaving}
        onConfirm={() => void deactivateUser()}
      />
    </div>
  );
}
