import crypto from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto, RecoverDevAccountDto, UpdateUserDto } from "./dto/user-crud.dto";

const userSelect = {
  id: true,
  username: true,
  full_name: true,
  role: true,
  is_active: true,
  created_at: true,
  updated_at: true
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listUsers(actorRole?: UserRole) {
    const users = await this.prisma.user.findMany({
      where: actorRole === "DEV" ? undefined : { role: { not: "DEV" } },
      orderBy: [{ is_active: "desc" }, { username: "asc" }],
      select: userSelect
    });

    return {
      success: true,
      code: "USERS_LISTED",
      message: "Đã tải danh sách người dùng.",
      data: users
    };
  }

  async createUser(dto: CreateUserDto, actorUserId?: number | null, actorRole?: UserRole) {
    this.assertCanManageRole(dto.role, actorRole);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        full_name: dto.full_name.trim(),
        role: dto.role,
        password_hash: this.hashPassword(dto.password),
        is_active: dto.is_active ?? true
      },
      select: userSelect
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_USER",
      tableName: "users",
      recordId: user.id,
      newValue: user
    });

    return {
      success: true,
      code: "USER_CREATED",
      message: "Đã tạo người dùng.",
      data: user
    };
  }

  async getDevRecoveryStatus(actorRole?: UserRole) {
    this.assertAdminRecovery(actorRole);
    const accounts = await this.prisma.user.findMany({
      where: { role: "DEV" },
      orderBy: [{ is_active: "desc" }, { username: "asc" }],
      select: userSelect
    });

    return {
      success: true,
      code: "DEV_RECOVERY_STATUS_LOADED",
      message: "Đã tải trạng thái tài khoản DEV.",
      data: { accounts }
    };
  }

  async recoverDevAccount(dto: RecoverDevAccountDto, actorUserId?: number | null, actorRole?: UserRole) {
    this.assertAdminRecovery(actorRole);
    const existingDevAccounts = await this.prisma.user.findMany({
      where: { role: "DEV" },
      select: userSelect
    });

    if (existingDevAccounts.length > 0) {
      if (!dto.user_id) {
        throw new BadRequestException({
          success: false,
          code: "DEV_ACCOUNT_REQUIRED",
          message: "Vui lòng chọn tài khoản DEV cần đặt lại mật khẩu."
        });
      }
      const target = existingDevAccounts.find((account) => account.id === dto.user_id);
      if (!target) {
        throw new NotFoundException({
          success: false,
          code: "DEV_ACCOUNT_NOT_FOUND",
          message: "Không tìm thấy tài khoản DEV."
        });
      }

      const user = await this.prisma.user.update({
        where: { id: target.id },
        data: {
          password_hash: this.hashPassword(dto.password),
          is_active: true
        },
        select: userSelect
      });
      await this.audit.write({
        userId: actorUserId,
        action: "RESET_DEV_PASSWORD",
        tableName: "users",
        recordId: user.id,
        oldValue: target,
        newValue: user
      });

      return {
        success: true,
        code: "DEV_PASSWORD_RESET",
        message: "Đã đặt lại mật khẩu DEV.",
        data: user
      };
    }

    const username = dto.username?.trim() || "dev";
    const fullName = dto.full_name?.trim() || "Support Service";
    const usernameExists = await this.prisma.user.findUnique({ where: { username } });
    if (usernameExists) {
      throw new ConflictException({
        success: false,
        code: "USERNAME_EXISTS",
        message: "Tên đăng nhập đã tồn tại."
      });
    }

    const user = await this.prisma.user.create({
      data: {
        username,
        full_name: fullName,
        role: "DEV",
        password_hash: this.hashPassword(dto.password),
        is_active: true
      },
      select: userSelect
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_DEV_RECOVERY",
      tableName: "users",
      recordId: user.id,
      newValue: user
    });

    return {
      success: true,
      code: "DEV_ACCOUNT_CREATED",
      message: "Đã tạo tài khoản DEV.",
      data: user
    };
  }

  async updateUser(id: number, dto: UpdateUserDto, actorUserId?: number | null, actorRole?: UserRole) {
    const oldUser = await this.ensureUser(id);
    this.assertCanSeeTarget(oldUser.role, actorRole);
    if (dto.role) {
      this.assertCanManageRole(dto.role, actorRole);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        full_name: dto.full_name?.trim(),
        role: dto.role,
        password_hash: dto.password ? this.hashPassword(dto.password) : undefined,
        is_active: dto.is_active
      },
      select: userSelect
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_USER",
      tableName: "users",
      recordId: user.id,
      oldValue: oldUser,
      newValue: user
    });

    return {
      success: true,
      code: "USER_UPDATED",
      message: "Đã cập nhật người dùng.",
      data: user
    };
  }

  async deactivateUser(id: number, actorUserId?: number | null, actorRole?: UserRole) {
    const oldUser = await this.ensureUser(id);
    this.assertCanSeeTarget(oldUser.role, actorRole);
    const user = await this.prisma.user.update({
      where: { id },
      data: { is_active: false },
      select: userSelect
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DEACTIVATE_USER",
      tableName: "users",
      recordId: user.id,
      oldValue: oldUser,
      newValue: user
    });

    return {
      success: true,
      code: "USER_DEACTIVATED",
      message: "Đã vô hiệu hóa người dùng.",
      data: user
    };
  }

  private async ensureUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        code: "USER_NOT_FOUND",
        message: "Không tìm thấy người dùng."
      });
    }

    return user;
  }

  private hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString("base64url");
    const iterations = 120000;
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
    return `pbkdf2$sha256$${iterations}$${salt}$${hash}`;
  }

  private assertCanManageRole(targetRole: UserRole, actorRole?: UserRole) {
    if (targetRole === "DEV" && actorRole !== "DEV") {
      throw new ForbiddenException({
        success: false,
        code: "DEV_ROLE_HIDDEN",
        message: "Vai trò không khả dụng."
      });
    }
  }

  private assertCanSeeTarget(targetRole: UserRole, actorRole?: UserRole) {
    if (targetRole === "DEV" && actorRole !== "DEV") {
      throw new NotFoundException({
        success: false,
        code: "USER_NOT_FOUND",
        message: "Không tìm thấy người dùng."
      });
    }
  }

  private assertAdminRecovery(actorRole?: UserRole) {
    if (actorRole !== "ADMIN") {
      throw new ForbiddenException({
        success: false,
        code: "DEV_RECOVERY_ADMIN_REQUIRED",
        message: "Chỉ ADMIN đã đăng nhập mới được khôi phục tài khoản DEV."
      });
    }
  }
}
