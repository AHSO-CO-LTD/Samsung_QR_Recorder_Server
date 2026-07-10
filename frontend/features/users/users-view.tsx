"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiDelete, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ConfirmActionDialog } from "@/features/shared/confirm-action-dialog";
import { DataTablePanel, DateText, StatusBadge, type Column } from "@/features/shared/data-view";
import { PageTitle } from "@/features/shared/page-title";
import type { AppUser, UserRole } from "@/features/shared/types";

const roleLabels: Record<UserRole, string> = {
  OPERATOR: "Operator",
  ENGINEER: "Engineer",
  ADMIN: "Admin",
  DEV: "Dev"
};

const emptyUser = {
  username: "",
  full_name: "",
  password: "",
  role: "OPERATOR" as UserRole
};

export function UsersView() {
  const { user } = useAuth();
  const [refreshId, setRefreshId] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(emptyUser);
  const [target, setTarget] = useState<AppUser | null>(null);

  const availableRoles = useMemo<UserRole[]>(
    () => (user?.role === "DEV" ? ["OPERATOR", "ENGINEER", "ADMIN", "DEV"] : ["OPERATOR", "ENGINEER", "ADMIN"]),
    [user?.role]
  );

  const columns: Column<AppUser>[] = [
    { key: "username", header: "Tài khoản", render: (item) => item.username },
    { key: "name", header: "Họ tên", render: (item) => item.full_name },
    { key: "role", header: "Role", render: (item) => roleLabels[item.role] },
    { key: "active", header: "Trạng thái", render: (item) => <StatusBadge value={item.is_active} /> },
    { key: "updated", header: "Cập nhật", render: (item) => <DateText value={item.updated_at} /> },
    {
      key: "actions",
      header: "Thao tác",
      className: "w-28 text-right",
      render: (item) => (
        <Button type="button" variant="outline" size="sm" onClick={() => setTarget(item)} disabled={!item.is_active || item.id === user?.id}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Tắt
        </Button>
      )
    }
  ];

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiPost("/users", draft);
      toast.success("Đã tạo user.");
      setDraft({ ...emptyUser, role: availableRoles[0] });
      setIsCreateOpen(false);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được user.");
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
      toast.success("Đã vô hiệu hóa user.");
      setTarget(null);
      setRefreshId((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không vô hiệu hóa được user.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <PageTitle title="Users và role" description="Quản lý tài khoản vận hành server. Role Dev chỉ hiển thị với tài khoản Dev." />
      <DataTablePanel
        title="Danh sách user"
        endpoint={`/users?refresh=${refreshId}`}
        columns={columns}
        getRowKey={(item) => item.id}
        actions={
          <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm user
          </Button>
        }
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm user</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveUser}>
            <Input required placeholder="Tên đăng nhập" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
            <Input required placeholder="Họ tên" value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} />
            <Input required type="password" minLength={8} placeholder="Mật khẩu" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSaving}>
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Vô hiệu hóa user?"
        description={`Tài khoản ${target?.username ?? ""} sẽ không đăng nhập được nữa.`}
        confirmLabel="Vô hiệu hóa"
        isRunning={isSaving}
        onConfirm={() => void deactivateUser()}
      />
    </div>
  );
}
