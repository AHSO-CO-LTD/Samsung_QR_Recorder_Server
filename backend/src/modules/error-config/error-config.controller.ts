import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { UpsertErrorDefinitionDto } from "./dto/upsert-error-definition.dto";
import { ErrorConfigService } from "./error-config.service";

@ApiTags("server-ui")
@Controller("error-config")
export class ErrorConfigController {
  constructor(private readonly errorConfigService: ErrorConfigService) {}

  @Get()
  @ApiOkResponse({ description: "List configured and observed NG reason codes." })
  listErrorDefinitions() {
    return this.errorConfigService.listErrorDefinitions();
  }

  @Put()
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Identify or update one NG reason code." })
  upsertErrorDefinition(
    @Body() dto: UpsertErrorDefinitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.errorConfigService.upsertErrorDefinition(dto, request.user?.id);
  }
}
