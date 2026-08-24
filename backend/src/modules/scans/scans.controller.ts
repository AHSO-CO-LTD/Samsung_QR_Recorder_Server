import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";
import { SubmitScanDto } from "./dto/submit-scan.dto";
import { RUNTIME_SUMMARY_SCOPES, type RuntimeSummaryScope } from "./runtime-summary-range";
import {
  ERROR_RANKING_SCOPES,
  SCAN_TREND_SCOPES,
  type ErrorRankingScope,
  type ScanTrendScope
} from "./scan-trend-range";
import { ScansService } from "./scans.service";

@Controller("scans")
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post("submit")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Submit one scan from a Python local machine." })
  submitScan(@Body() dto: SubmitScanDto) {
    return this.scansService.submitScan(dto);
  }

  @Get("summary")
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "from", required: false, example: "2026-07-10T00:00:00+07:00" })
  @ApiQuery({ name: "to", required: false, example: "2026-07-10T23:59:59+07:00" })
  @ApiOkResponse({ description: "Get scan summary counters. Without a range, daily counters use the current GMT+7 day." })
  getScanSummary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.scansService.getScanSummary({ from, to });
  }

  @Get("runtime-summary")
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "scope", required: true, enum: RUNTIME_SUMMARY_SCOPES })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01", description: "Required for scope=since. App date in GMT+7." })
  @ApiOkResponse({ description: "Get per-machine OK/NG/REWORK totals for the selected app-time range." })
  getRuntimeSummary(@Query("scope") scope?: RuntimeSummaryScope, @Query("from") from?: string) {
    return this.scansService.getRuntimeSummary({ scope, from });
  }

  @Get("trend")
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "days", required: false, example: 7 })
  @ApiQuery({ name: "hours", required: false, example: 12 })
  @ApiQuery({ name: "bucket_minutes", required: false, example: 30 })
  @ApiQuery({ name: "machine_code", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "scope", required: false, enum: SCAN_TREND_SCOPES })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01", description: "Required for scope=since. App date in GMT+7." })
  @ApiOkResponse({ description: "Get daily or bucketed scan trend counters for dashboard chart." })
  getScanTrend(
    @Query("days") days?: string,
    @Query("hours") hours?: string,
    @Query("bucket_minutes") bucketMinutes?: string,
    @Query("machine_code") machineCode?: string,
    @Query("scope") scope?: ScanTrendScope,
    @Query("from") from?: string
  ) {
    return this.scansService.getScanTrend({
      days: Number(days || 7),
      hours: hours ? Number(hours) : undefined,
      bucketMinutes: bucketMinutes ? Number(bucketMinutes) : undefined,
      machineCode: machineCode?.trim() || undefined,
      scope,
      from
    });
  }

  @Get("error-ranking")
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "scope", required: true, enum: ERROR_RANKING_SCOPES })
  @ApiOkResponse({ description: "Rank observed NG reason codes by affected scan count for the selected app-time range." })
  getErrorRanking(@Query("scope") scope?: ErrorRankingScope) {
    return this.scansService.getErrorRanking({ scope });
  }

  @Get("machine-error-ranking")
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "machine_code", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "line_name", required: false, example: "LINE-01" })
  @ApiQuery({ name: "profile_id", required: false, example: 1 })
  @ApiQuery({ name: "vendor_char", required: false, example: "S" })
  @ApiQuery({ name: "final_status", required: false, enum: ["OK", "NG", "NG_REWORK", "REWORK", "PENDING"] })
  @ApiQuery({ name: "ng_reason", required: false, example: "SERVER_DUPLICATE" })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01T00:00:00+07:00" })
  @ApiQuery({ name: "to", required: false, example: "2026-07-10T23:59:59+07:00" })
  @ApiOkResponse({ description: "Rank all active machines by their share of filtered NG scans." })
  getMachineErrorRanking(
    @Query("machine_code") machineCode?: string,
    @Query("line_name") lineName?: string,
    @Query("profile_id") profileId?: string,
    @Query("vendor_char") vendorChar?: string,
    @Query("final_status") finalStatus?: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING",
    @Query("ng_reason") ngReason?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.scansService.getMachineErrorRanking({
      machine_code: machineCode?.trim() || undefined,
      line_name: lineName?.trim() || undefined,
      profile_id: profileId ? Number(profileId) : undefined,
      vendor_char: vendorChar?.trim() || undefined,
      final_status: finalStatus,
      ng_reason: ngReason?.trim() || undefined,
      from,
      to
    });
  }

  @Get("history-analytics")
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "machine_code", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "line_name", required: false, example: "LINE-01" })
  @ApiQuery({ name: "profile_id", required: false, example: 1 })
  @ApiQuery({ name: "vendor_char", required: false, example: "S" })
  @ApiQuery({ name: "final_status", required: false, enum: ["OK", "NG", "NG_REWORK", "REWORK", "PENDING"] })
  @ApiQuery({ name: "ng_reason", required: false, example: "SERVER_DUPLICATE" })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01T00:00:00+07:00" })
  @ApiQuery({ name: "to", required: false, example: "2026-07-10T23:59:59+07:00" })
  @ApiOkResponse({ description: "Load scan summary and filtered error ranking in one request." })
  getHistoryAnalytics(
    @Query("machine_code") machineCode?: string,
    @Query("line_name") lineName?: string,
    @Query("profile_id") profileId?: string,
    @Query("vendor_char") vendorChar?: string,
    @Query("final_status") finalStatus?: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING",
    @Query("ng_reason") ngReason?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.scansService.getHistoryAnalytics({
      machine_code: machineCode?.trim() || undefined,
      line_name: lineName?.trim() || undefined,
      profile_id: profileId ? Number(profileId) : undefined,
      vendor_char: vendorChar?.trim() || undefined,
      final_status: finalStatus,
      ng_reason: ngReason?.trim() || undefined,
      from,
      to
    });
  }

  @Get()
  @ApiTags("scan-dashboard")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiQuery({ name: "skip", required: false, example: 0 })
  @ApiQuery({ name: "include_details", required: false, enum: ["true", "false"], description: "Set false for a lightweight table response. Defaults to true for backward compatibility." })
  @ApiQuery({ name: "q", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "machine_code", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "line_name", required: false, example: "LINE-01" })
  @ApiQuery({ name: "profile_id", required: false, example: 1 })
  @ApiQuery({ name: "vendor_char", required: false, example: "S" })
  @ApiQuery({ name: "final_status", required: false, enum: ["OK", "NG", "NG_REWORK", "REWORK", "PENDING"] })
  @ApiQuery({ name: "ng_reason", required: false, example: "SERVER_DUPLICATE", description: "Match the NG reason on the scan record only." })
  @ApiQuery({ name: "duplicate_only", required: false, enum: ["true", "false"], description: "Include duplicate scans detected by either the local machine or server." })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01T00:00:00+07:00" })
  @ApiQuery({ name: "to", required: false, example: "2026-07-10T23:59:59+07:00" })
  @ApiOkResponse({ description: "List latest scan records for the server UI." })
  listScans(
    @Query("take") take?: string,
    @Query("skip") skip?: string,
    @Query("include_details") includeDetails?: string,
    @Query("q") q?: string,
    @Query("machine_code") machineCode?: string,
    @Query("line_name") lineName?: string,
    @Query("profile_id") profileId?: string,
    @Query("vendor_char") vendorChar?: string,
    @Query("final_status") finalStatus?: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING",
    @Query("ng_reason") ngReason?: string,
    @Query("duplicate_only") duplicateOnly?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.scansService.listLatestScans({
      take: Number(take || 100),
      skip: Number(skip || 0),
      include_details: includeDetails !== "false",
      q: q?.trim() || undefined,
      machine_code: machineCode?.trim() || undefined,
      line_name: lineName?.trim() || undefined,
      profile_id: profileId ? Number(profileId) : undefined,
      vendor_char: vendorChar?.trim() || undefined,
      final_status: finalStatus,
      ng_reason: ngReason?.trim() || undefined,
      duplicate_only: duplicateOnly === "true",
      from,
      to
    });
  }

  @Get(":id")
  @ApiTags("scan-dashboard")
  @ApiOkResponse({ description: "Load one scan with profile and LED details." })
  getScanDetails(@Param("id", ParseIntPipe) id: number) {
    return this.scansService.getScanDetails(id);
  }
}
