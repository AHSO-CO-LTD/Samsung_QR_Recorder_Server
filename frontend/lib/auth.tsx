"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n-provider";

const SESSION_STORAGE_KEY = "server-session-token";
const REMEMBER_STORAGE_KEY = "server-remember-token";
const DEV_ROLE_PREVIEW_STORAGE_KEY = "server-dev-role-preview";

export type AuthUser = {
  id: number;
  username: string;
  full_name: string;
  role: "OPERATOR" | "ENGINEER" | "ADMIN" | "DEV";
};

export type AuthUserRole = AuthUser["role"];

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
  authenticatedUser: AuthUser | null;
  isRolePreview: boolean;
  isBooting: boolean;
  isLoggingIn: boolean;
  login: (input: { username: string; password: string; rememberPassword: boolean }) => Promise<void>;
  setRolePreview: (role: AuthUserRole) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [previewRole, setPreviewRole] = useState<AuthUserRole | null>(null);
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
        const nextUser = result.data?.user ?? null;
        setAuthenticatedUser(nextUser);
        setPreviewRole(nextUser?.role === "DEV" ? readStoredDevRolePreview() : null);
        if (rememberedToken) {
          toast.success(tRef.current("authRememberedLoginSuccess"));
        }
      } catch {
        clearStoredTokens();
        clearStoredDevRolePreview();
        setAuthenticatedUser(null);
        setPreviewRole(null);
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
      clearStoredDevRolePreview();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, data.token);
      if (input.rememberPassword) {
        window.localStorage.setItem(REMEMBER_STORAGE_KEY, data.token);
      }
      setAuthenticatedUser(data.user);
      setPreviewRole(null);
      toast.success(input.rememberPassword ? t("loginSuccessRemembered") : t("loginSuccess"));
    } finally {
      setIsLoggingIn(false);
    }
  }, [t]);

  const setRolePreview = useCallback(
    (role: AuthUserRole) => {
      if (authenticatedUser?.role !== "DEV") {
        return;
      }

      if (role === "DEV") {
        clearStoredDevRolePreview();
        setPreviewRole(null);
        return;
      }

      window.sessionStorage.setItem(DEV_ROLE_PREVIEW_STORAGE_KEY, role);
      setPreviewRole(role);
    },
    [authenticatedUser?.role]
  );

  const logout = useCallback(() => {
    clearStoredTokens();
    clearStoredDevRolePreview();
    setAuthenticatedUser(null);
    setPreviewRole(null);
    toast.success(t("logoutSuccess"));
  }, [t]);

  const user = useMemo(() => {
    if (!authenticatedUser) {
      return null;
    }

    return authenticatedUser.role === "DEV" && previewRole ? { ...authenticatedUser, role: previewRole } : authenticatedUser;
  }, [authenticatedUser, previewRole]);
  const isRolePreview = authenticatedUser?.role === "DEV" && previewRole !== null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authenticatedUser,
      isRolePreview,
      isBooting,
      isLoggingIn,
      login,
      setRolePreview,
      logout
    }),
    [user, authenticatedUser, isRolePreview, isBooting, isLoggingIn, login, setRolePreview, logout]
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

function readStoredDevRolePreview(): AuthUserRole | null {
  const value = window.sessionStorage.getItem(DEV_ROLE_PREVIEW_STORAGE_KEY);
  return isAuthUserRole(value) && value !== "DEV" ? value : null;
}

function clearStoredDevRolePreview() {
  window.sessionStorage.removeItem(DEV_ROLE_PREVIEW_STORAGE_KEY);
}

function isAuthUserRole(value: string | null): value is AuthUserRole {
  return value === "OPERATOR" || value === "ENGINEER" || value === "ADMIN" || value === "DEV";
}
