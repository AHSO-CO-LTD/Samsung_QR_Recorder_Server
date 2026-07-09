import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
}
