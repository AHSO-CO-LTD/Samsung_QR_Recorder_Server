import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";

@ApiTags("local-machine")
@Public()
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "API health state." })
  getHealth() {
    return {
      success: true,
      code: "HEALTH_OK",
      message: "API máy chủ đang chạy.",
      data: {
        status: "ok",
        service: "qr-recorder-server-api",
        timestamp: new Date().toISOString()
      }
    };
  }
}
