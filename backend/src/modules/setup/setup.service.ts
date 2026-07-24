import crypto from "node:crypto";
import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFirstAdminDto } from "./dto/create-first-admin.dto";

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const [userCount, adminCount, devCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "ADMIN", is_active: true } }),
      this.prisma.user.count({ where: { role: "DEV", is_active: true } })
    ]);

    return {
      success: true,
      code: "SETUP_STATUS",
      message: "Đã tải trạng thái thiết lập.",
      data: {
        initialized: adminCount > 0,
        requiresAdminSetup: adminCount === 0,
        userCount,
        adminCount,
        devSupportReady: devCount > 0
      }
    };
  }

  async createFirstAdmin(dto: CreateFirstAdminDto) {
    const adminCount = await this.prisma.user.count({ where: { role: "ADMIN", is_active: true } });
    if (adminCount > 0) {
      throw new ConflictException({
        success: false,
        code: "SETUP_ADMIN_ALREADY_EXISTS",
        message: "Tài khoản quản trị đã tồn tại."
      });
    }

    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        full_name: dto.full_name.trim(),
        password_hash: this.hashPassword(dto.password),
        role: "ADMIN",
        is_active: true
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true
      }
    });

    return {
      success: true,
      code: "SETUP_FIRST_ADMIN_CREATED",
      message: "Đã tạo tài khoản quản trị đầu tiên.",
      data: user
    };
  }

  private hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString("base64url");
    const iterations = 120000;
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
    return `pbkdf2$sha256$${iterations}$${salt}$${hash}`;
  }
}
