"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";

const SESSION_STORAGE_KEY = "server-session-token";
const REMEMBER_STORAGE_KEY = "server-remember-token";

export type AuthUser = {
  id: number;
  username: string;
  full_name: string;
  role: "OPERATOR" | "ENGINEER" | "ADMIN" | "DEV";
};

type LoginResult = {
  user: AuthUser;
  token: string;
  remember_password: boolean;
};

type ValidateResult = {
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  isBooting: boolean;
  isLoggingIn: boolean;
  login: (input: { username: string; password: string; rememberPassword: boolean }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const boot = async () => {
      const rememberedToken = window.localStorage.getItem(REMEMBER_STORAGE_KEY);
      const sessionToken = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      const token = rememberedToken || sessionToken;

      if (!token) {
        setIsBooting(false);
        return;
      }

      try {
        const result = await apiPost<ValidateResult>("/auth/validate", { token });
        setUser(result.data?.user ?? null);
        if (rememberedToken) {
          toast.success(tRef.current("authRememberedLoginSuccess"));
        }
      } catch {
        clearStoredTokens();
        setUser(null);
      } finally {
        setIsBooting(false);
      }
    };

    void boot();
  }, []);

  const login = useCallback(async (input: { username: string; password: string; rememberPassword: boolean }) => {
    setIsLoggingIn(true);
    try {
      const result = await apiPost<LoginResult>("/auth/login", {
        username: input.username,
        password: input.password,
        remember_password: input.rememberPassword
      });
      const data = result.data;
      if (!data) {
        throw new Error(t("loginApiMissingSession"));
      }

      clearStoredTokens();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, data.token);
      if (input.rememberPassword) {
        window.localStorage.setItem(REMEMBER_STORAGE_KEY, data.token);
      }
      setUser(data.user);
      toast.success(input.rememberPassword ? t("loginSuccessRemembered") : t("loginSuccess"));
    } finally {
      setIsLoggingIn(false);
    }
  }, [t]);

  const logout = useCallback(() => {
    clearStoredTokens();
    setUser(null);
    toast.success(t("logoutSuccess"));
  }, [t]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBooting,
      isLoggingIn,
      login,
      logout
    }),
    [user, isBooting, isLoggingIn, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

function clearStoredTokens() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(REMEMBER_STORAGE_KEY);
}
