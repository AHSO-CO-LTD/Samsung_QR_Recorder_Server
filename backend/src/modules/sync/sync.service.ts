import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ScansService } from "../scans/scans.service";
import { SubmitScanBatchDto } from "./dto/submit-scan-batch.dto";

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scansService: ScansService
  ) {}

  async listBatches(take: number) {
    const batches = await this.prisma.scanSyncBatch.findMany({
      take: Math.min(Math.max(take || 50, 1), 200),
      orderBy: { created_at: "desc" },
      include: {
        machine: true
      }
    });

    return {
      success: true,
      code: "SYNC_BATCHES_LISTED",
      message: "Sync batches loaded.",
      data: batches
    };
  }

  async listRequestLogs(take: number) {
    const logs = await this.prisma.syncRequestLog.findMany({
      take: Math.min(Math.max(take || 100, 1), 500),
      orderBy: { created_at: "desc" },
      include: {
        machine: true
      }
    });

    return {
      success: true,
      code: "SYNC_REQUEST_LOGS_LISTED",
      message: "Sync request logs loaded.",
      data: logs
    };
  }

  async submitBatch(dto: SubmitScanBatchDto) {
    const machine = await this.prisma.machine.findUnique({
      where: { machine_code: dto.machine_code }
    });

    if (!machine || !machine.is_active) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Machine code does not exist or is inactive."
      });
    }

    const batch = await this.prisma.scanSyncBatch.upsert({
      where: { batch_code: dto.batch_code },
      create: {
        batch_code: dto.batch_code,
        machine_id: machine.id,
        trigger_type: dto.trigger_type,
        total_received: dto.scans.length,
        status: "PROCESSING",
        summary_json: dto.summary_json === undefined ? undefined : JSON.parse(JSON.stringify(dto.summary_json)),
        started_at: new Date()
      },
      update: {
        total_received: dto.scans.length,
        status: "PROCESSING",
        summary_json: dto.summary_json === undefined ? undefined : JSON.parse(JSON.stringify(dto.summary_json)),
        started_at: new Date(),
        finished_at: null
      }
    });

    const results = [];
    let totalOk = 0;
    let totalNg = 0;
    let totalFailed = 0;

    for (const scan of dto.scans) {
      if (scan.machine_code !== dto.machine_code) {
        totalFailed += 1;
        results.push({
          local_scan_id: scan.local_scan_id,
          success: false,
          code: "BATCH_MACHINE_CODE_MISMATCH",
          message: "Scan machine_code does not match batch machine_code."
        });
        continue;
      }

      try {
        const result = await this.scansService.submitScan(scan, {
          syncBatchId: batch.id,
          batchCode: dto.batch_code,
          requestType: "BATCH_SUBMIT_SCAN"
        });
        if (result.data?.final_status === "OK") {
          totalOk += 1;
        } else {
          totalNg += 1;
        }
        results.push({
          local_scan_id: scan.local_scan_id,
          ...result
        });
      } catch (error) {
        totalFailed += 1;
        results.push({
          local_scan_id: scan.local_scan_id,
          ...this.extractErrorPayload(error)
        });
      }
    }

    const finalBatch = await this.prisma.scanSyncBatch.update({
      where: { id: batch.id },
      data: {
        total_ok: totalOk,
        total_ng: totalNg,
        status: totalFailed > 0 ? "FAILED" : "DONE",
        finished_at: new Date(),
        summary_json: JSON.parse(
          JSON.stringify({
            input: dto.summary_json ?? null,
            total_failed: totalFailed,
            results
          })
        )
      },
      include: {
        machine: true
      }
    });

    await this.prisma.syncRequestLog.create({
      data: {
        machine_id: machine.id,
        batch_code: dto.batch_code,
        request_type: "BATCH_SUBMIT",
        payload_json: JSON.parse(JSON.stringify(dto)),
        response_json: JSON.parse(JSON.stringify({ batch: finalBatch, results })),
        status: totalFailed > 0 ? "FAILED" : "OK",
        error_message: totalFailed > 0 ? `${totalFailed} scan(s) failed in batch.` : null
      }
    });

    return {
      success: totalFailed === 0,
      code: totalFailed > 0 ? "BATCH_SUBMIT_PARTIAL_FAILED" : "BATCH_SUBMIT_DONE",
      message: totalFailed > 0 ? "Batch submitted with failed scan records." : "Batch submitted.",
      data: {
        batch: finalBatch,
        results
      }
    };
  }

  private extractErrorPayload(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      return typeof response === "string"
        ? {
            success: false,
            code: "BATCH_SCAN_FAILED",
            message: response
          }
        : response;
    }

    if (error instanceof Error) {
      return {
        success: false,
        code: "BATCH_SCAN_FAILED",
        message: error.message
      };
    }

    return {
      success: false,
      code: "BATCH_SCAN_FAILED",
      message: String(error)
    };
  }
}
