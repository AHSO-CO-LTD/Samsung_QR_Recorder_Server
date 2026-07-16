"use client";

import { FormEvent, useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";

type FirstAdminSetupScreenProps = {
  onCreated: () => void;
};

export function FirstAdminSetupScreen({ onCreated }: FirstAdminSetupScreenProps) {
  const [username, setUsername] = useState("admin");
  const [fullName, setFullName] = useState("System Administrator");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !fullName.trim() || !password) {
      const message = "Vui lòng nhập đủ thông tin admin đầu tiên.";
      setError(message);
      toast.warning(message);
      return;
    }

    if (password.length < 8) {
      const message = "Mật khẩu cần tối thiểu 8 ký tự.";
      setError(message);
      toast.warning(message);
      return;
    }

    if (password !== confirmPassword) {
      const message = "Mật khẩu xác nhận không khớp.";
      setError(message);
      toast.warning(message);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/setup/admin", {
        username,
        full_name: fullName,
        password
      });
      toast.success("Đã tạo tài khoản admin đầu tiên.");
      onCreated();
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : "Không tạo được admin đầu tiên.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-3 py-6 sm:px-4 lg:py-8">
      <section className="flex w-full max-w-[460px] flex-col items-center gap-4">
        <div className="flex max-w-full flex-col items-center gap-2">
          <AppLogo className="h-12 w-12" imageClassName="h-8 w-8" />
          <h1 className="max-w-full truncate text-center text-2xl font-semibold tracking-normal">QR Recorder Server</h1>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-center">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              Tạo admin đầu tiên
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="Tên đăng nhập">
                <Input value={username} onChange={(event) => setUsername(event.target.value)} disabled={isSubmitting} autoComplete="username" />
              </Field>

              <Field label="Tên hiển thị">
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={isSubmitting} autoComplete="name" />
              </Field>

              <Field label="Mật khẩu">
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} autoComplete="new-password" />
              </Field>

              <Field label="Nhập lại mật khẩu">
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isSubmitting} autoComplete="new-password" />
              </Field>

              {error ? <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</div> : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Activity className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? "Đang tạo admin" : "Tạo admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
