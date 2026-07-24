import { Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ValidateSessionDto } from "./dto/validate-session.dto";

@ApiTags("server-ui")
@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOkResponse({ description: "Đăng nhập bằng tài khoản giao diện máy chủ." })
  @ApiUnauthorizedResponse({ description: "Sai tên đăng nhập/mật khẩu hoặc tài khoản đã bị tắt." })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("validate")
  @ApiOkResponse({ description: "Kiểm tra token phiên hoặc token đã nhớ." })
  @ApiUnauthorizedResponse({ description: "Token không hợp lệ, đã hết hạn hoặc người dùng đã bị tắt." })
  validate(@Body() dto: ValidateSessionDto) {
    return this.authService.validateToken(dto.token);
  }
}
