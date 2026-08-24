import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveLogicalResultCounts } from "../../common/results/logical-result-counts";
import { PrismaService } from "../../prisma/prisma.service";
import { RuntimeService } from "../runtime/runtime.service";
import {
  isRuntimeSummaryScope,
  resolveRuntimeSummaryRange,
  type RuntimeSummaryScope
} from "../scans/runtime-summary-range";

export type DashboardRuntimeScope = "session" | RuntimeSummaryScope;

type TrendAggregateRow = {
  machine_id: number;
  bucket_epoch: bigint;
  ok: bigint;
  ng: bigint;
  rework: bigint;
  pending: bigint;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeService: RuntimeService
  ) {}

  async getRuntimeOverview(query: {
    scope?: DashboardRuntimeScope;
    from?: string;
    trendHours: number;
    bucketMinutes: number;
  }) {
    const scope = this.validateScope(query.scope);
    const trendHours = this.clampInteger(query.trendHours, 1, 72, 12);
    const bucketMinutes = this.clampInteger(query.bucketMinutes, 5, 240, 30);
    const generatedAt = new Date();

    const machines = await this.prisma.machine.findMany({
      where: { is_active: true },
      orderBy: [{ line_name: "asc" }, { machine_code: "asc" }],
      select: {
        id: true,
        machine_code: true,
        machine_name: true,
        serial: true,
        uid: true,
        line_name: true,
        station_name: true,
        ip_address: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        sync_state: true
      }
    });
    const machineIds = machines.map((machine) => machine.id);

    if (machineIds.length === 0) {
      return this.buildResponse(generatedAt, machines, [], [], {});
    }

    const [sessions, groupedCounts, trendRows] = await Promise.all([
      this.runtimeService.listLatestSessionsForMachines(machineIds),
      this.loadScopedCounts(machineIds, scope, query.from, generatedAt),
      this.loadAggregatedTrends(machineIds, trendHours, bucketMinutes, generatedAt)
    ]);

    const machineCodeById = new Map(machines.map((machine) => [machine.id, machine.machine_code] as const));
    const resultSummary = this.buildResultSummary(machineIds, machineCodeById, groupedCounts);
    const trends = this.buildTrends(machineCodeById, trendRows);

    return this.buildResponse(generatedAt, machines, sessions, resultSummary, trends);
  }

  private validateScope(scope?: DashboardRuntimeScope): DashboardRuntimeScope {
    if (scope === "session" || (scope && isRuntimeSummaryScope(scope))) {
      return scope;
    }
    throw new BadRequestException("Phạm vi kết quả không hợp lệ.");
  }

  private async loadScopedCounts(
    machineIds: number[],
    scope: DashboardRuntimeScope,
    from: string | undefined,
    now: Date
  ) {
    if (scope === "session") {
      return [];
    }

    let range: ReturnType<typeof resolveRuntimeSummaryRange>;
    try {
      range = resolveRuntimeSummaryRange(scope, from, now);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Khoảng thời gian không hợp lệ.");
    }

    return this.prisma.scanRecord.groupBy({
      by: ["machine_id", "final_status"],
      where: {
        machine_id: { in: machineIds },
        final_status: { in: ["OK", "NG", "NG_REWORK", "REWORK"] },
        scan_at:
          range.start || range.end
            ? {
                gte: range.start,
                lte: range.end
              }
            : undefined
      },
      _count: { _all: true }
    });
  }

  private async loadAggregatedTrends(
    machineIds: number[],
    trendHours: number,
    bucketMinutes: number,
    now: Date
  ) {
    const bucketSeconds = bucketMinutes * 60;
    const rangeEnd = new Date(now);
    const rangeStart = new Date(rangeEnd.getTime() - trendHours * 60 * 60 * 1000);

    return this.prisma.$queryRaw<TrendAggregateRow[]>(Prisma.sql`
      SELECT
        "machine_id",
        FLOOR(EXTRACT(EPOCH FROM ("scan_at" AT TIME ZONE 'UTC')) / ${bucketSeconds})::BIGINT AS "bucket_epoch",
        COUNT(*) FILTER (WHERE "final_status" = 'OK') AS "ok",
        COUNT(*) FILTER (WHERE "final_status" IN ('NG', 'NG_REWORK')) AS "ng",
        COUNT(*) FILTER (WHERE "final_status" = 'REWORK') AS "rework",
        COUNT(*) FILTER (WHERE "final_status" = 'PENDING') AS "pending"
      FROM "scan_records"
      WHERE "machine_id" IN (${Prisma.join(machineIds)})
        AND "scan_at" >= ${rangeStart}
        AND "scan_at" <= ${rangeEnd}
      GROUP BY "machine_id", "bucket_epoch"
      ORDER BY "machine_id" ASC, "bucket_epoch" ASC
    `);
  }

  private buildResultSummary(
    machineIds: number[],
    machineCodeById: Map<number, string>,
    groupedCounts: Array<{ machine_id: number; final_status: string; _count: { _all: number } }>
  ) {
    const countsByMachine = new Map<number, { ok: number; ng: number; rework: number }>();
    for (const item of groupedCounts) {
      const counts = countsByMachine.get(item.machine_id) ?? { ok: 0, ng: 0, rework: 0 };
      if (item.final_status === "OK") counts.ok += item._count._all;
      if (item.final_status === "NG" || item.final_status === "NG_REWORK") counts.ng += item._count._all;
      if (item.final_status === "REWORK") counts.rework += item._count._all;
      countsByMachine.set(item.machine_id, counts);
    }

    return machineIds.map((machineId) => ({
      machine_id: machineId,
      machine_code: machineCodeById.get(machineId) ?? "",
      ...resolveLogicalResultCounts(countsByMachine.get(machineId) ?? { ok: 0, ng: 0, rework: 0 })
    }));
  }

  private buildTrends(machineCodeById: Map<number, string>, rows: TrendAggregateRow[]) {
    const trends: Record<string, Array<{ date: string; ok: number; ng: number; rework: number; pending: number; total: number; timestamp: number }>> = {};
    for (const machineCode of machineCodeById.values()) {
      trends[machineCode] = [];
    }

    for (const row of rows) {
      const machineCode = machineCodeById.get(row.machine_id);
      if (!machineCode) continue;
      const timestamp = Number(row.bucket_epoch) * 1000;
      const ok = Number(row.ok);
      const ng = Number(row.ng);
      const rework = Number(row.rework);
      trends[machineCode].push({
        date: this.formatTrendTime(new Date(timestamp)),
        ok,
        ng,
        rework,
        pending: Number(row.pending),
        total: ok + ng,
        timestamp
      });
    }
    return trends;
  }

  private buildResponse(
    generatedAt: Date,
    machines: unknown[],
    sessions: unknown[],
    resultSummary: unknown[],
    trends: Record<string, unknown[]>
  ) {
    return {
      success: true,
      code: "DASHBOARD_RUNTIME_OVERVIEW_LOADED",
      message: "Đã tải dữ liệu tổng quan máy.",
      data: {
        generated_at: generatedAt.toISOString(),
        machines,
        sessions,
        result_summary: resultSummary,
        trends
      }
    };
  }

  private clampInteger(value: number, min: number, max: number, fallback: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
  }

  private formatTrendTime(date: Date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
}
