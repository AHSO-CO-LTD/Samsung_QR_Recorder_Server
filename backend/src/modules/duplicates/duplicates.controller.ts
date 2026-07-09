import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
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
}
