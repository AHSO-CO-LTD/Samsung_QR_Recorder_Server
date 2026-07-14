import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";
import { getClientIp, type RequestWithClientIp } from "../../common/http/client-ip";
import { ReconcileCheckDto, ReconcilePullDto } from "./dto/reconcile-sync.dto";
import { SubmitScanBatchDto } from "./dto/submit-scan-batch.dto";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get("batches")
  @ApiTags("sync-dashboard")
  @ApiQuery({ name: "take", required: false, example: 50 })
  @ApiOkResponse({ description: "List latest local machine sync batches." })
  listBatches(@Query("take") take?: string) {
    return this.syncService.listBatches(Number(take || 50));
  }

  @Get("request-logs")
  @ApiTags("sync-dashboard")
  @ApiQuery({ name: "take", required: false, example: 100 })
  @ApiOkResponse({ description: "List request/response logs from local machines." })
  listRequestLogs(@Query("take") take?: string) {
    return this.syncService.listRequestLogs(Number(take || 100));
  }

  @Post("batches/submit")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Submit a batch of pending/offline scans from a local machine." })
  submitBatch(@Body() dto: SubmitScanBatchDto, @Req() request: RequestWithClientIp) {
    return this.syncService.submitBatch(dto, getClientIp(request));
  }

  @Post("reconcile/check")
  @ApiTags("local-machine")
  @Public()
  @ApiBody({
    schema: {
      example: {
        serial: "SN-LOCAL01-2026",
        uid: "UID-8f8f2f1c-local01"
      }
    }
  })
  @ApiOkResponse({ description: "Compare local scan manifest with server records by serial and uid." })
  reconcileCheck(@Body() dto: ReconcileCheckDto, @Req() request: RequestWithClientIp) {
    return this.syncService.reconcileCheck(dto, getClientIp(request));
  }

  @Post("reconcile/pull")
  @ApiTags("local-machine")
  @Public()
  @ApiOkResponse({ description: "Pull server scan records for local database repair by serial and uid." })
  reconcilePull(@Body() dto: ReconcilePullDto) {
    return this.syncService.reconcilePull(dto);
  }
}
