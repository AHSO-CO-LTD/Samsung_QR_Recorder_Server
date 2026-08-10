import { BadRequestException, ConflictException, HttpException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveLogicalResultCounts } from "../../common/results/logical-result-counts";
import { getVietnamDayRange } from "../../common/time/vietnam-time";
import { PrismaService } from "../../prisma/prisma.service";
import { MachinesService } from "../machines/machines.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RuntimeGateway } from "../runtime/runtime.gateway";
import { RuntimeService } from "../runtime/runtime.service";
import { FullCodePayloadDto, LedScanPayloadDto, SubmitScanDto } from "./dto/submit-scan.dto";
import { isRuntimeSummaryScope, resolveRuntimeSummaryRange, type RuntimeSummaryScope } from "./runtime-summary-range";
import {
  isErrorRankingScope,
  isScanTrendScope,
  resolveScanTrendRange,
  type ErrorRankingScope,
  type ScanTrendScope
} from "./scan-trend-range";
import { resolveLocalNgReason } from "./scan-failure-reason";
import { buildNgReasonWhere } from "./scan-query-filter";
import { canReworkNgSource, getReworkSourceLocalScanId, isNgFinalStatus } from "./rework-scan-reference";

type SubmitScanOptions = {
  syncBatchId?: number;
  batchCode?: string;
  requestType?: string;
  skipRequestLog?: boolean;
  skipNotification?: boolean;
};

type ScanFilterQuery = {
  machine_code?: string;
  line_name?: string;
  profile_id?: number;
  vendor_char?: string;
  final_status?: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING";
  ng_reason?: string;
  duplicate_only?: boolean;
  from?: string;
  to?: string;
};

type ListScansQuery = ScanFilterQuery & {
  take: number;
  skip?: number;
  q?: string;
  duplicate_only?: boolean;
};

type CompleteSubmitScanDto = SubmitScanDto & {
  duplicate_key: string;
  full_code: FullCodePayloadDto;
  chassis_scan_raw: string;
  led_scans: LedScanPayloadDto[];
};

