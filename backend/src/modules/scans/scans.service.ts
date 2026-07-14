import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { MachinesService } from "../machines/machines.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RuntimeService } from "../runtime/runtime.service";
import { SubmitScanDto } from "./dto/submit-scan.dto";

type SubmitScanOptions = {
  syncBatchId?: number;
  batchCode?: string;
  requestType?: string;
  skipRequestLog?: boolean;
  skipNotification?: boolean;
};

type ListScansQuery = {
  take: number;
  skip?: number;
  q?: string;
  machine_code?: string;
  profile_id?: number;
  vendor_char?: string;
  final_status?: "OK" | "NG" | "PENDING";
  ng_reason?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly runtimeService: RuntimeService,
    private readonly notifications: NotificationsService
  ) {}

  async listLatestScans(query: ListScansQuery) {
    const take = Math.min(Math.max(query.take || 100, 1), 500);
    const skip = Math.max(query.skip || 0, 0);
    const baseWhere: Prisma.ScanRecordWhereInput = {
      machine: query.machine_code ? { machine_code: query.machine_code } : undefined,
      profile_id: query.profile_id,
      full_vendor_char: query.vendor_char,
      final_status: query.final_status,
      ng_reason: query.ng_reason,
      scan_at:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined
            }
          : undefined
    };
    const searchWhere = this.buildScanSearchWhere(query.q);
    const where: Prisma.ScanRecordWhereInput = searchWhere ? { AND: [baseWhere, searchWhere] } : baseWhere;

    const [total, scans] = await Promise.all([
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
      })
    ]);

    return {
      success: true,
      code: "SCANS_LISTED",
      message: "Latest scans loaded.",
      data: scans,
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
    const where = {
      scan_at:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined
            }
          : undefined
    };
    const [okCount, ngCount, pendingCount, pendingSyncMachines, settings] = await Promise.all([
      this.prisma.scanRecord.count({ where: { ...where, final_status: "OK" } }),
      this.prisma.scanRecord.count({ where: { ...where, final_status: "NG" } }),
      this.prisma.scanRecord.count({ where: { ...where, final_status: "PENDING" } }),
      this.prisma.machineSyncState.aggregate({
        _sum: {
          local_pending_sync: true
        }
      }),
      this.prisma.serverSetting.findFirst({
        orderBy: { id: "asc" }
      })
    ]);

    return {
      success: true,
      code: "SCAN_SUMMARY_LOADED",
      message: "Scan summary loaded.",
      data: {
        ok: okCount,
        ng: ngCount,
        pending: pendingCount,
        total: okCount + ngCount + pendingCount,
        pending_sync: pendingSyncMachines._sum.local_pending_sync ?? 0,
        duplicate_days: settings?.duplicate_days ?? 31
      }
    };
  }

  async getScanTrend(days: number) {
    const safeDays = Math.min(Math.max(days || 7, 1), 31);
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

        const [ok, ng, pending] = await Promise.all([
          this.prisma.scanRecord.count({
            where: {
              final_status: "OK",
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          }),
          this.prisma.scanRecord.count({
            where: {
              final_status: "NG",
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          }),
          this.prisma.scanRecord.count({
            where: {
              final_status: "PENDING",
              scan_at: {
                gte: fromDate,
                lt: toDate
              }
            }
          })
        ]);

        return {
          date: fromDate.toISOString().slice(0, 10),
          ok,
          ng,
          pending,
          total: ok + ng + pending
        };
      })
    );

    return {
      success: true,
      code: "SCAN_TREND_LOADED",
      message: "Scan trend loaded.",
      data
    };
  }

  async submitScan(dto: SubmitScanDto, options: SubmitScanOptions = {}) {
    const machineForLog = await this.prisma.machine.findUnique({
      where: { machine_code: dto.machine_code }
    });

    try {
      const result = await this.processSubmitScan(dto, options);
      if (!options.skipRequestLog && machineForLog) {
        await this.logSyncRequest(machineForLog.id, dto, result, options.requestType ?? "SUBMIT_SCAN", "OK", options.batchCode);
      }
      if (!options.skipNotification) {
        await this.notifyScanPost(machineForLog?.id ?? null, dto, result, "OK", options.requestType ?? "SUBMIT_SCAN");
      }
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
        await this.notifyScanPost(machineForLog?.id ?? null, dto, this.extractErrorPayload(error), "ERROR", options.requestType ?? "SUBMIT_SCAN");
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
          message: "Profile does not exist or is inactive."
        });
      }

      this.validateFullCodePayload(dto, profile);
      await this.captureVendorCharForReporting(tx, dto.full_code.vendor_char);

      const existingScan = await tx.scanRecord.findUnique({
        where: {
          machine_id_local_scan_id: {
            machine_id: machine.id,
            local_scan_id: dto.local_scan_id
          }
        }
      });

      if (existingScan) {
        return this.buildReplayResponse(existingScan);
      }

      const profileSnapshot = await tx.profileSnapshot.findFirst({
        where: {
          profile_id: profile.id,
          version: profile.version
        },
        orderBy: { created_at: "desc" }
      });
      const runtimeContext = await this.runtimeService.resolveRuntimeForScan(machine.id, profile.id);

      if (dto.local_status === "NG") {
        const scan = await this.createScanRecord(tx, dto, {
          machine_id: machine.id,
          profile_snapshot_id: profileSnapshot?.id ?? null,
          local_status: "NG",
          server_status: "SKIPPED",
          final_status: "NG",
          ng_stage: "LOCAL",
          ng_reason: dto.local_ng_reason || "LOCAL_NG",
          sync_batch_id: options.syncBatchId ?? null,
          runtime_session_id: runtimeContext?.runtime_session_id ?? null,
          runtime_product_id: runtimeContext?.runtime_product_id ?? null,
          scan_at: scanAt
        });

        return {
          success: true,
          code: "LOCAL_NG_SAVED",
          message: "Local NG scan was saved. Server duplicate check was skipped.",
          data: {
            decision: "LOCAL_NG_SAVED",
            server_scan_id: scan.id,
            final_status: scan.final_status,
            ng_reason: scan.ng_reason
          }
        };
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
          message: "Server detected duplicate within the configured duplicate window.",
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

      const okScan = await this.createScanRecord(tx, dto, {
        machine_id: machine.id,
        profile_snapshot_id: profileSnapshot?.id ?? null,
        local_status: "OK",
        server_status: "OK",
        final_status: "OK",
        ng_stage: null,
        ng_reason: null,
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
            first_scan_record_id: okScan.id,
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
        const duplicateScan = await tx.scanRecord.update({
          where: { id: okScan.id },
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
          message: "Server detected duplicate within the configured duplicate window.",
          data: {
            decision: "SERVER_DUPLICATE",
            server_scan_id: duplicateScan.id,
            first_scan_record_id: winnerKey?.first_scan_record_id ?? null,
            final_status: duplicateScan.final_status,
            ng_reason: duplicateScan.ng_reason
          }
        };
      }

      return {
        success: true,
        code: "SERVER_OK",
        message: "Server accepted scan. No duplicate was detected.",
        data: {
          decision: "SERVER_OK",
          server_scan_id: okScan.id,
          final_status: okScan.final_status,
          ng_reason: null
        }
      };
    });
  }

  private createScanRecord(
    tx: Prisma.TransactionClient,
    dto: SubmitScanDto,
    state: {
      machine_id: number;
      profile_snapshot_id: number | null;
      local_status: "OK" | "NG";
      server_status: "OK" | "NG" | "SKIPPED" | "PENDING";
      final_status: "OK" | "NG" | "PENDING";
      ng_stage: "LOCAL" | "SERVER" | "SYSTEM" | null;
      ng_reason: string | null;
      sync_batch_id: number | null;
      runtime_session_id: number | null;
      runtime_product_id: number | null;
      scan_at: Date;
    }
  ) {
    return tx.scanRecord.create({
      data: {
        local_scan_id: dto.local_scan_id,
        machine_id: state.machine_id,
        profile_id: dto.profile_id,
        profile_snapshot_id: state.profile_snapshot_id,
        full_code_raw: dto.full_code.raw,
        full_prefix: dto.full_code.prefix,
        full_chassis_segment: dto.full_code.chassis_code.replace("-", ""),
        full_chassis_code: dto.full_code.chassis_code,
        full_before_vendor: dto.full_code.before_vendor,
        full_vendor_char: dto.full_code.vendor_char,
        full_led_code: dto.full_code.led_code,
        full_factory_code: dto.full_code.factory_code,
        full_after_factory: dto.full_code.after_factory,
        duplicate_key: dto.duplicate_key,
        chassis_scan_raw: dto.chassis_scan_raw,
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
          create: dto.led_scans.map((item) => ({
            led_slot: item.slot,
            led_index: item.index,
            led_scan_raw: item.raw,
            led_lot_no: item.lot_no,
            vendor_char: item.vendor_char,
            led_suffix: item.suffix,
            local_status: item.status,
            ng_reason: item.ng_reason ?? null
          }))
        }
      } as any
    });
  }

  private buildReplayResponse(scan: {
    id: number;
    server_status: "OK" | "NG" | "SKIPPED" | "PENDING";
    final_status: "OK" | "NG" | "PENDING";
    ng_stage: "LOCAL" | "SERVER" | "SYSTEM" | null;
    ng_reason: string | null;
  }) {
    if (scan.ng_stage === "LOCAL") {
      return {
        success: true,
        code: "LOCAL_NG_SAVED",
        message: "Local NG scan was already saved. Server duplicate check was skipped.",
        data: {
          decision: "LOCAL_NG_SAVED",
          server_scan_id: scan.id,
          final_status: scan.final_status,
          ng_reason: scan.ng_reason
        }
      };
    }

    if (scan.ng_reason === "SERVER_DUPLICATE") {
      return {
        success: true,
        code: "SERVER_DUPLICATE",
        message: "Server detected duplicate within the configured duplicate window.",
        data: {
          decision: "SERVER_DUPLICATE",
          server_scan_id: scan.id,
          final_status: scan.final_status,
          ng_reason: scan.ng_reason
        }
      };
    }

    return {
      success: true,
      code: scan.server_status === "OK" ? "SERVER_OK" : "SCAN_REPLAYED",
      message: "Scan result was already saved.",
      data: {
        decision: scan.server_status === "OK" ? "SERVER_OK" : "SCAN_REPLAYED",
        server_scan_id: scan.id,
        final_status: scan.final_status,
        ng_reason: scan.ng_reason
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
        title: "Server duplicate detected",
        message: `Duplicate key ${duplicateKey} was rejected by server duplicate rule.`,
        severity: "ERROR",
        status: "NEW"
      }
    });
  }

  private validateFullCodePayload(
    dto: SubmitScanDto,
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
        message: `Full code must use prefix VN39 and length ${profile.full_code_length}.`
      });
    }

    if (vendorChar.length !== 1 || raw.charAt(profile.full_vendor_position - 1) !== vendorChar) {
      throw new BadRequestException({
        success: false,
        code: "FULL_VENDOR_CHAR_INVALID",
        message: "Vendor char must be the character parsed from full code position 18."
      });
    }

    if (chassisSegment !== profileChassisSegment || factoryCode !== profile.factory_code || raw !== expectedRaw) {
      throw new BadRequestException({
        success: false,
        code: "FULL_CODE_INVALID",
        message: "Full code segments do not match the selected profile rule."
      });
    }

    const allowedLedCode = profile.profile_led_codes.some((item) => item.led_code.code_input === ledInput || item.led_code.code_full === dto.full_code.led_code);
    if (!allowedLedCode) {
      throw new BadRequestException({
        success: false,
        code: "FULL_LED_CODE_INVALID",
        message: "Full code LED segment is not allowed for this profile."
      });
    }

    if (dto.duplicate_key !== expectedDuplicateKey) {
      throw new BadRequestException({
        success: false,
        code: "DUPLICATE_KEY_INVALID",
        message: "Duplicate key must be before_vendor + vendor_char + after_factory."
      });
    }

    const invalidLedVendor = dto.led_scans.find((item) => item.vendor_char !== vendorChar);
    if (invalidLedVendor) {
      throw new BadRequestException({
        success: false,
        code: "LED_VENDOR_CHAR_INVALID",
        message: "LED scan vendor char must match full code vendor char."
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

  private notifyScanPost(machineId: number | null, dto: SubmitScanDto, response: unknown, status: "OK" | "ERROR", requestType: string) {
    const payload = this.asRecord(response);
    const code = typeof payload.code === "string" ? payload.code : status === "OK" ? "SCAN_SUBMIT_DONE" : "SCAN_SUBMIT_FAILED";
    const data = this.asRecord(payload.data);
    const finalStatus = typeof data.final_status === "string" ? data.final_status : null;
    const severity = status === "ERROR" ? "ERROR" : finalStatus === "NG" || code.includes("DUPLICATE") ? "WARNING" : "INFO";

    return this.notifications.createEvent({
      notiCode: status === "ERROR" ? "LOCAL_POST_SCAN_ERROR" : "LOCAL_POST_SCAN_SUBMIT",
      machineId,
      title: status === "ERROR" ? "Local scan POST failed" : "Local scan POST received",
      message:
        status === "ERROR"
          ? `Machine ${dto.machine_code} submitted scan ${dto.local_scan_id} but server returned ${code}.`
          : `Machine ${dto.machine_code} submitted scan ${dto.local_scan_id}. Result: ${code}${finalStatus ? `/${finalStatus}` : ""}.`,
      severity,
      errorCode: status === "ERROR" ? code : code.includes("DUPLICATE") ? "SERVER_DUPLICATE" : null
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
