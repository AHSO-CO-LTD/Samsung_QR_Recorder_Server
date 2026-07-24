import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.type";
import { RunHistoricalDuplicateJobDto, UpsertHistoricalDuplicateScheduleDto } from "./dto/historical-duplicate-job.dto";
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

  @Get("full-audit/schedule")
  @ApiOkResponse({ description: "Get full database duplicate audit schedule and latest job." })
  getFullAuditSchedule() {
    return this.duplicatesService.getFullAuditSchedule();
  }

  @Post("full-audit/run")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Run a full database duplicate audit over all final OK scans." })
  runFullAuditJob(@Req() request: AuthenticatedRequest) {
    return this.duplicatesService.runFullAuditJob(request.user?.id);
  }

  @Put("full-audit/schedule")
  @Roles("ADMIN", "DEV")
  @ApiOkResponse({ description: "Create or update full database duplicate audit schedule." })
  upsertFullAuditSchedule(@Body() dto: UpsertHistoricalDuplicateScheduleDto, @Req() request: AuthenticatedRequest) {
    return this.duplicatesService.upsertFullAuditSchedule(dto, request.user?.id);
  }

  @Get("full-audit/jobs")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiQuery({ name: "skip", required: false, example: 0 })
  @ApiOkResponse({ description: "List scheduled, full database, and date-range duplicate audit runs." })
  listFullAuditJobs(@Query("take") take?: string, @Query("skip") skip?: string) {
    return this.duplicatesService.listFullAuditJobs(Number(take || 100), Number(skip || 0));
  }

  @Get("full-audit/jobs/:id/detail")
  @ApiOkResponse({ description: "Get one duplicate audit run summary and duplicate detail." })
  getFullAuditJobDetail(@Param("id") id: string) {
    return this.duplicatesService.getFullAuditJobDetail(Number(id));
  }

  @Get("full-audit/results")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiQuery({ name: "skip", required: false, example: 0 })
  @ApiQuery({ name: "job_id", required: false, example: 1 })
  @ApiOkResponse({ description: "List results for a selected duplicate audit run." })
  listFullAuditResults(@Query("take") take?: string, @Query("skip") skip?: string, @Query("job_id") jobId?: string) {
    return this.duplicatesService.listFullAuditResults(Number(take || 100), Number(skip || 0), jobId ? Number(jobId) : undefined);
  }

  @Post("historical-jobs/run")
  @Roles("ADMIN", "ENGINEER", "DEV")
  @ApiOkResponse({ description: "Run a historical duplicate report over final OK scans." })
  runHistoricalJob(@Body() dto: RunHistoricalDuplicateJobDto, @Req() request: AuthenticatedRequest) {
    return this.duplicatesService.runHistoricalJob(dto, request.user?.id);
  }
}
