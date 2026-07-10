import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import { AuditService } from "./audit.service";

@ApiTags("server-ui")
@Roles("ADMIN", "ENGINEER", "DEV")
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiOkResponse({ description: "List latest audit logs." })
  listAuditLogs(@Query("take") take?: string) {
    return this.auditService.listAuditLogs(Number(take || 100));
  }
}
