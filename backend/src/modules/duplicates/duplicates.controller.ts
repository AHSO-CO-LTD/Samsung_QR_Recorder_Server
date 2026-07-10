import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { RunHistoricalDuplicateJobDto } from "./dto/historical-duplicate-job.dto";
import { DuplicatesService } from "./duplicates.service";

@ApiTags("server-ui")
@Controller("duplicates")
export class DuplicatesController {
  constructor(private readonly duplicatesService: DuplicatesService) {}

  @Get("recent-keys")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiOkResponse({ description: "List active duplicate keys in the server window." })
  listRecentKeys(@Query("take") take?: string) {
    return this.duplicatesService.listRecentKeys(Number(take || 100));
  }

  @Get("historical-results")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiOkResponse({ description: "List latest historical duplicate report results." })
  listHistoricalResults(@Query("take") take?: string) {
    return this.duplicatesService.listHistoricalResults(Number(take || 100));
  }

  @Post("historical-jobs/run")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Run a historical duplicate report over final OK scans." })
  runHistoricalJob(@Body() dto: RunHistoricalDuplicateJobDto, @Req() request: AuthenticatedRequest) {
    return this.duplicatesService.runHistoricalJob(dto, request.user?.id);
  }
}
