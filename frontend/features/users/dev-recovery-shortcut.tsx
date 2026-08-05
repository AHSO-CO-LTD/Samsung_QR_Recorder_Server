"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField, TextInputField } from "@/features/shared/form-fields";
import type { AppUser } from "@/features/shared/types";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getDesktopApp } from "@/lib/desktop-app";
import { useI18n } from "@/lib/i18n-provider";
import { advanceDevRecoveryShortcut, type DevRecoveryShortcutProgress } from "./dev-recovery-shortcut-state";

const REQUIRED_PRESS_COUNT = 10;

type DevRecoveryStatus = {
  accounts: AppUser[];
};

export function DevRecoveryShortcut() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [username, setUsername] = useState("dev");
  const [fullName, setFullName] = useState("Support Service");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const shortcutProgressRef = useRef<DevRecoveryShortcutProgress>({ count: 0, startedAt: null });

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      shortcutProgressRef.current = { count: 0, startedAt: null };
      setIsOpen(false);
      return;
    }

    const registerShortcutPress = () => {
      const result = advanceDevRecoveryShortcut(shortcutProgressRef.current, Date.now(), REQUIRED_PRESS_COUNT);
      shortcutProgressRef.current = result.progress;

      if (result.activated) {
        setIsOpen(true);
        toast.success(t("devRecoveryOpened"));
      }
    };

    const desktopApp = getDesktopApp();
    const unsubscribeDesktopShortcut = desktopApp?.onDevRecoveryShortcutPress?.(registerShortcutPress);
    if (unsubscribeDesktopShortcut) {
      return unsubscribeDesktopShortcut;
    }

    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || (event.key !== "F11" && event.code !== "F11") || event.repeat) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      registerShortcutPress();
    };

    document.addEventListener("keydown", handleShortcut, true);
    return () => document.removeEventListener("keydown", handleShortcut, true);
  }, [t, user?.role]);

  useEffect(() => {
    if (!isOpen || user?.role !== "ADMIN") {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    void apiGet<DevRecoveryStatus>("/users/dev-recovery")
      .then((result) => {
        if (!isMounted) {
          return;
        }
        const nextAccounts = result.data?.accounts ?? [];
        setAccounts(nextAccounts);
        setSelectedUserId(nextAccounts[0] ? String(nextAccounts[0].id) : "");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("devRecoveryLoadFailed");
        toast.error(message);
        setIsOpen(false);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, t, user?.role]);

  const closeDialog = () => {
    if (isSaving) {
      return;
    }
    setIsOpen(false);
    setPassword("");
    setConfirmPassword("");
  };

  const submitRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.warning(t("passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      toast.warning(t("passwordMismatch"));
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(accounts.length ? t("devPasswordResetting") : t("devAccountCreating"));
    try {
      await apiPost("/users/dev-recovery", {
        user_id: accounts.length ? Number(selectedUserId) : undefined,
        username: accounts.length ? undefined : username,
        full_name: accounts.length ? undefined : fullName,
        password
      });
      toast.success(accounts.length ? t("devPasswordResetSuccess") : t("devAccountCreateSuccess"), { id: toastId });
      setIsOpen(false);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("devRecoverySaveFailed"), { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : closeDialog())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{accounts.length ? t("devPasswordResetTitle") : t("devAccountCreateTitle")}</DialogTitle>
          <DialogDescription>
            {accounts.length ? t("devPasswordResetDesc") : t("devAccountCreateDesc")}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-md bg-muted" aria-label={t("loading")} />
        ) : (
          <form className="space-y-3" onSubmit={submitRecovery}>
            {accounts.length ? (
              <SelectField label={t("devAccountField")} value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.username} — {account.full_name}{account.is_active ? "" : ` (${t("inactive")})`}
                  </option>
                ))}
              </SelectField>
            ) : (
              <>
                <TextInputField required label={t("fieldUsername")} value={username} onChange={(event) => setUsername(event.target.value)} />
                <TextInputField required label={t("fieldFullName")} value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </>
            )}
            <TextInputField
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              label={t("fieldNewPassword")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <TextInputField
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              label={t("fieldConfirmPassword")}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {accounts.length ? t("resetPassword") : t("createUser")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
