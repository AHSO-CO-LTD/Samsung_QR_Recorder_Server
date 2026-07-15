"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiGet, apiPut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";
import { usePermissions } from "@/lib/permissions";
import { screenPermissionKeys, type ScreenPermissionDefinition, type ScreenPermissionGroup, type ScreenPermissionKey } from "@/lib/screen-permissions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/features/shared/types";
import type { MessageKey } from "@/lib/i18n";

type RolePermissionEntry = {
  role: UserRole;
  editable: boolean;
  permission_keys: ScreenPermissionKey[];
};

type RolePermissionsPayload = {
  definitions: ScreenPermissionDefinition[];
  roles: RolePermissionEntry[];
};

const roleLabelKeys: Record<UserRole, MessageKey> = {
  OPERATOR: "roleOperator",
  ENGINEER: "roleEngineer",
  ADMIN: "roleAdmin",
  DEV: "roleDev"
};

const groupLabelKeys: Record<ScreenPermissionGroup, MessageKey> = {
  monitoring: "navMonitoring",
  operation: "navOperation",
  system: "navSystem"
};

const groupOrder: readonly ScreenPermissionGroup[] = ["monitoring", "operation", "system"];

export function RolePermissionsPanel() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { refreshPermissions } = usePermissions();
  const [definitions, setDefinitions] = useState<ScreenPermissionDefinition[]>([]);
  const [roles, setRoles] = useState<RolePermissionEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScreenPermissionKey[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);

  const groupedDefinitions = useMemo(
    () =>
      groupOrder.map((group) => ({
        group,
        definitions: definitions.filter((definition) => definition.group === group)
      })),
    [definitions]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<RolePermissionsPayload>("/role-permissions");
      const data = result.data;
      setDefinitions(data?.definitions ?? []);
      setRoles(data?.roles ?? []);
      setDrafts(
        Object.fromEntries((data?.roles ?? []).map((roleEntry) => [roleEntry.role, sortPermissionKeys(roleEntry.permission_keys)]))
      );
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : t("rolePermissionsLoadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePermission = (role: UserRole, permissionKey: ScreenPermissionKey, checked: boolean) => {
    setDrafts((current) => {
      const currentKeys = new Set(current[role] ?? []);
      if (checked) {
        currentKeys.add(permissionKey);
      } else {
        currentKeys.delete(permissionKey);
      }

      return {
        ...current,
        [role]: sortPermissionKeys([...currentKeys])
      };
    });
  };

  const selectAllPermissions = (role: UserRole) => {
    setDrafts((current) => ({
      ...current,
      [role]: sortPermissionKeys(definitions.map((definition) => definition.key))
    }));
  };

  const saveRolePermissions = async (roleEntry: RolePermissionEntry) => {
    const permissionKeys = drafts[roleEntry.role] ?? [];
    if (permissionKeys.length === 0) {
      toast.warning(t("rolePermissionsEmptyWarning"));
      return;
    }

    setSavingRole(roleEntry.role);
    const toastId = toast.loading(t("saving"));
    try {
      const result = await apiPut<RolePermissionEntry>(`/role-permissions/${roleEntry.role}`, {
        permission_keys: permissionKeys
      });
      const savedEntry = result.data ?? {
        ...roleEntry,
        permission_keys: permissionKeys
      };

      setRoles((current) => current.map((item) => (item.role === roleEntry.role ? savedEntry : item)));
      setDrafts((current) => ({
        ...current,
        [roleEntry.role]: sortPermissionKeys(savedEntry.permission_keys)
      }));
      await refreshPermissions();
      toast.success(t("rolePermissionsSaved"), { id: toastId });
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : t("rolePermissionsSaveFailed");
      toast.error(message, { id: toastId });
    } finally {
      setSavingRole(null);
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "DEV") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{t("rolePermissionsTitle")}</CardTitle>
          <CardDescription>{t("rolePermissionsDesc")}</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
          {t("retry")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("loading")}</div> : null}
        {error ? <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
        {!isLoading && !error && roles.length === 0 ? <div className="rounded-md border p-4 text-sm text-muted-foreground">{t("empty")}</div> : null}
        {!isLoading && !error
          ? roles.map((roleEntry) => {
              const draftKeys = drafts[roleEntry.role] ?? [];
              const changed = !samePermissionKeys(draftKeys, roleEntry.permission_keys);
              const isSavingThisRole = savingRole === roleEntry.role;
              const canEdit = roleEntry.editable;

              return (
                <section key={roleEntry.role} className="rounded-md border">
                  <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="text-sm font-semibold">{t(roleLabelKeys[roleEntry.role])}</h3>
                      <Badge variant={canEdit ? "outline" : "secondary"}>
                        {canEdit ? `${draftKeys.length}/${definitions.length}` : t("rolePermissionsFullAccess")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canEdit ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => selectAllPermissions(roleEntry.role)} disabled={isSavingThisRole}>
                          {t("all")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveRolePermissions(roleEntry)}
                        disabled={!canEdit || !changed || draftKeys.length === 0 || isSavingThisRole}
                      >
                        <Save className="h-4 w-4" aria-hidden="true" />
                        {t("save")}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 p-3 xl:grid-cols-3">
                    {groupedDefinitions.map(({ group, definitions: groupDefinitions }) => (
                      <div key={group} className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(groupLabelKeys[group])}</div>
                        <div className="grid gap-2">
                          {groupDefinitions.map((definition) => {
                            const checked = !canEdit || draftKeys.includes(definition.key);
                            return (
                              <label key={definition.key} className={cn("flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm", !canEdit && "bg-muted/40")}>
                                <Checkbox
                                  checked={checked}
                                  disabled={!canEdit || isSavingThisRole}
                                  onChange={(event) => togglePermission(roleEntry.role, definition.key, event.currentTarget.checked)}
                                />
                                <span className="min-w-0 truncate">{locale === "vi" ? definition.label_vi : definition.label_en}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!canEdit ? <div className="border-t px-3 py-2 text-xs text-muted-foreground">{t("rolePermissionsDevLocked")}</div> : null}
                  {canEdit && draftKeys.length === 0 ? <div className="border-t px-3 py-2 text-xs text-destructive">{t("rolePermissionsEmptyWarning")}</div> : null}
                </section>
              );
            })
          : null}
      </CardContent>
    </Card>
  );
}

function sortPermissionKeys(permissionKeys: readonly ScreenPermissionKey[]) {
  return [...permissionKeys].sort((left, right) => screenPermissionKeys.indexOf(left) - screenPermissionKeys.indexOf(right));
}

function samePermissionKeys(left: readonly ScreenPermissionKey[], right: readonly ScreenPermissionKey[]) {
  const normalizedLeft = sortPermissionKeys(left);
  const normalizedRight = sortPermissionKeys(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((permissionKey, index) => permissionKey === normalizedRight[index]);
}
