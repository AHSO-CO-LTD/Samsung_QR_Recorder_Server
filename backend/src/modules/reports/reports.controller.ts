import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ScanReportQueryDto } from "./dto/scan-report-query.dto";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("scan-export")
  @ApiOkResponse({ description: "Export scan report to an Excel workbook." })
  async exportScanReport(@Query() query: ScanReportQueryDto, @Res() response: { setHeader: (name: string, value: string) => void; send: (body: Buffer) => void }) {
    const report = await this.reportsService.buildScanReport(query);

    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="${report.fileName}"`);
    response.send(report.buffer);
  }
}
