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

type RolePermissionsList = {
  definitions: ScreenPermissionDefinition[];
  roles: Array<{
    role: string;
    permission_keys: ScreenPermissionKey[];
  }>;
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
  const { user, authenticatedUser, isRolePreview } = useAuth();
  const [definitions, setDefinitions] = useState<ScreenPermissionDefinition[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<ScreenPermissionKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedUserScope, setLoadedUserScope] = useState<string | null>(null);
  const currentUserScope = user ? `${user.id}:${user.role}` : null;

  const loadPermissions = useCallback(async () => {
    if (!user || !currentUserScope) {
      setDefinitions([]);
      setPermissionKeys([]);
      setError(null);
      setIsLoading(false);
      setLoadedUserScope(null);
      return;
    }

    if (user.role === "DEV") {
      setPermissionKeys([...screenPermissionKeys]);
    }

    setIsLoading(true);
    setError(null);
    try {
      if (isRolePreview && authenticatedUser?.role === "DEV") {
        const result = await apiGet<RolePermissionsList>("/role-permissions");
        const data = result.data;
        const previewRolePermissions = data?.roles.find((roleEntry) => roleEntry.role === user.role);
        setDefinitions(data?.definitions ?? []);
        setPermissionKeys(previewRolePermissions?.permission_keys ?? []);
        setLoadedUserScope(currentUserScope);
        return;
      }

      const result = await apiGet<RolePermissionsCurrent>("/role-permissions/me");
      const data = result.data;
      setDefinitions(data?.definitions ?? []);
      setPermissionKeys(data?.permission_keys ?? (user.role === "DEV" ? [...screenPermissionKeys] : []));
      setLoadedUserScope(currentUserScope);
    } catch (currentError) {
      const message = currentError instanceof Error ? currentError.message : "Không tải được phân quyền vai trò.";
      setError(message);
      setDefinitions([]);
      setPermissionKeys(user.role === "DEV" ? [...screenPermissionKeys] : []);
      setLoadedUserScope(currentUserScope);
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedUser?.role, currentUserScope, isRolePreview, user]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const hasLoadedCurrentUserPermissions = !currentUserScope || loadedUserScope === currentUserScope;
  const effectivePermissionKeys = useMemo<ScreenPermissionKey[]>(() => {
    if (user?.role === "DEV") {
      return [...screenPermissionKeys];
    }

    return hasLoadedCurrentUserPermissions ? permissionKeys : [];
  }, [hasLoadedCurrentUserPermissions, permissionKeys, user?.role]);
  const effectiveIsLoading = isLoading || Boolean(currentUserScope && !hasLoadedCurrentUserPermissions);

  const canAccess = useCallback(
    (permissionKey: ScreenPermissionKey) => user?.role === "DEV" || effectivePermissionKeys.includes(permissionKey),
    [effectivePermissionKeys, user?.role]
  );

  const value = useMemo<PermissionsContextValue>(
    () => ({
      definitions,
      permissionKeys: effectivePermissionKeys,
      isLoading: effectiveIsLoading,
      error,
      canAccess,
      firstAccessiblePath: getFirstRouteForPermissions(effectivePermissionKeys),
      refreshPermissions: loadPermissions
    }),
    [definitions, effectivePermissionKeys, effectiveIsLoading, error, canAccess, loadPermissions]
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
