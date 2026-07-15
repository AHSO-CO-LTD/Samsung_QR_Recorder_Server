"use client";

import { FormEvent, useState } from "react";
import { Activity, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UpdatePanel } from "@/features/updates/update-panel";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-provider";

export function LoginScreen() {
  const { login, isLoggingIn } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      const message = t("loginMissingCredentials");
      setError(message);
      toast.warning(message);
      return;
    }

    try {
      await login({
        username,
        password,
        rememberPassword
      });
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : t("loginFailed");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-3 py-6 sm:px-4 lg:py-8">
      <section className="flex w-full max-w-[460px] flex-col items-center gap-4">
        <h1 className="max-w-full truncate text-center text-2xl font-semibold tracking-normal">{t("appName")}</h1>

        <Card className="w-full">
          <CardHeader className="space-y-0">
            <CardTitle className="truncate text-center">{t("loginTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="username">
                  {t("loginUsername")}
                </label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isLoggingIn}
                  placeholder={t("loginUsernamePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  {t("loginPassword")}
                </label>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={rememberPassword ? "current-password" : "off"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoggingIn}
                    placeholder={t("loginPasswordPlaceholder")}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowPassword((current) => !current)}
                        disabled={isLoggingIn}
                        aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showPassword ? t("hidePassword") : t("showPassword")}</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                <Checkbox
                  id="remember-password"
                  checked={rememberPassword}
                  onChange={(event) => setRememberPassword(event.target.checked)}
                  disabled={isLoggingIn}
                />
                <span className="flex min-w-0 items-center gap-2">
                  <label htmlFor="remember-password" className="truncate font-medium">
                    {t("rememberPassword")}
                  </label>
                  <InfoTooltip content={t("rememberPasswordDesc")} />
                </span>
              </div>

              {error ? <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</div> : null}

              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? <Activity className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
                {isLoggingIn ? t("loginSubmitting") : t("loginSubmit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <UpdatePanel mode="login" autoCheck={false} />
      </section>
    </main>
  );
}
