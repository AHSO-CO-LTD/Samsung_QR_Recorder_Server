"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  getFirstRouteForPermissions,
  screenPermissionKeys,
  type ScreenPermissionDefinition,
  type ScreenPermissionKey
} from "@/lib/screen-permissions";

type RolePermissionsCurrent = {
  role: string;
  definitions: ScreenPermissionDefinition[];
  permission_keys: ScreenPermissionKey[];
};

type PermissionsContextValue = {
  definitions: ScreenPermissionDefinition[];
  permissionKeys: ScreenPermissionKey[];
  isLoading: boolean;
  error: string | null;
  canAccess: (permissionKey: ScreenPermissionKey) => boolean;
  firstAccessiblePath: string;
  refreshPermissions: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [definitions, setDefinitions] = useState<ScreenPermissionDefinition[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<ScreenPermissionKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setDefinitions([]);
      setPermissionKeys([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (user.role === "DEV") {
      setPermissionKeys([...screenPermissionKeys]);
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<RolePermissionsCurrent>("/role-permissions/me");
      const data = result.data;
      setDefinitions(data?.definitions ?? []);
      setPermissionKeys(data?.permission_keys ?? (user.role === "DEV" ? [...screenPermissionKeys] : []));
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : "Unable to load role permissions.";
      setError(message);
      setDefinitions([]);
      setPermissionKeys(user.role === "DEV" ? [...screenPermissionKeys] : []);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const canAccess = useCallback(
    (permissionKey: ScreenPermissionKey) => user?.role === "DEV" || permissionKeys.includes(permissionKey),
    [permissionKeys, user?.role]
  );

  const value = useMemo<PermissionsContextValue>(
    () => ({
      definitions,
      permissionKeys,
      isLoading,
      error,
      canAccess,
      firstAccessiblePath: getFirstRouteForPermissions(permissionKeys),
      refreshPermissions: loadPermissions
    }),
    [definitions, permissionKeys, isLoading, error, canAccess, loadPermissions]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used inside PermissionsProvider");
  }

  return context;
}
