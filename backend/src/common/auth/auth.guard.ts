import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { AuthService } from "../../modules/auth/auth.service";
import { IS_PUBLIC_KEY, ROLES_KEY } from "./auth.decorators";
import type { AuthenticatedRequest } from "./authenticated-request.type";

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException({
        success: false,
        code: "AUTH_TOKEN_REQUIRED",
        message: "Cần bearer token xác thực."
      });
    }

    const user = await this.authService.authenticateToken(token);
    request.user = user;

    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      throw new ForbiddenException({
        success: false,
        code: "AUTH_ROLE_FORBIDDEN",
        message: "Vai trò hiện tại không được phép thực hiện thao tác này."
      });
    }

    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest) {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");
    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }
}
