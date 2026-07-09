import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

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
}
