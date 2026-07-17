import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  allScreenPermissionKeys,
  configurableRoles,
  defaultRoleScreenPermissions,
  isConfigurableRole,
  isScreenPermissionKey,
  isUserRole,
  screenPermissionDefinitions,
  userRoles,
  type ScreenPermissionKey
} from "./role-permissions.constants";
import type { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listRolePermissions(actorRole?: UserRole) {
    const roles = actorRole === UserRole.DEV ? userRoles : configurableRoles;
    const rows = await this.prisma.rolePermission.findMany({
      orderBy: [{ role: "asc" }, { permission_key: "asc" }]
    });

    return {
      success: true,
      code: "ROLE_PERMISSIONS_LISTED",
      message: "Đã tải phân quyền vai trò.",
      data: {
        definitions: screenPermissionDefinitions,
        roles: roles.map((role) => ({
          role,
          editable: role !== UserRole.DEV,
          permission_keys: this.resolvePermissionKeys(role, rows)
        }))
      }
    };
  }

  async getCurrentUserPermissions(role: UserRole) {
    return {
      success: true,
      code: "ROLE_PERMISSIONS_CURRENT",
      message: "Đã tải phân quyền vai trò hiện tại.",
      data: {
        role,
        definitions: screenPermissionDefinitions,
        permission_keys: await this.getEffectivePermissionKeys(role)
      }
    };
  }

  async getEffectivePermissionKeys(role: UserRole) {
    if (role === UserRole.DEV) {
      return allScreenPermissionKeys;
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      select: { permission_key: true },
      orderBy: { permission_key: "asc" }
    });

    if (rows.length === 0 && isConfigurableRole(role)) {
      return [...defaultRoleScreenPermissions[role]];
    }

    return this.normalizePermissionKeys(rows.map((row) => row.permission_key));
  }

  async updateRolePermissions(roleParam: string, dto: UpdateRolePermissionsDto, actorUserId?: number | null, actorRole?: UserRole) {
    const role = this.parseRole(roleParam);
    if (role === UserRole.DEV) {
      throw new ForbiddenException({
        success: false,
        code: "DEV_ROLE_FULL_ACCESS",
        message: "Vai trò Dev luôn có toàn quyền và không thể chỉnh sửa."
      });
    }

    if (!isConfigurableRole(role)) {
      throw new BadRequestException({
        success: false,
        code: "ROLE_NOT_CONFIGURABLE",
        message: "Vai trò này không cho phép cấu hình."
      });
    }

    const oldPermissionKeys = await this.getEffectivePermissionKeys(role);
    const permissionKeys = this.normalizePermissionKeys(dto.permission_keys);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { role } }),
      this.prisma.rolePermission.createMany({
        data: permissionKeys.map((permissionKey) => ({
          role,
          permission_key: permissionKey
        }))
      })
    ]);

    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_ROLE_PERMISSIONS",
      tableName: "role_permissions",
      recordId: role,
      oldValue: { role, permission_keys: oldPermissionKeys },
      newValue: { role, permission_keys: permissionKeys, actor_role: actorRole ?? null }
    });

    return {
      success: true,
      code: "ROLE_PERMISSIONS_UPDATED",
      message: "Đã cập nhật phân quyền vai trò.",
      data: {
        role,
        editable: true,
        permission_keys: permissionKeys
      }
    };
  }

  private resolvePermissionKeys(
    role: UserRole,
    rows: Array<{
      role: UserRole;
      permission_key: string;
    }>
  ) {
    if (role === UserRole.DEV) {
      return allScreenPermissionKeys;
    }

    const permissionKeys = rows.filter((row) => row.role === role).map((row) => row.permission_key);
    if (permissionKeys.length === 0 && isConfigurableRole(role)) {
      return [...defaultRoleScreenPermissions[role]];
    }

    return this.normalizePermissionKeys(permissionKeys);
  }

  private normalizePermissionKeys(input: readonly string[]) {
    const permissionKeys = [...new Set(input.map((permissionKey) => permissionKey.trim()).filter(Boolean))];
    const invalidKeys = permissionKeys.filter((permissionKey) => !isScreenPermissionKey(permissionKey));
    if (invalidKeys.length > 0) {
      throw new BadRequestException({
        success: false,
        code: "ROLE_PERMISSION_INVALID_KEY",
        message: `Khóa phân quyền không hợp lệ: ${invalidKeys.join(", ")}`
      });
    }

    return allScreenPermissionKeys.filter((permissionKey) => permissionKeys.includes(permissionKey)) as ScreenPermissionKey[];
  }

  private parseRole(roleParam: string) {
    const role = roleParam.trim().toUpperCase();
    if (!isUserRole(role)) {
      throw new BadRequestException({
        success: false,
        code: "ROLE_INVALID",
        message: "Vai trò không hợp lệ."
      });
    }

    return role;
  }
}
