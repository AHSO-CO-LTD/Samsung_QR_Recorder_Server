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
  @ApiOkResponse({ description: "Login with a server UI user account." })
  @ApiUnauthorizedResponse({ description: "Invalid username/password or inactive account." })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("validate")
  @ApiOkResponse({ description: "Validate a remembered/session token." })
  @ApiUnauthorizedResponse({ description: "Token is invalid, expired, or user is inactive." })
  validate(@Body() dto: ValidateSessionDto) {
    return this.authService.validateToken(dto.token);
  }
}
