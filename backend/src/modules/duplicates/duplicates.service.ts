import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { HistoricalDuplicateJobTrigger, HistoricalDuplicateSchedule, HistoricalDuplicateScheduleFrequency } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RunHistoricalDuplicateJobDto, UpsertHistoricalDuplicateScheduleDto } from "./dto/historical-duplicate-job.dto";

const FULL_HISTORY_FROM_DATE = new Date(0);
const SCHEDULE_CHECK_INTERVAL_MS = 60_000;

type RunJobInput = {
  profileId?: number;
  fromDate: Date;
  toDate: Date;
  actorUserId?: number | null;
  createdBy?: number | null;
  triggerType: HistoricalDuplicateJobTrigger;
};

@Injectable()
export class DuplicatesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DuplicatesService.name);
  private scheduleTimer?: NodeJS.Timeout;
  private isScheduledRunActive = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  onModuleInit() {
    this.scheduleTimer = setInterval(() => {
      void this.runDueFullAuditSchedule();
    }, SCHEDULE_CHECK_INTERVAL_MS);
    this.scheduleTimer.unref?.();
    void this.refreshMissingNextRun();
    void this.runDueFullAuditSchedule();
  }

  onModuleDestroy() {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
    }
  }

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
      message: "Đã tải khóa trùng lặp gần đây.",
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
      message: "Đã tải kết quả trùng lặp lịch sử.",
      data: results
    };
  }

  async runHistoricalJob(dto: RunHistoricalDuplicateJobDto, actorUserId?: number | null) {
    return this.runHistoricalJobInternal({
      profileId: dto.profile_id,
      fromDate: new Date(dto.from_date),
      toDate: new Date(dto.to_date),
      actorUserId,
      createdBy: dto.created_by ?? actorUserId ?? null,
      triggerType: "MANUAL_RANGE"
    });
  }

  async runFullAuditJob(actorUserId?: number | null, triggerType: HistoricalDuplicateJobTrigger = "MANUAL_FULL") {
    return this.runHistoricalJobInternal({
      fromDate: FULL_HISTORY_FROM_DATE,
      toDate: new Date(),
      actorUserId,
      createdBy: actorUserId ?? null,
      triggerType
    });
  }

  async listFullAuditJobs(take: number, skip: number) {
    const boundedTake = Math.min(Math.max(take || 100, 1), 500);
    const boundedSkip = Math.max(skip || 0, 0);

    const where = {
      trigger_type: {
        in: ["MANUAL_FULL", "SCHEDULED_FULL"] as HistoricalDuplicateJobTrigger[]
      }
    };
    const [total, jobs] = await Promise.all([
      this.prisma.historicalDuplicateJob.count({ where }),
      this.prisma.historicalDuplicateJob.findMany({
        take: boundedTake,
        skip: boundedSkip,
        where,
        orderBy: { created_at: "desc" },
        include: {
          _count: {
            select: {
              results: true
            }
          }
        }
      })
    ]);

    return {
      success: true,
      code: "FULL_AUDIT_JOBS_LISTED",
      message: "Đã tải tác vụ kiểm trùng toàn DB.",
      data: jobs,
      meta: {
        total,
        take: boundedTake,
        skip: boundedSkip
      }
    };
  }

  async getFullAuditJobDetail(jobId: number) {
    if (!Number.isInteger(jobId) || jobId < 1) {
      throw new BadRequestException("ID tác vụ kiểm tra không hợp lệ.");
    }

    const job = await this.prisma.historicalDuplicateJob.findFirst({
      where: {
        id: jobId,
        trigger_type: {
          in: ["MANUAL_FULL", "SCHEDULED_FULL"]
        }
      }
    });

    if (!job) {
      throw new NotFoundException("Không tìm thấy tác vụ kiểm trùng toàn DB.");
    }

    const scanWhere = {
      profile_id: job.profile_id ?? undefined,
      final_status: "OK" as const,
      scan_at: {
        gte: job.from_date,
        lte: job.to_date
      }
    };

    const [profileScanGroups, duplicateResults] = await Promise.all([
      this.prisma.scanRecord.groupBy({
        by: ["profile_id"],
        where: scanWhere,
        _count: {
          _all: true
        }
      }),
      this.prisma.historicalDuplicateResult.findMany({
        where: { job_id: job.id },
        orderBy: [{ profile_id: "asc" }, { total_count: "desc" }, { duplicate_key: "asc" }],
        include: {
          profile: {
            include: {
              chassis_code: true
            }
          }
        }
      })
    ]);

    const profileIds = Array.from(new Set([...profileScanGroups.map((group) => group.profile_id), ...duplicateResults.map((result) => result.profile_id)]));
    const profiles = await this.prisma.productProfile.findMany({
      where: {
        id: {
          in: profileIds
        }
      },
      include: {
        chassis_code: true
      }
    });
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const getProfileLabel = (profileId: number) => profileById.get(profileId)?.chassis_code?.code_full ?? `Profile #${profileId}`;

    const profile_counts = profileScanGroups
      .map((group) => ({
        profile_id: group.profile_id,
        profile_label: getProfileLabel(group.profile_id),
        total_codes: group._count._all
      }))
      .sort((first, second) => first.profile_label.localeCompare(second.profile_label));

    const duplicateProfileMap = new Map<
      number,
      {
        profile_id: number;
        profile_label: string;
        duplicate_group_count: number;
        duplicate_scan_count: number;
        duplicate_keys: string[];
      }
    >();

    for (const result of duplicateResults) {
      const current =
        duplicateProfileMap.get(result.profile_id) ??
        {
          profile_id: result.profile_id,
          profile_label: result.profile?.chassis_code?.code_full ?? getProfileLabel(result.profile_id),
          duplicate_group_count: 0,
          duplicate_scan_count: 0,
          duplicate_keys: []
        };
      current.duplicate_group_count += 1;
      current.duplicate_scan_count += result.total_count;
      current.duplicate_keys.push(result.duplicate_key);
      duplicateProfileMap.set(result.profile_id, current);
    }

    const duplicate_keys = duplicateResults.map((result) => ({
      id: result.id,
      profile_id: result.profile_id,
      profile_label: result.profile?.chassis_code?.code_full ?? getProfileLabel(result.profile_id),
      duplicate_key: result.duplicate_key,
      total_count: result.total_count,
      first_scan_at: result.first_scan_at,
      latest_scan_at: result.latest_scan_at,
      scan_record_ids_json: result.scan_record_ids_json
    }));

    const total_scanned_codes = profile_counts.reduce((sum, item) => sum + item.total_codes, 0);
    const duplicate_scan_count = duplicate_keys.reduce((sum, item) => sum + item.total_count, 0);

    return {
      success: true,
      code: "FULL_AUDIT_JOB_DETAIL_LOADED",
      message: "Đã tải chi tiết tác vụ kiểm trùng toàn DB.",
      data: {
        job,
        total_scanned_codes,
        profile_count: profile_counts.length,
        profile_counts,
        duplicate_group_count: duplicate_keys.length,
        duplicate_scan_count,
        duplicate_extra_count: duplicate_keys.reduce((sum, item) => sum + Math.max(item.total_count - 1, 0), 0),
        duplicate_profiles: Array.from(duplicateProfileMap.values()).sort((first, second) => first.profile_label.localeCompare(second.profile_label)),
        duplicate_keys
      }
    };
  }

  async listFullAuditResults(take: number, skip: number, jobId?: number) {
    const boundedTake = Math.min(Math.max(take || 100, 1), 500);
    const boundedSkip = Math.max(skip || 0, 0);
    const selectedJob = await this.prisma.historicalDuplicateJob.findFirst({
      where: {
        id: jobId,
        trigger_type: {
          in: ["MANUAL_FULL", "SCHEDULED_FULL"]
        }
      },
      orderBy: { created_at: "desc" }
    });

    const total = selectedJob
      ? await this.prisma.historicalDuplicateResult.count({
          where: { job_id: selectedJob.id }
        })
      : 0;

    const results = selectedJob
      ? await this.prisma.historicalDuplicateResult.findMany({
          take: boundedTake,
          skip: boundedSkip,
          where: { job_id: selectedJob.id },
          orderBy: [{ total_count: "desc" }, { latest_scan_at: "desc" }],
          include: {
            job: true,
            profile: {
              include: {
                chassis_code: true
              }
            }
          }
        })
      : [];

    return {
      success: true,
      code: "FULL_AUDIT_RESULTS_LISTED",
      message: "Đã tải kết quả kiểm trùng toàn DB.",
      data: results,
      meta: {
        total,
        take: boundedTake,
        skip: boundedSkip,
        selected_job: selectedJob
      }
    };
  }

  async getFullAuditSchedule() {
    const schedule = await this.getExistingFullAuditSchedule();
    const latestJob = await this.getLatestFullAuditJob();

    return {
      success: true,
      code: "FULL_AUDIT_SCHEDULE_LOADED",
      message: "Đã tải lịch kiểm trùng toàn DB.",
      data: {
        schedule: schedule ?? getDefaultSchedule(),
        latest_job: latestJob
      }
    };
  }

  async upsertFullAuditSchedule(dto: UpsertHistoricalDuplicateScheduleDto, actorUserId?: number | null) {
    const current = await this.getExistingFullAuditSchedule();
    const normalized = normalizeScheduleDto(dto);
    const nextRunAt = normalized.enabled ? computeNextRunAt(normalized) : null;
    const data = {
      enabled: normalized.enabled,
      frequency: normalized.frequency,
      run_time: normalized.run_time,
      day_of_week: normalized.day_of_week,
      day_of_month: normalized.day_of_month,
      next_run_at: nextRunAt,
      updated_by: actorUserId ?? null
    };

    const schedule = current
      ? await this.prisma.historicalDuplicateSchedule.update({
          where: { id: current.id },
          data
        })
      : await this.prisma.historicalDuplicateSchedule.create({
          data
        });

    await this.audit.write({
      userId: actorUserId,
      action: current ? "UPDATE_FULL_DUPLICATE_AUDIT_SCHEDULE" : "CREATE_FULL_DUPLICATE_AUDIT_SCHEDULE",
      tableName: "historical_duplicate_schedules",
      recordId: schedule.id,
      oldValue: current,
      newValue: schedule
    });

    return {
      success: true,
      code: "FULL_AUDIT_SCHEDULE_SAVED",
      message: "Đã lưu lịch kiểm trùng toàn DB.",
      data: schedule
    };
  }

  private async runHistoricalJobInternal(input: RunJobInput) {
    const job = await this.prisma.historicalDuplicateJob.create({
      data: {
        profile_id: input.profileId ?? null,
        from_date: input.fromDate,
        to_date: input.toDate,
        trigger_type: input.triggerType,
        status: "RUNNING",
        started_at: new Date(),
        created_by: input.createdBy ?? input.actorUserId ?? null
      }
    });

    try {
    const duplicateGroups = (
      await this.prisma.scanRecord.groupBy({
      by: ["profile_id", "duplicate_key"],
      where: {
        profile_id: input.profileId,
        final_status: "OK",
        scan_at: {
          gte: input.fromDate,
          lte: input.toDate
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
            gte: input.fromDate,
            lte: input.toDate
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
          first_scan_at: scans[0]?.scan_at ?? input.fromDate,
          latest_scan_at: scans[scans.length - 1]?.scan_at ?? input.toDate,
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
      userId: input.actorUserId,
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
      message: "Đã hoàn tất tác vụ trùng lặp lịch sử.",
      data: {
        job: finalJob,
        results
      }
    };
    } catch (error) {
      const failedJob = await this.prisma.historicalDuplicateJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          finished_at: new Date()
        }
      });
      await this.audit.write({
        userId: input.actorUserId,
        action: "RUN_HISTORICAL_DUPLICATE_JOB_FAILED",
        tableName: "historical_duplicate_jobs",
        recordId: failedJob.id,
        newValue: {
          job: failedJob,
      error: error instanceof Error ? error.message : "Lỗi không xác định"
        }
      });
      throw error;
    }
  }

  private async getExistingFullAuditSchedule() {
    return this.prisma.historicalDuplicateSchedule.findFirst({
      orderBy: { id: "asc" }
    });
  }

  private async getLatestFullAuditJob() {
    return this.prisma.historicalDuplicateJob.findFirst({
      where: {
        trigger_type: {
          in: ["MANUAL_FULL", "SCHEDULED_FULL"]
        }
      },
      orderBy: { created_at: "desc" }
    });
  }

  private async refreshMissingNextRun() {
    const schedule = await this.getExistingFullAuditSchedule();
    if (!schedule?.enabled || schedule.next_run_at) {
      return;
    }

    await this.prisma.historicalDuplicateSchedule.update({
      where: { id: schedule.id },
      data: {
        next_run_at: computeNextRunAt(schedule)
      }
    });
  }

  private async runDueFullAuditSchedule() {
    if (this.isScheduledRunActive) {
      return;
    }

    const now = new Date();
    const schedule = await this.prisma.historicalDuplicateSchedule.findFirst({
      where: {
        enabled: true,
        next_run_at: {
          lte: now
        }
      },
      orderBy: { next_run_at: "asc" }
    });

    if (!schedule) {
      return;
    }

    this.isScheduledRunActive = true;
    try {
      await this.runFullAuditJob(null, "SCHEDULED_FULL");
      await this.prisma.historicalDuplicateSchedule.update({
        where: { id: schedule.id },
        data: {
          last_run_at: now,
          next_run_at: computeNextRunAt(schedule, new Date())
        }
      });
    } catch (error) {
      this.logger.error("Scheduled full database duplicate audit failed.", error instanceof Error ? error.stack : undefined);
      await this.prisma.historicalDuplicateSchedule.update({
        where: { id: schedule.id },
        data: {
          next_run_at: computeNextRunAt(schedule, new Date())
        }
      });
    } finally {
      this.isScheduledRunActive = false;
    }
  }
}

