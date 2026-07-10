import crypto from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

type AuthUser = {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
};

type SessionPayload = {
  sub: number;
  username: string;
  role: UserRole;
  exp: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async login(dto: LoginDto) {
    const username = dto.username.trim();
    const user = await this.prisma.user.findUnique({
      where: { username }
    });

    if (!user || !user.is_active || !this.verifyPassword(dto.password, user.password_hash)) {
      throw new UnauthorizedException({
        success: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Tên đăng nhập hoặc mật khẩu không đúng."
      });
    }

    const safeUser: AuthUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };
    const token = this.signToken(safeUser, Boolean(dto.remember_password));

    return {
      success: true,
      code: "AUTH_LOGIN_OK",
      message: "Đăng nhập thành công.",
      data: {
        user: safeUser,
        token,
        remember_password: Boolean(dto.remember_password)
      }
    };
  }

  async validateToken(token: string) {
    const user = await this.authenticateToken(token);

    return {
      success: true,
      code: "AUTH_SESSION_OK",
      message: "Phiên đăng nhập hợp lệ.",
      data: {
        user
      }
    };
  }

  async authenticateToken(token: string): Promise<AuthUser> {
    const payload = this.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException({
        success: false,
        code: "AUTH_SESSION_INVALID",
        message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException({
        success: false,
        code: "AUTH_USER_INACTIVE",
        message: "Tài khoản đã bị khóa hoặc không tồn tại."
      });
    }

    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [algorithm, digest, iterationsText, salt, storedHash] = passwordHash.split("$");
    if (algorithm !== "pbkdf2" || digest !== "sha256" || !iterationsText || !salt || !storedHash) {
      return false;
    }

    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < 1) {
      return false;
    }

    const currentHash = crypto.pbkdf2Sync(password, salt, iterations, 32, digest).toString("base64url");
    const storedBuffer = Buffer.from(storedHash);
    const currentBuffer = Buffer.from(currentHash);
    return storedBuffer.length === currentBuffer.length && crypto.timingSafeEqual(storedBuffer, currentBuffer);
  }

  private signToken(user: AuthUser, rememberPassword: boolean) {
    const ttlSeconds = rememberPassword ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
    const payload: SessionPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private verifyToken(token: string): SessionPayload | null {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = this.sign(encodedPayload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
      if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private sign(value: string) {
    const secret = this.config.get<string>("AUTH_TOKEN_SECRET", "samsung-qr-recorder-dev-secret");
    return crypto.createHmac("sha256", secret).update(value).digest("base64url");
  }
}
