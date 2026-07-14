import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";
import { CreateFirstAdminDto } from "./dto/create-first-admin.dto";
import { SetupService } from "./setup.service";

@ApiTags("server-ui")
@Public()
@Controller("setup")
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get("status")
  @ApiOkResponse({ description: "Return first-run setup status." })
  getStatus() {
    return this.setup.getStatus();
  }

  @Post("admin")
  @ApiOkResponse({ description: "Create the first admin account when none exists." })
  createFirstAdmin(@Body() dto: CreateFirstAdminDto) {
    return this.setup.createFirstAdmin(dto);
  }
}
