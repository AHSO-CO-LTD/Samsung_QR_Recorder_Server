import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ProfilesService } from "./profiles.service";

@ApiTags("server-ui")
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOkResponse({ description: "List product profiles with chassis, vendor, and LED settings." })
  listProfiles() {
    return this.profilesService.listProfiles();
  }
}
