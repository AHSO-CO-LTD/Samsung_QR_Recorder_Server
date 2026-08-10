import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RUNTIME_SUMMARY_SCOPES, type RuntimeSummaryScope } from "../scans/runtime-summary-range";
import { DashboardService, type DashboardRuntimeScope } from "./dashboard.service";

const DASHBOARD_RUNTIME_SCOPES = ["session", ...RUNTIME_SUMMARY_SCOPES] as const;

@Controller("dashboard")
@ApiTags("scan-dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("runtime-overview")
  @ApiQuery({ name: "scope", required: true, enum: DASHBOARD_RUNTIME_SCOPES })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01", description: "Required for scope=since. App date in GMT+7." })
  @ApiQuery({ name: "trend_hours", required: false, example: 12 })
  @ApiQuery({ name: "bucket_minutes", required: false, example: 30 })
  @ApiOkResponse({ description: "Load active machines, latest runtime sessions, scoped counters, latest scans and aggregated trends in one response." })
  getRuntimeOverview(
    @Query("scope") scope?: DashboardRuntimeScope,
    @Query("from") from?: string,
    @Query("trend_hours") trendHours?: string,
    @Query("bucket_minutes") bucketMinutes?: string
  ) {
    return this.dashboardService.getRuntimeOverview({
      scope,
      from,
      trendHours: Number(trendHours || 12),
      bucketMinutes: Number(bucketMinutes || 30)
    });
  }
}
