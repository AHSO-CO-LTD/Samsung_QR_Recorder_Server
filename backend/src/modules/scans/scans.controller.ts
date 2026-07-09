import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SubmitScanDto } from "./dto/submit-scan.dto";
import { ScansService } from "./scans.service";

@ApiTags("local-machine")
@Controller("scans")
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post("submit")
  @ApiOkResponse({ description: "Submit one scan from a Python local machine." })
  submitScan(@Body() dto: SubmitScanDto) {
    return this.scansService.submitScan(dto);
  }

  @Get()
  @ApiTags("server-ui")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "List latest scan records for the server UI." })
  listScans(@Query("take") take?: string) {
    return this.scansService.listLatestScans(Number(take || 50));
  }
}
