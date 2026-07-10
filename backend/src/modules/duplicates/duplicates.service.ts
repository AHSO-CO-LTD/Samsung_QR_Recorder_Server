import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RunHistoricalDuplicateJobDto } from "./dto/historical-duplicate-job.dto";

@Injectable()
export class DuplicatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listRecentKeys(take: number) {
    const keys = await this.prisma.recentDuplicateKey.findMany({
      take: Math.min(Math.max(take || 100, 1), 500),
      orderBy: { created_at: "desc" },
      include: {
        profile: {
          include: {
            chassis_code: true
          }
        },
        first_machine: true,
        first_scan_record: true
      }
    });

    return {
      success: true,
      code: "RECENT_DUPLICATE_KEYS_LISTED",
      message: "Recent duplicate keys loaded.",
      data: keys
    };
  }

  async listHistoricalResults(take: number) {
    const results = await this.prisma.historicalDuplicateResult.findMany({
      take: Math.min(Math.max(take || 100, 1), 500),
      orderBy: { created_at: "desc" },
      include: {
        job: true,
        profile: {
          include: {
            chassis_code: true
          }
        }
      }
    });

    return {
      success: true,
      code: "HISTORICAL_DUPLICATES_LISTED",
      message: "Historical duplicate results loaded.",
      data: results
    };
  }

  async runHistoricalJob(dto: RunHistoricalDuplicateJobDto, actorUserId?: number | null) {
    const fromDate = new Date(dto.from_date);
    const toDate = new Date(dto.to_date);

    const job = await this.prisma.historicalDuplicateJob.create({
      data: {
        profile_id: dto.profile_id ?? null,
        from_date: fromDate,
        to_date: toDate,
        status: "RUNNING",
        started_at: new Date(),
        created_by: dto.created_by ?? actorUserId ?? null
      }
    });

    const duplicateGroups = (
      await this.prisma.scanRecord.groupBy({
      by: ["profile_id", "duplicate_key"],
      where: {
        profile_id: dto.profile_id,
        final_status: "OK",
        scan_at: {
          gte: fromDate,
          lte: toDate
        }
      },
      _count: {
        _all: true
      }
      })
    ).filter((group) => group._count._all > 1);

    const results = [];
    for (const group of duplicateGroups) {
      const scans = await this.prisma.scanRecord.findMany({
        where: {
          profile_id: group.profile_id,
          duplicate_key: group.duplicate_key,
          final_status: "OK",
          scan_at: {
            gte: fromDate,
            lte: toDate
          }
        },
        orderBy: { scan_at: "asc" },
        select: {
          id: true,
          scan_at: true
        }
      });

      const result = await this.prisma.historicalDuplicateResult.create({
        data: {
          job_id: job.id,
          profile_id: group.profile_id,
          duplicate_key: group.duplicate_key,
          total_count: group._count._all,
          first_scan_at: scans[0]?.scan_at ?? fromDate,
          latest_scan_at: scans[scans.length - 1]?.scan_at ?? toDate,
          scan_record_ids_json: scans.map((scan) => scan.id)
        }
      });
      results.push(result);
    }

    const finalJob = await this.prisma.historicalDuplicateJob.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        finished_at: new Date()
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "RUN_HISTORICAL_DUPLICATE_JOB",
      tableName: "historical_duplicate_jobs",
      recordId: finalJob.id,
      newValue: {
        job: finalJob,
        result_count: results.length
      }
    });

    return {
      success: true,
      code: "HISTORICAL_DUPLICATE_JOB_DONE",
      message: "Historical duplicate job completed.",
      data: {
        job: finalJob,
        results
      }
    };
  }
}
