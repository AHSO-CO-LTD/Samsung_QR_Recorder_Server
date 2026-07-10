import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";
import { SubmitScanDto } from "./dto/submit-scan.dto";
import { ScansService } from "./scans.service";

@ApiTags("local-machine")
@Controller("scans")
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post("submit")
  @Public()
  @ApiOkResponse({ description: "Submit one scan from a Python local machine." })
  submitScan(@Body() dto: SubmitScanDto) {
    return this.scansService.submitScan(dto);
  }

  @Get("summary")
  @ApiTags("server-ui")
  @ApiQuery({ name: "from", required: false, example: "2026-07-10T00:00:00+07:00" })
  @ApiQuery({ name: "to", required: false, example: "2026-07-10T23:59:59+07:00" })
  @ApiOkResponse({ description: "Get scan summary counters for dashboard/reporting." })
  getScanSummary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.scansService.getScanSummary({ from, to });
  }

  @Get()
  @ApiTags("server-ui")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiQuery({ name: "machine_code", required: false, example: "LOCAL01" })
  @ApiQuery({ name: "profile_id", required: false, example: 1 })
  @ApiQuery({ name: "final_status", required: false, enum: ["OK", "NG", "PENDING"] })
  @ApiQuery({ name: "from", required: false, example: "2026-07-01T00:00:00+07:00" })
  @ApiQuery({ name: "to", required: false, example: "2026-07-10T23:59:59+07:00" })
  @ApiOkResponse({ description: "List latest scan records for the server UI." })
  listScans(
    @Query("take") take?: string,
    @Query("machine_code") machineCode?: string,
    @Query("profile_id") profileId?: string,
    @Query("final_status") finalStatus?: "OK" | "NG" | "PENDING",
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.scansService.listLatestScans({
      take: Number(take || 50),
      machine_code: machineCode,
      profile_id: profileId ? Number(profileId) : undefined,
      final_status: finalStatus,
      from,
      to
    });
  }
}
