import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SyncService } from "./sync.service";

@ApiTags("server-ui")
@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get("batches")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "List latest local machine sync batches." })
  listBatches(@Query("take") take?: string) {
    return this.syncService.listBatches(Number(take || 50));
  }

  @Get("request-logs")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiOkResponse({ description: "List request/response logs from local machines." })
  listRequestLogs(@Query("take") take?: string) {
    return this.syncService.listRequestLogs(Number(take || 100));
  }
}
