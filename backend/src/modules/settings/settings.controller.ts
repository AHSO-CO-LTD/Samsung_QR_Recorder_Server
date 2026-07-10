import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { UpsertServerSettingsDto } from "./dto/server-settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("server-ui")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("server")
  @ApiOkResponse({ description: "Get server duplicate and parsing defaults." })
  getServerSettings() {
    return this.settingsService.getServerSettings();
  }

  @Put("server")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Create or update server duplicate and parsing defaults." })
  upsertServerSettings(@Body() dto: UpsertServerSettingsDto, @Req() request: AuthenticatedRequest) {
    return this.settingsService.upsertServerSettings(dto, request.user?.id);
  }
}