const NG_FINAL_STATUSES: Array<"NG" | "NG_REWORK"> = ["NG", "NG_REWORK"];

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly runtimeService: RuntimeService,
    private readonly runtimeGateway: RuntimeGateway,
    private readonly notifications: NotificationsService
  ) {}

  async listLatestScans(query: ListScansQuery) {
    const take = Math.min(Math.max(query.take || 100, 1), 500);
    const skip = Math.max(query.skip || 0, 0);
    const where = this.buildScanWhere(query);

    const [total, scans, errorDefinitions] = await Promise.all([
      this.prisma.scanRecord.count({ where }),
      this.prisma.scanRecord.findMany({
        where,
        skip,
        take,
        orderBy: { scan_at: "desc" },
        include: {
          machine: true,
          profile: {
            include: {
              chassis_code: true,
              profile_led_codes: {
                include: {
                  led_code: true
                },
                orderBy: [{ led_slot: "asc" }, { id: "asc" }]
              }
            }
          },
          led_items: {
            orderBy: [{ led_slot: "asc" }, { led_index: "asc" }, { id: "asc" }]
          }
        }
      }),
      this.prisma.errorCode.findMany()
    ]);
    const definitionByCode = new Map(errorDefinitions.map((definition) => [definition.code, definition]));
    const scansWithDefinitions = scans.map((scan) => ({
      ...scan,
      ng_reason_definition: scan.ng_reason ? (definitionByCode.get(scan.ng_reason.trim().toUpperCase()) ?? null) : null,
      led_items: scan.led_items.map((item) => ({
        ...item,
        ng_reason_definition: item.ng_reason ? (definitionByCode.get(item.ng_reason.trim().toUpperCase()) ?? null) : null
      }))
    }));

    return {
      success: true,
      code: "SCANS_LISTED",
      message: "Đã tải lượt quét mới nhất.",
      data: scansWithDefinitions,
      meta: {
        total,
        take,
        skip,
        page: Math.floor(skip / take) + 1,
        page_size: take,
        total_pages: Math.max(1, Math.ceil(total / take)),
        has_previous: skip > 0,
        has_next: skip + scans.length < total
      }
    };
  }

  async getMachineErrorRanking(query: ScanFilterQuery) {
    const filteredWhere = this.buildScanWhere(query);
    const summaryWhere: Prisma.ScanRecordWhereInput = {
      AND: [filteredWhere, { machine: { is_active: true } }]
    };

    const isLineSelected = Boolean(query.line_name);
    const isProfileSelected = Boolean(query.profile_id);
    const rankingStatus = query.final_status === "REWORK" ? "REWORK" : "NG";

    // MODE 3: Both Line and Profile selected -> Error Type Ranking
    if (isLineSelected && isProfileSelected) {
      const rankedScansWhere: Prisma.ScanRecordWhereInput = {
        AND: [summaryWhere, { final_status: rankingStatus === "NG" ? { in: NG_FINAL_STATUSES } : rankingStatus }]
      };

      const [groupedCounts, ngReasonGroups, errorCodes] = await Promise.all([
        this.prisma.scanRecord.groupBy({
          by: ["final_status"],
          where: summaryWhere,
          _count: { _all: true }
        }),
        this.prisma.scanRecord.groupBy({
          by: ["ng_reason"],
          where: rankedScansWhere,
          _count: { _all: true }
        }),
        this.prisma.errorCode.findMany()
      ]);

      const okCount = groupedCounts.reduce((total, item) => total + (item.final_status === "OK" ? item._count._all : 0), 0);
      const rawNgCount = groupedCounts.reduce((total, item) => total + (isNgFinalStatus(item.final_status) ? item._count._all : 0), 0);
      const reworkCount = groupedCounts.reduce((total, item) => total + (item.final_status === "REWORK" ? item._count._all : 0), 0);
      const displayCounts = resolveLogicalResultCounts({ ok: okCount, ng: rawNgCount, rework: reworkCount });

      const errorCodeMap = new Map(errorCodes.map((ec) => [ec.code.toUpperCase(), ec]));
      const errorData = ngReasonGroups
        .filter((item) => item.ng_reason && item.ng_reason.trim() !== "")
        .map((item) => {
          const rawCode = item.ng_reason!.trim();
          const upperCode = rawCode.toUpperCase();
          const count = item._count._all;
          const definition = errorCodeMap.get(upperCode);
          return {
            code: rawCode,
            name_vi: definition?.name_vi ?? null,
            name_en: definition?.name_en ?? null,
            ng_count: count,
            percentage: (rankingStatus === "REWORK" ? reworkCount : rawNgCount) > 0
              ? Number(((count / (rankingStatus === "REWORK" ? reworkCount : rawNgCount)) * 100).toFixed(2))
              : 0
          };
        })
        .sort((left, right) => right.ng_count - left.ng_count || left.code.localeCompare(right.code));

      return {
        success: true,
        code: "MACHINE_ERROR_RANKING_LOADED",
        message: `Đã tải xếp hạng loại lỗi ${rankingStatus}.`,
        data: {
          ok_count: displayCounts.ok,
          ng_count: displayCounts.ng,
          rework_count: displayCounts.rework,
          total_count: displayCounts.total,
          ranking_status: rankingStatus,
          ranking_type: "error_type" as const,
          machines: [],
          errors: errorData
        }
      };
    }

    // MODE 2: Line selected, NO Profile selected -> Profile Error Ranking
    if (isLineSelected && !isProfileSelected) {
      const rankedScansWhere: Prisma.ScanRecordWhereInput = {
        AND: [summaryWhere, { final_status: rankingStatus === "NG" ? { in: NG_FINAL_STATUSES } : rankingStatus }]
      };

      const [groupedCounts, profileGroups, profiles] = await Promise.all([
        this.prisma.scanRecord.groupBy({
          by: ["final_status"],
          where: summaryWhere,
          _count: { _all: true }
        }),
        this.prisma.scanRecord.groupBy({
          by: ["profile_id"],
          where: rankedScansWhere,
          _count: { _all: true }
        }),
        this.prisma.productProfile.findMany({
          include: { chassis_code: true }
        })
      ]);

      const okCount = groupedCounts.reduce((total, item) => total + (item.final_status === "OK" ? item._count._all : 0), 0);
      const rawNgCount = groupedCounts.reduce((total, item) => total + (isNgFinalStatus(item.final_status) ? item._count._all : 0), 0);
      const reworkCount = groupedCounts.reduce((total, item) => total + (item.final_status === "REWORK" ? item._count._all : 0), 0);
      const displayCounts = resolveLogicalResultCounts({ ok: okCount, ng: rawNgCount, rework: reworkCount });

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const profileNgMap = new Map(
        profileGroups.map((item) => [item.profile_id, item._count._all])
      );

      const relevantProfileIds = Array.from(new Set(profileGroups.map((item) => item.profile_id)));

      const profileData = relevantProfileIds
        .map((profileId) => {
          const profile = profileId !== null ? profileMap.get(profileId) : null;
          const count = profileNgMap.get(profileId) ?? 0;
          return {
            profile_id: profileId ?? 0,
            profile_name: profile?.chassis_code?.code_full ?? (profileId ? `Profile #${profileId}` : "Chưa gắn hồ sơ"),
            factory_code: profile?.factory_code ?? "-",
            ng_count: count,
            percentage: (rankingStatus === "REWORK" ? reworkCount : rawNgCount) > 0
              ? Number(((count / (rankingStatus === "REWORK" ? reworkCount : rawNgCount)) * 100).toFixed(2))
              : 0
          };
        })
        .filter((item) => item.ng_count > 0)
        .sort((left, right) => right.ng_count - left.ng_count || left.profile_name.localeCompare(right.profile_name));

      return {
        success: true,
        code: "MACHINE_ERROR_RANKING_LOADED",
        message: `Đã tải tỷ lệ ${rankingStatus} theo hồ sơ.`,
        data: {
          ok_count: displayCounts.ok,
          ng_count: displayCounts.ng,
          rework_count: displayCounts.rework,
          total_count: displayCounts.total,
          ranking_status: rankingStatus,
          ranking_type: "profile" as const,
          machines: [],
          profiles: profileData
        }
      };
    }

    // MODE 1 (Default): No Line selected -> Machine Error Ranking
    const [machines, groupedCounts] = await Promise.all([
      this.prisma.machine.findMany({
        where: {
          is_active: true,
          machine_code: query.machine_code,
          line_name: query.line_name
        },
        select: {
          id: true,
          machine_code: true,
          machine_name: true,
          line_name: true
        },
        orderBy: [{ line_name: "asc" }, { machine_code: "asc" }]
      }),
      this.prisma.scanRecord.groupBy({
        by: ["machine_id", "final_status"],
        where: summaryWhere,
        _count: { _all: true }
      })
    ]);

    const okCount = groupedCounts.reduce((total, item) => total + (item.final_status === "OK" ? item._count._all : 0), 0);
    const rawNgCount = groupedCounts.reduce((total, item) => total + (isNgFinalStatus(item.final_status) ? item._count._all : 0), 0);
    const reworkCount = groupedCounts.reduce((total, item) => total + (item.final_status === "REWORK" ? item._count._all : 0), 0);
    const displayCounts = resolveLogicalResultCounts({ ok: okCount, ng: rawNgCount, rework: reworkCount });
    const rankedCountByMachineId = new Map(
      groupedCounts
        .filter((item) => (rankingStatus === "NG" ? isNgFinalStatus(item.final_status) : item.final_status === rankingStatus))
        .reduce((counts, item) => counts.set(item.machine_id, (counts.get(item.machine_id) ?? 0) + item._count._all), new Map<number, number>())
    );
    const data = machines
      .map((machine) => {
        const machineNgCount = rankedCountByMachineId.get(machine.id) ?? 0;
        return {
          machine_id: machine.id,
          machine_code: machine.machine_code,
          machine_name: machine.machine_name,
          line_name: machine.line_name,
          ng_count: machineNgCount,
          percentage: (rankingStatus === "REWORK" ? reworkCount : rawNgCount) > 0
            ? Number(((machineNgCount / (rankingStatus === "REWORK" ? reworkCount : rawNgCount)) * 100).toFixed(2))
            : 0
        };
      })
      .sort((left, right) => right.ng_count - left.ng_count || left.machine_code.localeCompare(right.machine_code));

    return {
      success: true,
      code: "MACHINE_ERROR_RANKING_LOADED",
      message: `Đã tải tỷ lệ ${rankingStatus} theo máy.`,
      data: {
        ok_count: displayCounts.ok,
        ng_count: displayCounts.ng,
        rework_count: displayCounts.rework,
        total_count: displayCounts.total,
        ranking_status: rankingStatus,
        ranking_type: "machine" as const,
        machines: data
      }
    };
  }

  private buildScanWhere(
    query: ScanFilterQuery & { q?: string; duplicate_only?: boolean }
  ): Prisma.ScanRecordWhereInput {
    const baseWhere: Prisma.ScanRecordWhereInput = {
      machine:
        query.machine_code || query.line_name
          ? { machine_code: query.machine_code, line_name: query.line_name }
          : undefined,
      profile_id: query.profile_id,
      full_vendor_char: query.vendor_char,
      final_status: query.final_status === "NG" ? { in: NG_FINAL_STATUSES } : query.final_status,
      ng_reason: query.duplicate_only ? { in: ["LOCAL_DUPLICATE", "SERVER_DUPLICATE"] } : undefined,
      scan_at:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined
            }
          : undefined
    };
    const conditions = [baseWhere, buildNgReasonWhere(query.ng_reason), this.buildScanSearchWhere(query.q)].filter(
      (condition): condition is Prisma.ScanRecordWhereInput => Boolean(condition)
    );
    return conditions.length === 1 ? conditions[0] : { AND: conditions };
  }

  private buildScanSearchWhere(q?: string): Prisma.ScanRecordWhereInput | undefined {
    const searchText = q?.trim();
    if (!searchText) {
      return undefined;
    }

    const textFilter = {
      contains: searchText,
      mode: Prisma.QueryMode.insensitive
    };

    return {
      OR: [
        { local_scan_id: textFilter },
        { full_code_raw: textFilter },
        { full_chassis_code: textFilter },
        { full_vendor_char: textFilter },
        { full_led_code: textFilter },
        { full_factory_code: textFilter },
        { duplicate_key: textFilter },
        { ng_reason: textFilter },
        { machine: { machine_code: textFilter } },
        { profile: { chassis_code: { code_full: textFilter } } },
        {
          led_items: {
            some: {
              OR: [{ led_scan_raw: textFilter }, { led_lot_no: textFilter }, { vendor_char: textFilter }, { led_suffix: textFilter }, { ng_reason: textFilter }]
            }
          }
        }
      ]
    };
  }

  async getScanSummary(query: { from?: string; to?: string }) {
    const todayRange = getVietnamDayRange();
    const rangeWhere: Prisma.ScanRecordWhereInput =
      query.from || query.to
        ? {
            scan_at: {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined
            }
          }
        : {
            scan_at: {
              gte: todayRange.start,
              lt: todayRange.end
            }
          };
    const [okCount, rawNgCount, reworkCount, pendingCount, todayDuplicateCount, totalOkCount, totalRawNgCount, totalReworkCount, totalDuplicateCount, pendingSyncMachines, settings] = await Promise.all([
      this.prisma.scanRecord.count({ where: { ...rangeWhere, final_status: "OK" } }),
      this.prisma.scanRecord.count({ where: { ...rangeWhere, final_status: { in: NG_FINAL_STATUSES } } }),
      this.prisma.scanRecord.count({ where: { ...rangeWhere, final_status: "REWORK" } }),
      this.prisma.scanRecord.count({ where: { ...rangeWhere, final_status: "PENDING" } }),
      this.prisma.scanRecord.count({ where: { ...rangeWhere, ng_reason: "SERVER_DUPLICATE" } }),
      this.prisma.scanRecord.count({ where: { final_status: "OK" } }),
      this.prisma.scanRecord.count({ where: { final_status: { in: NG_FINAL_STATUSES } } }),
      this.prisma.scanRecord.count({ where: { final_status: "REWORK" } }),
      this.prisma.scanRecord.count({ where: { ng_reason: "SERVER_DUPLICATE" } }),
      this.prisma.machineSyncState.aggregate({
        _sum: {
          local_pending_sync: true
        }
      }),
      this.prisma.serverSetting.findFirst({
        orderBy: { id: "asc" }
      })
    ]);

    const resultCounts = resolveLogicalResultCounts({ ok: okCount, ng: rawNgCount, rework: reworkCount });
    const historicalResultCounts = resolveLogicalResultCounts({ ok: totalOkCount, ng: totalRawNgCount, rework: totalReworkCount });

    return {
      success: true,
      code: "SCAN_SUMMARY_LOADED",
      message: "Đã tải tổng quan lượt quét.",
      data: {
        ok: resultCounts.ok,
        ng: resultCounts.ng,
        rework: resultCounts.rework,
        pending: pendingCount,
        total: resultCounts.total,
        today_duplicates: todayDuplicateCount,
        total_ok: historicalResultCounts.ok,
        total_ng: historicalResultCounts.ng,
        total_rework: historicalResultCounts.rework,
        total_duplicates: totalDuplicateCount,
        pending_sync: pendingSyncMachines._sum.local_pending_sync ?? 0,
        duplicate_days: settings?.duplicate_days ?? 31
      }
    };
  }

  async getRuntimeSummary(query: { scope?: RuntimeSummaryScope; from?: string }) {
    if (!query.scope || !isRuntimeSummaryScope(query.scope)) {
      throw new BadRequestException("Phạm vi kết quả không hợp lệ.");
    }

    let range: ReturnType<typeof resolveRuntimeSummaryRange>;
    try {
      range = resolveRuntimeSummaryRange(query.scope, query.from);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Khoảng thời gian không hợp lệ.");
    }

    const scanAt =
      range.start || range.end
        ? {
            gte: range.start,
            lte: range.end
          }
        : undefined;

    const [machines, groupedCounts] = await Promise.all([
      this.prisma.machine.findMany({
        where: { is_active: true },
        select: {
          id: true,
          machine_code: true
        },
        orderBy: [{ line_name: "asc" }, { machine_code: "asc" }]
      }),
      this.prisma.scanRecord.groupBy({
        by: ["machine_id", "final_status"],
        where: {
          machine: { is_active: true },
          final_status: { in: ["OK", ...NG_FINAL_STATUSES, "REWORK"] },
          scan_at: scanAt
        },
        _count: { _all: true }
      })
    ]);

    const countsByMachine = new Map<number, { ok: number; ng: number; rework: number }>();
    for (const item of groupedCounts) {
      const counts = countsByMachine.get(item.machine_id) ?? { ok: 0, ng: 0, rework: 0 };
      if (item.final_status === "OK") {
        counts.ok = item._count._all;
      } else if (isNgFinalStatus(item.final_status)) {
        counts.ng += item._count._all;
      } else if (item.final_status === "REWORK") {
        counts.rework = item._count._all;
      }
      countsByMachine.set(item.machine_id, counts);
    }

    return {
      success: true,
      code: "RUNTIME_SCAN_SUMMARY_LOADED",
      message: "Đã tải tổng kết quả theo phạm vi.",
      data: machines.map((machine) => {
        const counts = countsByMachine.get(machine.id) ?? { ok: 0, ng: 0, rework: 0 };
        const resultCounts = resolveLogicalResultCounts(counts);
        return {
          machine_id: machine.id,
          machine_code: machine.machine_code,
          ...resultCounts
        };
      })
    };
  }

  async getScanTrend(options: {
    days: number;
    hours?: number;
    bucketMinutes?: number;
    machineCode?: string;
    scope?: ScanTrendScope;
    from?: string;
  }) {
    if (options.scope) {
      if (!isScanTrendScope(options.scope)) {
        throw new BadRequestException("Phạm vi biểu đồ không hợp lệ.");
      }
      return this.getScopedScanTrend(options.scope, options.from);
    }

    const safeDays = Math.min(Math.max(options.days || 7, 1), 31);
    const safeBucketMinutes = options.bucketMinutes ? Math.min(Math.max(options.bucketMinutes, 5), 240) : undefined;
    const safeHours = options.hours ? Math.min(Math.max(options.hours, 1), 72) : 12;
    const machineFilter: Prisma.ScanRecordWhereInput = options.machineCode
      ? {
          machine: {
            machine_code: options.machineCode
          }
        }
      : {};

    if (safeBucketMinutes) {
      return this.getBucketedScanTrend(machineFilter, safeHours, safeBucketMinutes);
    }

    const today = new Date();
    const dayStarts = Array.from({ length: safeDays }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (safeDays - index - 1));
      return date;
    });

    const data = await Promise.all(
      dayStarts.map(async (fromDate) => {
        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + 1);

        const [ok, ng, rework, pending] = await Promise.all([
          this.prisma.scanRecord.count({
            where: {
              ...machineFilter,
              final_status: "OK",
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          }),
          this.prisma.scanRecord.count({
            where: {
              ...machineFilter,
              final_status: { in: NG_FINAL_STATUSES },
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          }),
          this.prisma.scanRecord.count({
            where: {
              ...machineFilter,
              final_status: "REWORK",
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          }),
          this.prisma.scanRecord.count({
            where: {
              ...machineFilter,
              final_status: "PENDING",
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          })
        ]);

        return {
          date: this.formatTrendDate(fromDate),
          ok,
          ng,
          rework,
          pending,
          total: ok + ng
        };
      })
    );

    return {
      success: true,
      code: "SCAN_TREND_LOADED",
      message: "Đã tải xu hướng quét.",
      data
    };
  }

  async getErrorRanking(query: { scope?: ErrorRankingScope }) {
    if (!query.scope || !isErrorRankingScope(query.scope)) {
      throw new BadRequestException("Phạm vi xếp hạng lỗi không hợp lệ.");
    }

    const range = resolveScanTrendRange(query.scope, undefined);
    const scanRangeCondition = range.start
      ? Prisma.sql`sr."scan_at" >= ${range.start} AND sr."scan_at" <= ${range.end}`
      : Prisma.sql`sr."scan_at" <= ${range.end}`;
    const rows = await this.prisma.$queryRaw<
      Array<{ code: string; name_vi: string | null; name_en: string | null; occurrence_count: number }>
    >(Prisma.sql`
      WITH observed AS (
        SELECT
          sr."id" AS scan_record_id,
          UPPER(BTRIM(sr."ng_reason")) AS code
        FROM "scan_records" sr
        WHERE sr."final_status" IN ('NG', 'NG_REWORK')
          AND sr."ng_reason" IS NOT NULL
          AND BTRIM(sr."ng_reason") <> ''
          AND ${scanRangeCondition}

      )
      , observed_counts AS (
        SELECT code, COUNT(*)::INTEGER AS occurrence_count
        FROM observed
        GROUP BY code
      ), known_codes AS (
        SELECT "code" FROM "error_codes"
        UNION
        SELECT UPPER(BTRIM("ng_reason")) AS code
        FROM "scan_records"
        WHERE "ng_reason" IS NOT NULL AND BTRIM("ng_reason") <> ''
        UNION
        SELECT UPPER(BTRIM("ng_reason")) AS code
        FROM "scan_led_items"
        WHERE "ng_reason" IS NOT NULL AND BTRIM("ng_reason") <> ''
      )
      SELECT
        known_codes.code,
        error_code."name_vi",
        error_code."name_en",
        COALESCE(observed_counts.occurrence_count, 0)::INTEGER AS occurrence_count
      FROM known_codes
      LEFT JOIN observed_counts ON observed_counts.code = known_codes.code
      LEFT JOIN "error_codes" error_code ON error_code."code" = known_codes.code
      ORDER BY occurrence_count DESC, known_codes.code ASC
    `);

    return {
      success: true,
      code: "ERROR_RANKING_LOADED",
      message: "Đã tải xếp hạng lỗi NG.",
      data: rows
    };
  }

  private async getScopedScanTrend(scope: ScanTrendScope, from?: string) {
    let range: ReturnType<typeof resolveScanTrendRange>;
    try {
      range = resolveScanTrendRange(scope, from);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Khoảng thời gian không hợp lệ.");
    }

    let start = range.start;
    if (!start) {
      const oldestScan = await this.prisma.scanRecord.aggregate({
        _min: { scan_at: true }
      });
      start = oldestScan._min.scan_at ?? getVietnamDayRange(range.end).start;
    }

    const bucketExpression =
      range.bucket === "30_minutes"
        ? Prisma.sql`to_char(
            date_trunc('hour', "scan_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') +
            floor(extract(minute from "scan_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') / 30) * interval '30 minutes',
            'YYYY-MM-DD HH24:MI'
          )`
        : range.bucket === "month"
          ? Prisma.sql`to_char("scan_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')`
          : Prisma.sql`to_char("scan_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`;

    const groupedRows = await this.prisma.$queryRaw<
      Array<{ bucket: string; ok: bigint; ng: bigint; rework: bigint; pending: bigint }>
    >(Prisma.sql`
      SELECT
        ${bucketExpression} AS "bucket",
        count(*) FILTER (WHERE "final_status" = 'OK') AS "ok",
        count(*) FILTER (WHERE "final_status" IN ('NG', 'NG_REWORK')) AS "ng",
        count(*) FILTER (WHERE "final_status" = 'REWORK') AS "rework",
        count(*) FILTER (WHERE "final_status" = 'PENDING') AS "pending"
      FROM "scan_records"
      WHERE "scan_at" >= ${start} AND "scan_at" <= ${range.end}
      GROUP BY 1
      ORDER BY 1
    `);

    const countsByBucket = new Map(
      groupedRows.map((row) => [
        row.bucket,
        {
          ok: Number(row.ok),
          ng: Number(row.ng),
          rework: Number(row.rework),
          pending: Number(row.pending)
        }
      ])
    );
    const data = this.buildScopedTrendBuckets(start, range.end, range.bucket, countsByBucket);

    return {
      success: true,
      code: "SCAN_TREND_LOADED",
      message: "Đã tải xu hướng quét.",
      data
    };
  }

  private buildScopedTrendBuckets(
    start: Date,
    end: Date,
    bucket: "30_minutes" | "day" | "month",
    countsByBucket: Map<string, { ok: number; ng: number; rework: number; pending: number }>
  ) {
    if (bucket === "month") {
      const startInVietnam = new Date(start.getTime() + 7 * 60 * 60 * 1000);
      const endInVietnam = new Date(end.getTime() + 7 * 60 * 60 * 1000);
      const data = [];

      for (
        let cursor = new Date(Date.UTC(startInVietnam.getUTCFullYear(), startInVietnam.getUTCMonth(), 1));
        cursor.getTime() <= endInVietnam.getTime();
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
      ) {
        const bucketKey = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
        const counts = countsByBucket.get(bucketKey) ?? { ok: 0, ng: 0, rework: 0, pending: 0 };
        data.push({
          date: bucketKey,
          ok: counts.ok,
          ng: counts.ng,
          rework: counts.rework,
          pending: counts.pending,
          total: counts.ok + counts.ng
        });
      }

      return data;
    }

    const bucketMs = bucket === "30_minutes" ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const firstBucket =
      bucket === "30_minutes"
        ? new Date(Math.floor(start.getTime() / bucketMs) * bucketMs)
        : getVietnamDayRange(start).start;
    const data = [];

    for (let cursorMs = firstBucket.getTime(); cursorMs <= end.getTime(); cursorMs += bucketMs) {
      const cursor = new Date(cursorMs);
      const bucketKey = bucket === "30_minutes" ? this.formatVietnamTrendDateTime(cursor) : this.formatVietnamTrendDate(cursor);
      const counts = countsByBucket.get(bucketKey) ?? { ok: 0, ng: 0, rework: 0, pending: 0 };
      data.push({
        date: bucket === "30_minutes" ? bucketKey.slice(11) : bucketKey,
        ok: counts.ok,
        ng: counts.ng,
        rework: counts.rework,
        pending: counts.pending,
        total: counts.ok + counts.ng
      });
    }

    return data;
  }

  private formatVietnamTrendDate(date: Date) {
    return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private formatVietnamTrendDateTime(date: Date) {
    return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
  }

  private async getBucketedScanTrend(machineFilter: Prisma.ScanRecordWhereInput, hours: number, bucketMinutes: number) {
    const now = new Date();
    const end = new Date(now);
    end.setSeconds(0, 0);
    const start = new Date(end);
    start.setHours(start.getHours() - hours);
    start.setMinutes(Math.floor(start.getMinutes() / bucketMinutes) * bucketMinutes, 0, 0);

    const bucketStarts: Date[] = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setMinutes(cursor.getMinutes() + bucketMinutes)) {
      bucketStarts.push(new Date(cursor));
    }

    const rangeEnd = new Date(end);
    rangeEnd.setMinutes(rangeEnd.getMinutes() + bucketMinutes);
    const records = await this.prisma.scanRecord.findMany({
      where: {
        ...machineFilter,
        scan_at: {
          gte: start,
          lt: rangeEnd
        }
      },
      select: {
        scan_at: true,
        final_status: true
      }
    });

    const bucketMs = bucketMinutes * 60 * 1000;
    const data = bucketStarts.map((fromDate) => ({
      date: this.formatTrendTime(fromDate),
      ok: 0,
      ng: 0,
      rework: 0,
      pending: 0,
      total: 0
    }));

    for (const record of records) {
      const bucketDate = this.floorTrendBucket(record.scan_at, bucketMinutes);
      const bucketIndex = Math.floor((bucketDate.getTime() - start.getTime()) / bucketMs);
      const bucket = data[bucketIndex];
      if (!bucket) {
        continue;
      }

      if (record.final_status === "OK") {
        bucket.ok += 1;
      } else if (isNgFinalStatus(record.final_status)) {
        bucket.ng += 1;
      } else if (record.final_status === "REWORK") {
        bucket.rework += 1;
      } else if (record.final_status === "PENDING") {
        bucket.pending += 1;
      }
      bucket.total = bucket.ok + bucket.ng;
    }

    return {
      success: true,
      code: "SCAN_TREND_LOADED",
      message: "Đã tải xu hướng quét.",
      data
    };
  }

  private formatTrendDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatTrendTime(date: Date) {
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
  }

  private floorTrendBucket(date: Date, bucketMinutes: number) {
    const bucket = new Date(date);
    bucket.setSeconds(0, 0);
    bucket.setMinutes(Math.floor(bucket.getMinutes() / bucketMinutes) * bucketMinutes, 0, 0);
    return bucket;
  }

  async submitScan(dto: SubmitScanDto, options: SubmitScanOptions = {}) {
    const receivedAt = new Date();
    const machineForLog = await this.prisma.machine.findUnique({
      where: { machine_code: dto.machine_code }
    });

    try {
      const result = await this.processSubmitScan(dto, options);
      if (machineForLog) {
        await this.recordRuntimeScanActivity(machineForLog.id, result, receivedAt);
      }
      if (!options.skipRequestLog && machineForLog) {
        await this.logSyncRequest(machineForLog.id, dto, result, options.requestType ?? "SUBMIT_SCAN", "OK", options.batchCode);
      }
      const resultData = result.data as {
        final_status?: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING";
        is_replay?: boolean;
      } | undefined;
      this.runtimeGateway.publishScanUpdated({
        machine_code: dto.machine_code,
        local_scan_id: dto.local_scan_id,
        result_code: result.code,
        final_status: resultData?.final_status ?? null,
        source: options.syncBatchId ? "BATCH" : "LIVE",
        is_replay: resultData?.is_replay === true
      });
      return result;
    } catch (error) {
      if (!options.skipRequestLog && machineForLog) {
        await this.logSyncRequest(
          machineForLog.id,
          dto,
          this.extractErrorPayload(error),
          options.requestType ?? "SUBMIT_SCAN",
          "ERROR",
          options.batchCode,
          error instanceof Error ? error.message : String(error)
        );
      }
      if (!options.skipNotification) {
        await this.notifyScanPostError(machineForLog?.id ?? null, dto, this.extractErrorPayload(error), options.requestType ?? "SUBMIT_SCAN");
      }
      throw error;
    }
  }

  private async processSubmitScan(dto: SubmitScanDto, options: SubmitScanOptions) {
    const scanAt = new Date(dto.scan_at);
    const machine = await this.machinesService.ensureActiveMachineIdentity(dto.machine_code, {
      serial: dto.serial,
      uid: dto.uid
    });

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.productProfile.findUnique({
        where: { id: dto.profile_id },
        include: {
          chassis_code: true,
          profile_led_codes: {
            include: {
              led_code: true
            }
          }
        }
      });

      if (!profile || !profile.is_active) {
        throw new BadRequestException({
          success: false,
          code: "PROFILE_NOT_FOUND",
          message: "Hồ sơ không tồn tại hoặc đã bị tắt."
        });
      }

      const reworkSourceLocalScanId = dto.local_status === "REWORK" ? getReworkSourceLocalScanId(dto.local_scan_id) : null;
      if (dto.local_status === "REWORK" && !reworkSourceLocalScanId) {
        throw new BadRequestException({
          success: false,
          code: "REWORK_SOURCE_INVALID",
          message: "local_scan_id của REWORK phải có tiền tố RW- và tham chiếu một lượt NG gốc."
        });
      }

      const existingScan = await tx.scanRecord.findUnique({
        where: {
          machine_id_local_scan_id: {
            machine_id: machine.id,
            local_scan_id: dto.local_scan_id
          }
        }
      });

      const profileSnapshot = await tx.profileSnapshot.findFirst({
        where: {
          profile_id: profile.id,
          version: profile.version
        },
        orderBy: { created_at: "desc" }
      });
      const runtimeContext = await this.runtimeService.resolveRuntimeForScan(machine.id, profile.id);

      if (existingScan) {
        return this.buildReplayResponse(existingScan);
      }

      if (dto.local_status === "NG") {
        const scan = await this.createScanRecord(tx, dto, {
          machine_id: machine.id,
          profile_snapshot_id: profileSnapshot?.id ?? null,
          local_status: "NG",
          server_status: "SKIPPED",
          final_status: "NG",
          ng_stage: "LOCAL",
          ng_reason: resolveLocalNgReason(dto),
          sync_batch_id: options.syncBatchId ?? null,
          runtime_session_id: runtimeContext?.runtime_session_id ?? null,
          runtime_product_id: runtimeContext?.runtime_product_id ?? null,
          scan_at: scanAt
        });

        return {
          success: true,
          code: "LOCAL_NG_SAVED",
          message: "Đã lưu lượt quét NG cục bộ. Máy chủ đã bỏ qua kiểm tra trùng lặp.",
          data: {
            decision: "LOCAL_NG_SAVED",
            server_scan_id: scan.id,
            final_status: scan.final_status,
            ng_reason: scan.ng_reason
          }
        };
      }

      this.assertCompleteScanPayload(dto);
      this.validateFullCodePayload(dto, profile);
      await this.captureVendorCharForReporting(tx, dto.full_code.vendor_char);

      const reworkSourceScan = reworkSourceLocalScanId
        ? await tx.scanRecord.findUnique({
            where: {
              machine_id_local_scan_id: {
                machine_id: machine.id,
                local_scan_id: reworkSourceLocalScanId
              }
            },
            select: { id: true, final_status: true }
          })
        : null;

      if (reworkSourceLocalScanId && !reworkSourceScan) {
        throw new BadRequestException({
          success: false,
          code: "REWORK_SOURCE_NOT_FOUND",
          message: "Không tìm thấy lượt NG gốc để thực hiện REWORK."
        });
      }

      if (reworkSourceScan && !canReworkNgSource(reworkSourceScan.final_status)) {
        throw new ConflictException({
          success: false,
          code: "REWORK_SOURCE_NOT_NG",
          message: "Lượt quét gốc không còn ở trạng thái NG để thực hiện REWORK."
        });
      }

      const settings = await tx.serverSetting.findFirst({
        orderBy: { id: "asc" }
      });
      const duplicateDays = settings?.duplicate_days ?? 31;

      const existingKey = await tx.recentDuplicateKey.findUnique({
        where: {
          profile_id_duplicate_key: {
            profile_id: profile.id,
            duplicate_key: dto.duplicate_key
          }
        }
      });

      if (existingKey && existingKey.expires_at > scanAt) {
        if (dto.local_status === "REWORK") {
          return this.buildRejectedReworkDuplicateResponse(existingKey.first_scan_record_id);
        }

        const duplicateScan = await this.createScanRecord(tx, dto, {
          machine_id: machine.id,
          profile_snapshot_id: profileSnapshot?.id ?? null,
          local_status: "OK",
          server_status: "NG",
          final_status: "NG",
          ng_stage: "SERVER",
          ng_reason: "SERVER_DUPLICATE",
          sync_batch_id: options.syncBatchId ?? null,
          runtime_session_id: runtimeContext?.runtime_session_id ?? null,
          runtime_product_id: runtimeContext?.runtime_product_id ?? null,
          scan_at: scanAt
        });
        await this.createDuplicateNotification(tx, machine.id, duplicateScan.id, dto.duplicate_key);

        return {
          success: true,
          code: "SERVER_DUPLICATE",
          message: "Máy chủ phát hiện trùng lặp trong cửa sổ kiểm trùng đã cấu hình.",
          data: {
            decision: "SERVER_DUPLICATE",
            server_scan_id: duplicateScan.id,
            first_scan_record_id: existingKey.first_scan_record_id,
            final_status: duplicateScan.final_status,
            ng_reason: duplicateScan.ng_reason
          }
        };
      }

      if (existingKey && existingKey.expires_at <= scanAt) {
        await tx.recentDuplicateKey.delete({
          where: { id: existingKey.id }
        });
      }

      const acceptedScan = await this.createScanRecord(tx, dto, {
        machine_id: machine.id,
        profile_snapshot_id: profileSnapshot?.id ?? null,
        local_status: dto.local_status,
        server_status: "OK",
        final_status: dto.local_status === "REWORK" ? "REWORK" : "OK",
        ng_stage: dto.local_status === "REWORK" ? "LOCAL" : null,
        ng_reason: dto.local_status === "REWORK" ? resolveLocalNgReason(dto) : null,
        sync_batch_id: options.syncBatchId ?? null,
        runtime_session_id: runtimeContext?.runtime_session_id ?? null,
        runtime_product_id: runtimeContext?.runtime_product_id ?? null,
        scan_at: scanAt
      });

      const insertResult = await tx.recentDuplicateKey.createMany({
        data: [
          {
            profile_id: profile.id,
            duplicate_key: dto.duplicate_key,
            first_scan_record_id: acceptedScan.id,
            first_machine_id: machine.id,
            first_scan_at: scanAt,
            expires_at: new Date(scanAt.getTime() + duplicateDays * 24 * 60 * 60 * 1000)
          }
        ],
        skipDuplicates: true
      });

      if (insertResult.count === 0) {
        const winnerKey = await tx.recentDuplicateKey.findUnique({
          where: {
            profile_id_duplicate_key: {
              profile_id: profile.id,
              duplicate_key: dto.duplicate_key
            }
          }
        });
        if (dto.local_status === "REWORK") {
          await tx.scanRecord.delete({ where: { id: acceptedScan.id } });
          return this.buildRejectedReworkDuplicateResponse(winnerKey?.first_scan_record_id ?? null);
        }

        const duplicateScan = await tx.scanRecord.update({
          where: { id: acceptedScan.id },
          data: {
            server_status: "NG",
            final_status: "NG",
            ng_stage: "SERVER",
          ng_reason: "SERVER_DUPLICATE"
        }
      });
        await this.createDuplicateNotification(tx, machine.id, duplicateScan.id, dto.duplicate_key);

        return {
          success: true,
          code: "SERVER_DUPLICATE",
          message: "Máy chủ phát hiện trùng lặp trong cửa sổ kiểm trùng đã cấu hình.",
          data: {
            decision: "SERVER_DUPLICATE",
            server_scan_id: duplicateScan.id,
            first_scan_record_id: winnerKey?.first_scan_record_id ?? null,
            final_status: duplicateScan.final_status,
            ng_reason: duplicateScan.ng_reason
          }
        };
      }

      if (dto.local_status === "REWORK") {
        const updatedSource = await tx.scanRecord.updateMany({
          where: { id: reworkSourceScan!.id, final_status: "NG" },
          data: { final_status: "NG_REWORK" }
        });
        if (updatedSource.count !== 1) {
          throw new ConflictException({
            success: false,
            code: "REWORK_SOURCE_NOT_NG",
            message: "Lượt quét gốc đã được REWORK bởi một lượt khác."
          });
        }

        return {
          success: true,
          code: "LOCAL_REWORK_SAVED",
          message: "Đã lưu lượt quét REWORK và cập nhật lượt NG gốc.",
          data: {
            decision: "LOCAL_REWORK_SAVED",
            server_scan_id: acceptedScan.id,
            reworked_scan_record_id: reworkSourceScan!.id,
            final_status: acceptedScan.final_status,
            ng_reason: acceptedScan.ng_reason
          }
        };
      }

      return {
        success: true,
        code: "SERVER_OK",
        message: "Máy chủ đã nhận lượt quét. Không phát hiện trùng lặp.",
        data: {
          decision: "SERVER_OK",
          server_scan_id: acceptedScan.id,
          final_status: acceptedScan.final_status,
          ng_reason: null
        }
      };
    });
  }

  private buildRejectedReworkDuplicateResponse(firstScanRecordId: number | null) {
    return {
      success: true,
      code: "SERVER_DUPLICATE",
      message: "Máy chủ phát hiện trùng lặp trong cửa sổ kiểm trùng đã cấu hình. Lượt REWORK không được lưu.",
      data: {
        decision: "SERVER_DUPLICATE",
        server_scan_id: null,
        first_scan_record_id: firstScanRecordId,
        final_status: "NG" as const,
        ng_reason: "SERVER_DUPLICATE"
      }
    };
  }

  private createScanRecord(
    tx: Prisma.TransactionClient,
    dto: SubmitScanDto,
    state: {
      machine_id: number;
      profile_snapshot_id: number | null;
      local_status: "OK" | "NG" | "REWORK";
      server_status: "OK" | "NG" | "SKIPPED" | "PENDING";
      final_status: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING";
      ng_stage: "LOCAL" | "SERVER" | "SYSTEM" | null;
      ng_reason: string | null;
      sync_batch_id: number | null;
      runtime_session_id: number | null;
      runtime_product_id: number | null;
      scan_at: Date;
    }
  ) {
    const fullCode = dto.full_code;
    const ledScans = Array.isArray(dto.led_scans) ? dto.led_scans : [];

    return tx.scanRecord.create({
      data: {
        local_scan_id: dto.local_scan_id,
        machine_id: state.machine_id,
        profile_id: dto.profile_id,
        profile_snapshot_id: state.profile_snapshot_id,
        full_code_raw: this.cleanScanText(fullCode?.raw),
        full_prefix: this.cleanScanText(fullCode?.prefix),
        full_chassis_segment: this.cleanScanText(fullCode?.chassis_code).replace("-", ""),
        full_chassis_code: this.cleanScanText(fullCode?.chassis_code),
        full_before_vendor: this.cleanScanText(fullCode?.before_vendor),
        full_vendor_char: this.cleanScanText(fullCode?.vendor_char),
        full_led_code: this.cleanScanText(fullCode?.led_code),
        full_factory_code: this.cleanScanText(fullCode?.factory_code),
        full_after_factory: this.cleanScanText(fullCode?.after_factory),
        duplicate_key: this.cleanScanText(dto.duplicate_key),
        chassis_scan_raw: this.cleanScanText(dto.chassis_scan_raw),
        local_status: state.local_status,
        server_status: state.server_status,
        final_status: state.final_status,
        ng_stage: state.ng_stage,
        ng_reason: state.ng_reason,
        sync_batch_id: state.sync_batch_id,
        runtime_session_id: state.runtime_session_id,
        runtime_product_id: state.runtime_product_id,
        scan_at: state.scan_at,
        led_items: {
          create: ledScans.map((item, index) => ({
            led_slot: this.toPositiveInt(item?.slot, index + 1),
            led_index: this.toPositiveInt(item?.index, index + 1),
            led_scan_raw: this.cleanScanText(item?.raw),
            led_lot_no: this.cleanScanText(item?.lot_no),
            vendor_char: this.cleanScanText(item?.vendor_char),
            led_suffix: this.cleanScanText(item?.suffix),
            local_status: item?.status === "OK" || item?.status === "NG" || item?.status === "REWORK" ? item.status : state.local_status,
            ng_reason: this.cleanOptionalScanText(item?.ng_reason)
          }))
        }
      } as any
    });
  }

  private cleanScanText(value: unknown) {
    if (typeof value === "string") {
      return value;
    }
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  }

  private cleanOptionalScanText(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }
    const text = this.cleanScanText(value);
    return text || null;
  }

  private toPositiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private buildReplayResponse(scan: {
    id: number;
    server_status: "OK" | "NG" | "SKIPPED" | "PENDING";
    final_status: "OK" | "NG" | "NG_REWORK" | "REWORK" | "PENDING";
    ng_stage: "LOCAL" | "SERVER" | "SYSTEM" | null;
    ng_reason: string | null;
  }) {
    if (scan.final_status === "REWORK") {
      return {
        success: true,
        code: "LOCAL_REWORK_SAVED",
        message: "Lượt quét REWORK đã được lưu trước đó.",
        data: {
          decision: "LOCAL_REWORK_SAVED",
          server_scan_id: scan.id,
          final_status: scan.final_status,
          ng_reason: scan.ng_reason,
          is_replay: true
        }
      };
    }

    if (scan.ng_stage === "LOCAL") {
      return {
        success: true,
        code: "LOCAL_NG_SAVED",
        message: "Lượt quét NG cục bộ đã được lưu trước đó. Máy chủ đã bỏ qua kiểm tra trùng lặp.",
        data: {
          decision: "LOCAL_NG_SAVED",
          server_scan_id: scan.id,
          final_status: scan.final_status,
          ng_reason: scan.ng_reason,
          is_replay: true
        }
      };
    }

    if (scan.ng_reason === "SERVER_DUPLICATE") {
      return {
        success: true,
        code: "SERVER_DUPLICATE",
        message: "Máy chủ phát hiện trùng lặp trong cửa sổ kiểm trùng đã cấu hình.",
        data: {
          decision: "SERVER_DUPLICATE",
          server_scan_id: scan.id,
          final_status: scan.final_status,
          ng_reason: scan.ng_reason,
          is_replay: true
        }
      };
    }

    return {
      success: true,
      code: scan.server_status === "OK" ? "SERVER_OK" : "SCAN_REPLAYED",
      message: "Kết quả quét đã được lưu trước đó.",
      data: {
        decision: scan.server_status === "OK" ? "SERVER_OK" : "SCAN_REPLAYED",
        server_scan_id: scan.id,
        final_status: scan.final_status,
        ng_reason: scan.ng_reason,
        is_replay: true
      }
    };
  }

  private createDuplicateNotification(tx: Prisma.TransactionClient, machineId: number, scanRecordId: number, duplicateKey: string) {
    return tx.notificationEvent.create({
      data: {
        noti_code: "SERVER_DUPLICATE",
        machine_id: machineId,
        scan_record_id: scanRecordId,
        error_code: "SERVER_DUPLICATE",
        title: "Máy chủ phát hiện trùng mã",
        message: `Khóa trùng lặp ${duplicateKey} bị từ chối bởi quy tắc kiểm trùng của máy chủ.`,
        title_vi: "Máy chủ phát hiện trùng mã",
        message_vi: `Khóa trùng lặp ${duplicateKey} bị máy chủ từ chối theo quy tắc kiểm trùng.`,
        title_en: "Server duplicate detected",
        message_en: `Duplicate key ${duplicateKey} was rejected by server duplicate rule.`,
        payload_json: {
          duplicate_key: duplicateKey
        },
        severity: "ERROR",
        status: "NEW"
      }
    });
  }

  private assertCompleteScanPayload(dto: SubmitScanDto): asserts dto is CompleteSubmitScanDto {
    if (!dto.full_code || !dto.duplicate_key || dto.chassis_scan_raw === undefined || !Array.isArray(dto.led_scans)) {
      throw new BadRequestException({
        success: false,
        code: "PAYLOAD_INVALID",
        message: "Dữ liệu lượt quét OK hoặc REWORK phải có mã đầy đủ, khóa trùng lặp, dữ liệu khung thô và danh sách LED."
      });
    }
  }

  private validateFullCodePayload(
    dto: CompleteSubmitScanDto,
    profile: {
      full_code_length: number;
      full_vendor_position: number;
      factory_code: string;
      chassis_code: {
        code_full: string;
      };
      profile_led_codes: Array<{
        led_code: {
          code_full: string;
          code_input: string;
        };
      }>;
    }
  ) {
    const raw = dto.full_code.raw.trim();
    const prefix = dto.full_code.prefix.trim();
    const chassisSegment = dto.full_code.chassis_code.replace(/-/g, "").trim();
    const profileChassisSegment = profile.chassis_code.code_full.replace(/-/g, "").trim();
    const beforeVendor = dto.full_code.before_vendor.trim();
    const vendorChar = dto.full_code.vendor_char.trim();
    const ledInput = this.extractCodeInput(dto.full_code.led_code);
    const factoryCode = dto.full_code.factory_code.trim();
    const afterFactory = dto.full_code.after_factory.trim();
    const expectedDuplicateKey = `${beforeVendor}${vendorChar}${afterFactory}`;
    const expectedRaw = `${prefix}${profileChassisSegment}${beforeVendor}${vendorChar}${ledInput}${factoryCode}${afterFactory}`;

    if (raw.length !== profile.full_code_length || prefix !== "VN39") {
      throw new BadRequestException({
        success: false,
        code: "FULL_CODE_INVALID",
        message: `Mã đầy đủ phải dùng tiền tố VN39 và có độ dài ${profile.full_code_length}.`
      });
    }

    if (vendorChar.length !== 1 || raw.charAt(profile.full_vendor_position - 1) !== vendorChar) {
      throw new BadRequestException({
        success: false,
        code: "FULL_VENDOR_CHAR_INVALID",
        message: "Ký tự nhà cung cấp phải là ký tự được tách từ vị trí 18 của mã đầy đủ."
      });
    }

    if (chassisSegment !== profileChassisSegment || factoryCode !== profile.factory_code || raw !== expectedRaw) {
      throw new BadRequestException({
        success: false,
        code: "FULL_CODE_INVALID",
        message: "Các đoạn mã đầy đủ không khớp quy tắc hồ sơ đã chọn."
      });
    }

    const allowedLedCode = profile.profile_led_codes.some((item) => item.led_code.code_input === ledInput || item.led_code.code_full === dto.full_code.led_code);
    if (!allowedLedCode) {
      throw new BadRequestException({
        success: false,
        code: "FULL_LED_CODE_INVALID",
        message: "Đoạn LED trong mã đầy đủ không được phép dùng cho hồ sơ này."
      });
    }

    if (dto.duplicate_key !== expectedDuplicateKey) {
      throw new BadRequestException({
        success: false,
        code: "DUPLICATE_KEY_INVALID",
        message: "Khóa trùng lặp phải bằng phần trước nhà cung cấp + ký tự nhà cung cấp + phần sau nhà máy."
      });
    }

    const invalidLedVendor = dto.led_scans.find((item) => item.vendor_char !== vendorChar);
    if (invalidLedVendor) {
      throw new BadRequestException({
        success: false,
        code: "LED_VENDOR_CHAR_INVALID",
        message: "Ký tự nhà cung cấp trong lượt quét LED phải khớp ký tự nhà cung cấp trong mã đầy đủ."
      });
    }
  }

  private async captureVendorCharForReporting(tx: Prisma.TransactionClient, vendorChar: string) {
    const normalizedVendorChar = vendorChar.trim();
    if (!normalizedVendorChar) {
      return;
    }

    const vendor = await tx.vendor.findUnique({
      where: { vendor_char: normalizedVendorChar }
    });

    if (vendor) {
      return;
    }

    try {
      await tx.vendor.create({
        data: {
          vendor_char: normalizedVendorChar,
          vendor_name: `Pending vendor ${normalizedVendorChar}`,
          status: "PENDING"
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return;
      }
      throw error;
    }
  }

  private extractCodeInput(code: string) {
    const trimmed = code.trim();
    return trimmed.includes("-") ? trimmed.split("-").at(-1) ?? trimmed : trimmed;
  }

  private logSyncRequest(
    machineId: number,
    dto: SubmitScanDto,
    response: unknown,
    requestType: string,
    status: string,
    batchCode?: string,
    errorMessage?: string
  ) {
    return this.prisma.syncRequestLog.create({
      data: {
        machine_id: machineId,
        local_scan_id: dto.local_scan_id,
        batch_code: batchCode,
        request_type: requestType,
        payload_json: JSON.parse(JSON.stringify(dto)),
        response_json: response === undefined ? undefined : JSON.parse(JSON.stringify(response)),
        status,
        error_message: errorMessage ?? null
      }
    });
  }

  private notifyScanPostError(machineId: number | null, dto: SubmitScanDto, response: unknown, requestType: string) {
    const payload = this.asRecord(response);
    const code = typeof payload.code === "string" ? payload.code : "SCAN_SUBMIT_FAILED";
    const data = this.asRecord(payload.data);
    const finalStatus = typeof data.final_status === "string" ? data.final_status : null;

    return this.notifications.createEvent({
      notiCode: "LOCAL_POST_SCAN_ERROR",
      machineId,
      title: "Gửi lượt quét cục bộ thất bại",
      titleVi: "Gửi lượt quét cục bộ thất bại",
      titleEn: "Local scan POST failed",
      message: `Máy ${dto.machine_code} gửi lượt quét ${dto.local_scan_id} nhưng máy chủ trả về ${code}.`,
      messageVi: `Máy ${dto.machine_code} gửi scan ${dto.local_scan_id} nhưng server trả về ${code}.`,
      messageEn: `Machine ${dto.machine_code} submitted scan ${dto.local_scan_id} but server returned ${code}.`,
      payload: {
        machine_code: dto.machine_code,
        local_scan_id: dto.local_scan_id,
        request_type: requestType,
        code,
        final_status: finalStatus
      },
      severity: "ERROR",
      errorCode: code
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private async recordRuntimeScanActivity(machineId: number, response: unknown, receivedAt: Date) {
    try {
      const responseData = this.asRecord(this.asRecord(response).data);
      const scanId = typeof responseData.server_scan_id === "number" ? responseData.server_scan_id : Number(responseData.server_scan_id);
      if (!Number.isInteger(scanId) || scanId <= 0) {
        return;
      }

      const scan = await this.prisma.scanRecord.findUnique({
        where: { id: scanId },
        select: {
          machine_id: true,
          local_scan_id: true,
          final_status: true,
          created_at: true
        }
      });

      if (!scan || scan.machine_id !== machineId || scan.created_at.getTime() < receivedAt.getTime()) {
        return;
      }

      await this.runtimeService.recordScanActivity({
        machineId,
        localScanId: scan.local_scan_id,
        finalStatus: scan.final_status,
        receivedAt: scan.created_at
      });
    } catch (error) {
      this.logger.warn(`Runtime scan activity update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private extractErrorPayload(error: unknown) {
    if (error instanceof HttpException) {
      return error.getResponse();
    }

    if (error instanceof Error) {
      return {
        success: false,
        code: "SUBMIT_SCAN_FAILED",
        message: error.message
      };
    }

    return {
      success: false,
      code: "SUBMIT_SCAN_FAILED",
      message: String(error)
    };
  }
}