function getDefaultSchedule() {
  return {
    id: null,
    enabled: false,
    frequency: "DAILY" as HistoricalDuplicateScheduleFrequency,
    run_time: "00:00",
    day_of_week: 1,
    day_of_month: 1,
    last_run_at: null,
    next_run_at: null,
    updated_by: null,
    created_at: null,
    updated_at: null
  };
}

function normalizeScheduleDto(dto: UpsertHistoricalDuplicateScheduleDto) {
  return {
    enabled: dto.enabled,
    frequency: dto.frequency,
    run_time: dto.run_time,
    day_of_week: clampInteger(dto.day_of_week ?? 1, 1, 7),
    day_of_month: clampInteger(dto.day_of_month ?? 1, 1, 31)
  };
}

function computeNextRunAt(
  schedule: Pick<HistoricalDuplicateSchedule, "frequency" | "run_time" | "day_of_week" | "day_of_month">,
  afterDate = new Date()
) {
  const { hours, minutes } = parseRunTime(schedule.run_time);

  if (schedule.frequency === "WEEKLY") {
    return computeNextWeeklyRun(afterDate, hours, minutes, clampInteger(schedule.day_of_week ?? 1, 1, 7));
  }

  if (schedule.frequency === "MONTHLY") {
    return computeNextMonthlyRun(afterDate, hours, minutes, clampInteger(schedule.day_of_month ?? 1, 1, 31));
  }

  const candidate = new Date(afterDate);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate <= afterDate) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function computeNextWeeklyRun(afterDate: Date, hours: number, minutes: number, targetIsoDay: number) {
  const candidate = new Date(afterDate);
  candidate.setHours(hours, minutes, 0, 0);
  const currentIsoDay = candidate.getDay() === 0 ? 7 : candidate.getDay();
  let dayDelta = (targetIsoDay - currentIsoDay + 7) % 7;
  if (dayDelta === 0 && candidate <= afterDate) {
    dayDelta = 7;
  }
  candidate.setDate(candidate.getDate() + dayDelta);
  return candidate;
}

function computeNextMonthlyRun(afterDate: Date, hours: number, minutes: number, dayOfMonth: number) {
  const candidate = new Date(afterDate);
  const currentMonth = candidate.getMonth();
  const currentYear = candidate.getFullYear();
  candidate.setFullYear(currentYear, currentMonth, clampDayOfMonth(currentYear, currentMonth, dayOfMonth));
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate <= afterDate) {
    const nextMonthDate = new Date(afterDate);
    nextMonthDate.setDate(1);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth();
    candidate.setFullYear(nextYear, nextMonth, clampDayOfMonth(nextYear, nextMonth, dayOfMonth));
    candidate.setHours(hours, minutes, 0, 0);
  }

  return candidate;
}

function parseRunTime(value: string) {
  const [rawHours, rawMinutes] = value.split(":");
  return {
    hours: clampInteger(Number(rawHours), 0, 23),
    minutes: clampInteger(Number(rawMinutes), 0, 59)
  };
}

function clampDayOfMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return clampInteger(day, 1, lastDay);
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}
