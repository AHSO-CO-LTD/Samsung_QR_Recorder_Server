import { HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MachinesService } from "../machines/machines.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ScansService } from "../scans/scans.service";
import { ReconcileCheckDto, ReconcileLocalRecordDto, ReconcilePullDto } from "./dto/reconcile-sync.dto";
import { SubmitScanBatchDto } from "./dto/submit-scan-batch.dto";

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly scansService: ScansService,
    private readonly notifications: NotificationsService
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

  async reconcileCheck(dto: ReconcileCheckDto, requestIp?: string | null) {
    const machine = await this.machinesService.ensureActiveMachineSerialUid({
      serial: dto.serial,
      uid: dto.uid
    });
    const detectedIpAddress = this.cleanString(requestIp) ?? this.cleanString(dto.ip_address);
    if (detectedIpAddress) {
      await this.prisma.machine.update({
        where: { id: machine.id },
        data: { ip_address: detectedIpAddress }
      });
    }
    const now = new Date();
    const lastCheck = await this.findLastReconcileCheck(machine.id);
    const scopeFrom = dto.from_scan_at ? new Date(dto.from_scan_at) : (lastCheck?.created_at ?? null);
    const scopeTo = dto.to_scan_at ? new Date(dto.to_scan_at) : now;
    const serverRecords = await this.prisma.scanRecord.findMany({
      where: this.buildReconcileWhere(machine.id, scopeFrom, scopeTo),
      orderBy: [{ scan_at: "asc" }, { id: "asc" }],
      include: {
        led_items: {
          orderBy: [{ led_slot: "asc" }, { led_index: "asc" }]
        }
      }
    });
    const syncState = await this.prisma.machineSyncState.findUnique({
      where: { machine_id: machine.id }
    });
    const serverByLocalId = new Map(serverRecords.map((record) => [record.local_scan_id, record]));
    const hasRecordManifest = dto.records !== undefined;
    const localRecords = dto.records ?? [];
    const localByLocalId = new Map<string, ReconcileLocalRecordDto>();
    const duplicateLocalIds = new Set<string>();

    for (const record of localRecords) {
      const localScanId = record.local_scan_id.trim();
      if (localByLocalId.has(localScanId)) {
        duplicateLocalIds.add(localScanId);
      }
      localByLocalId.set(localScanId, {
        ...record,
        local_scan_id: localScanId
      });
    }

    const missingOnServer = [];
    const changedRecords = [];

    for (const localRecord of localByLocalId.values()) {
      const serverRecord = serverByLocalId.get(localRecord.local_scan_id);
      if (!serverRecord) {
        missingOnServer.push(localRecord);
        continue;
      }

      const mismatches = this.compareReconcileRecord(localRecord, serverRecord);
      if (mismatches.length > 0) {
        changedRecords.push({
          local_scan_id: localRecord.local_scan_id,
          mismatches,
          local: localRecord,
          server: this.buildReconcileRecord(machine, serverRecord)
        });
      }
    }

    const missingOnLocal = hasRecordManifest
      ? serverRecords.filter((serverRecord) => !localByLocalId.has(serverRecord.local_scan_id)).map((serverRecord) => this.buildReconcileRecord(machine, serverRecord))
      : [];
    const hasDtoSummary =
      dto.local_total_record !== undefined ||
      dto.local_ok_record !== undefined ||
      dto.local_ng_record !== undefined ||
      dto.local_checksum !== undefined;
    const hasHeartbeatSummary = !hasRecordManifest && !hasDtoSummary && Boolean(syncState?.last_seen_at);
    const localSummary = hasHeartbeatSummary ? this.buildHeartbeatLocalReconcileSummary(syncState) : this.buildLocalReconcileSummary(dto, localByLocalId);
    const serverWindowSummary = this.buildServerReconcileSummary(serverRecords);
    const serverRecordsForComparison = hasHeartbeatSummary
      ? await this.prisma.scanRecord.findMany({
          where: { machine_id: machine.id },
          orderBy: [{ scan_at: "asc" }, { id: "asc" }]
        })
      : serverRecords;
    const serverSummary = this.buildServerReconcileSummary(serverRecordsForComparison);
    const countMismatches = this.buildCountMismatches(localSummary, serverSummary);
    const hasLocalComparisonData =
      hasRecordManifest ||
      hasDtoSummary ||
      hasHeartbeatSummary;
    const hasDifference =
      missingOnServer.length > 0 ||
      missingOnLocal.length > 0 ||
      changedRecords.length > 0 ||
      duplicateLocalIds.size > 0 ||
      countMismatches.length > 0;
    const code = !hasLocalComparisonData
      ? "SYNC_RECONCILE_CHECK_READY"
      : hasDifference
        ? "SYNC_RECONCILE_DIFF_FOUND"
        : "SYNC_RECONCILE_MATCHED";
    const response = {
      success: true,
      code,
      message:
        code === "SYNC_RECONCILE_CHECK_READY"
          ? "Server sync snapshot loaded. Send heartbeat, local counters, or manifest to compare data."
          : hasDifference
            ? "Local and server scan data are different."
            : "Local and server scan data are matched.",
      data: {
        machine: this.buildMachineIdentity(machine),
        scope: {
          from_scan_at: scopeFrom?.toISOString() ?? null,
          to_scan_at: scopeTo.toISOString(),
          last_check_at: lastCheck?.created_at.toISOString() ?? null,
          from_source: dto.from_scan_at ? "REQUEST" : lastCheck ? "LAST_RECONCILE_CHECK" : "BEGINNING",
          to_source: dto.to_scan_at ? "REQUEST" : "NOW",
          ip_address: detectedIpAddress
        },
        comparison_mode: hasRecordManifest ? "MANIFEST" : hasHeartbeatSummary ? "HEARTBEAT_SUMMARY" : hasLocalComparisonData ? "SUMMARY" : "SERVER_SNAPSHOT_ONLY",
        has_difference: hasLocalComparisonData ? hasDifference : null,
        suggested_actions: {
          sync_local_to_server: missingOnServer.map((record) => record.local_scan_id),
          sync_server_to_local: hasRecordManifest ? missingOnLocal.map((record) => record.local_scan_id) : hasDifference ? serverRecords.map((record) => record.local_scan_id) : [],
          review_changed_records: changedRecords.map((record) => record.local_scan_id)
        },
        summary: {
          local: localSummary,
          server: serverSummary,
          server_window: serverWindowSummary,
          count_mismatches: countMismatches,
          duplicate_local_ids: Array.from(duplicateLocalIds)
        },
        diff: {
          missing_on_server: missingOnServer,
          missing_on_local: missingOnLocal,
          changed_records: changedRecords
        }
      }
    };

    await this.writeSyncRequestLog(
      machine.id,
      "RECONCILE_CHECK",
      {
        ...dto,
        detected_ip_address: detectedIpAddress,
        effective_from_scan_at: scopeFrom?.toISOString() ?? null,
        effective_to_scan_at: scopeTo.toISOString()
      },
      response,
      hasLocalComparisonData ? (hasDifference ? "DIFF" : "OK") : "SNAPSHOT"
    );
    await this.notifications.createEvent({
      notiCode: hasDifference ? "LOCAL_POST_RECONCILE_DIFF" : "LOCAL_POST_RECONCILE_CHECK",
      machineId: machine.id,
      title: hasDifference ? "Sync difference found" : "Reconcile check received",
      message: hasDifference
        ? `Machine ${machine.machine_code} reconcile check found data differences.`
        : `Machine ${machine.machine_code} reconcile check completed. Mode: ${response.data.comparison_mode}.`,
      severity: hasDifference ? "WARNING" : "INFO",
      errorCode: hasDifference ? "SYNC_RECONCILE_DIFF_FOUND" : null
    });
    return response;
  }

  async reconcilePull(dto: ReconcilePullDto) {
    const machine = await this.machinesService.ensureActiveMachineSerialUid({
      serial: dto.serial,
      uid: dto.uid
    });
    const requestedIds = this.uniqueStrings(dto.local_scan_ids);
    const take = Math.min(Math.max(dto.take || 200, 1), 1000);
    const serverRecords = await this.prisma.scanRecord.findMany({
      where:
        requestedIds.length > 0
          ? {
              machine_id: machine.id,
              local_scan_id: {
                in: requestedIds
              }
            }
          : this.buildReconcileWhere(machine.id, dto.from_scan_at, dto.to_scan_at),
      take: requestedIds.length > 0 ? undefined : take,
      orderBy: [{ scan_at: "asc" }, { id: "asc" }],
      include: {
        led_items: {
          orderBy: [{ led_slot: "asc" }, { led_index: "asc" }]
        }
      }
    });
    const foundIds = new Set(serverRecords.map((record) => record.local_scan_id));
    const response = {
      success: true,
      code: "SYNC_RECONCILE_PULL_READY",
      message: "Server scan records are ready for local sync.",
      data: {
        machine: this.buildMachineIdentity(machine),
        scope: {
          from_scan_at: dto.from_scan_at ?? null,
          to_scan_at: dto.to_scan_at ?? null,
          take: requestedIds.length > 0 ? requestedIds.length : take
        },
        total_requested: requestedIds.length,
        total_found: serverRecords.length,
        missing_requested_ids: requestedIds.filter((localScanId) => !foundIds.has(localScanId)),
        records: serverRecords.map((record) => this.buildPullRecord(machine, record))
      }
    };

    await this.writeSyncRequestLog(machine.id, "RECONCILE_PULL", dto, response, "OK");
    await this.notifications.createEvent({
      notiCode: "LOCAL_POST_RECONCILE_PULL",
      machineId: machine.id,
      title: "Reconcile pull received",
      message: `Machine ${machine.machine_code} requested ${response.data.records.length} server scan record(s) for local sync.`,
      severity: "INFO"
    });
    return response;
  }

  async submitBatch(dto: SubmitScanBatchDto, requestIp?: string | null) {
    const machine = await this.machinesService.ensureActiveMachineIdentity(dto.machine_code, {
      serial: dto.serial,
      uid: dto.uid
    });
    const detectedIpAddress = this.cleanString(requestIp);
    if (detectedIpAddress) {
      await this.prisma.machine.update({
        where: { id: machine.id },
        data: { ip_address: detectedIpAddress }
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

      if (scan.serial !== dto.serial || scan.uid !== dto.uid) {
        totalFailed += 1;
        results.push({
          local_scan_id: scan.local_scan_id,
          success: false,
          code: "BATCH_MACHINE_IDENTITY_MISMATCH",
          message: "Scan serial or uid does not match batch serial and uid."
        });
        continue;
      }

      try {
        const result = await this.scansService.submitScan(scan, {
          syncBatchId: batch.id,
          batchCode: dto.batch_code,
          requestType: "BATCH_SUBMIT_SCAN",
          skipNotification: true
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

    await this.notifications.createEvent({
      notiCode: totalFailed > 0 ? "LOCAL_POST_BATCH_FAILED" : "LOCAL_POST_BATCH_SUBMIT",
      machineId: machine.id,
      batchId: finalBatch.id,
      title: totalFailed > 0 ? "Local batch sync has failures" : "Local batch sync received",
      message:
        totalFailed > 0
          ? `Machine ${machine.machine_code} submitted batch ${dto.batch_code} with ${totalFailed} failed scan(s).`
          : `Machine ${machine.machine_code} submitted batch ${dto.batch_code}. OK: ${totalOk}, NG: ${totalNg}.`,
      severity: totalFailed > 0 ? "ERROR" : "INFO",
      errorCode: totalFailed > 0 ? "BATCH_SUBMIT_PARTIAL_FAILED" : null
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

  private async findLastReconcileCheck(machineId: number) {
    return this.prisma.syncRequestLog.findFirst({
      where: {
        machine_id: machineId,
        request_type: "RECONCILE_CHECK"
      },
      orderBy: {
        created_at: "desc"
      },
      select: {
        created_at: true
      }
    });
  }

  private buildReconcileWhere(machineId: number, fromScanAt?: Date | string | null, toScanAt?: Date | string | null): Prisma.ScanRecordWhereInput {
    const fromDate = typeof fromScanAt === "string" ? new Date(fromScanAt) : fromScanAt;
    const toDate = typeof toScanAt === "string" ? new Date(toScanAt) : toScanAt;

    return {
      machine_id: machineId,
      ...(fromDate || toDate
        ? {
            scan_at: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {})
            }
          }
        : {})
    };
  }

  private compareReconcileRecord(localRecord: ReconcileLocalRecordDto, serverRecord: any) {
    const mismatches = [];
    const serverChecksum = this.buildRecordChecksum(serverRecord);

    if (localRecord.profile_id !== undefined && localRecord.profile_id !== serverRecord.profile_id) {
      mismatches.push({ field: "profile_id", local: localRecord.profile_id, server: serverRecord.profile_id });
    }
    if (localRecord.duplicate_key !== undefined && localRecord.duplicate_key !== serverRecord.duplicate_key) {
      mismatches.push({ field: "duplicate_key", local: localRecord.duplicate_key, server: serverRecord.duplicate_key });
    }
    if (localRecord.local_status !== undefined && localRecord.local_status !== serverRecord.local_status) {
      mismatches.push({ field: "local_status", local: localRecord.local_status, server: serverRecord.local_status });
    }
    if (localRecord.server_status !== undefined && localRecord.server_status !== serverRecord.server_status) {
      mismatches.push({ field: "server_status", local: localRecord.server_status, server: serverRecord.server_status });
    }
    if (localRecord.final_status !== undefined && localRecord.final_status !== serverRecord.final_status) {
      mismatches.push({ field: "final_status", local: localRecord.final_status, server: serverRecord.final_status });
    }
    if (localRecord.ng_reason !== undefined && (localRecord.ng_reason ?? null) !== (serverRecord.ng_reason ?? null)) {
      mismatches.push({ field: "ng_reason", local: localRecord.ng_reason ?? null, server: serverRecord.ng_reason ?? null });
    }
    if (localRecord.scan_at !== undefined && new Date(localRecord.scan_at).getTime() !== serverRecord.scan_at.getTime()) {
      mismatches.push({ field: "scan_at", local: localRecord.scan_at, server: serverRecord.scan_at.toISOString() });
    }
    if (localRecord.checksum !== undefined && localRecord.checksum !== serverChecksum) {
      mismatches.push({ field: "checksum", local: localRecord.checksum, server: serverChecksum });
    }

    return mismatches;
  }

  private buildLocalReconcileSummary(dto: ReconcileCheckDto, localByLocalId: Map<string, ReconcileLocalRecordDto>) {
    let manifestOk = 0;
    let manifestNg = 0;

    for (const record of localByLocalId.values()) {
      if (record.final_status === "OK") {
        manifestOk += 1;
      }
      if (record.final_status === "NG") {
        manifestNg += 1;
      }
    }

    return {
      reported_total: dto.local_total_record ?? null,
      reported_ok: dto.local_ok_record ?? null,
      reported_ng: dto.local_ng_record ?? null,
      reported_checksum: dto.local_checksum ?? null,
      manifest_total: localByLocalId.size,
      manifest_ok: manifestOk,
      manifest_ng: manifestNg
    };
  }

  private buildHeartbeatLocalReconcileSummary(syncState: any) {
    return {
      reported_total: syncState?.local_total_record ?? null,
      reported_ok: syncState?.local_ok_record ?? null,
      reported_ng: syncState?.local_ng_record ?? null,
      reported_checksum: syncState?.local_checksum ?? null,
      manifest_total: null,
      manifest_ok: null,
      manifest_ng: null,
      source: "MACHINE_SYNC_STATE",
      last_seen_at: syncState?.last_seen_at?.toISOString?.() ?? null,
      local_pending_sync: syncState?.local_pending_sync ?? null
    };
  }

  private buildServerReconcileSummary(serverRecords: any[]) {
    const total = serverRecords.length;
    const ok = serverRecords.filter((record) => record.final_status === "OK").length;
    const ng = serverRecords.filter((record) => record.final_status === "NG").length;

    return {
      total,
      ok,
      ng,
      checksum: this.buildManifestChecksum(serverRecords)
    };
  }

  private buildCountMismatches(
    localSummary: {
      reported_total: number | null;
      reported_ok: number | null;
      reported_ng: number | null;
      reported_checksum: string | null;
    },
    serverSummary: ReturnType<SyncService["buildServerReconcileSummary"]>
  ) {
    const mismatches = [];

    if (localSummary.reported_total !== null && localSummary.reported_total !== serverSummary.total) {
      mismatches.push({ field: "total_record", local: localSummary.reported_total, server: serverSummary.total });
    }
    if (localSummary.reported_ok !== null && localSummary.reported_ok !== serverSummary.ok) {
      mismatches.push({ field: "ok_record", local: localSummary.reported_ok, server: serverSummary.ok });
    }
    if (localSummary.reported_ng !== null && localSummary.reported_ng !== serverSummary.ng) {
      mismatches.push({ field: "ng_record", local: localSummary.reported_ng, server: serverSummary.ng });
    }
    if (localSummary.reported_checksum !== null && localSummary.reported_checksum !== serverSummary.checksum) {
      mismatches.push({ field: "checksum", local: localSummary.reported_checksum, server: serverSummary.checksum });
    }

    return mismatches;
  }

  private buildMachineIdentity(machine: any) {
    return {
      id: machine.id,
      machine_code: machine.machine_code,
      machine_name: machine.machine_name,
      serial: machine.serial,
      uid: machine.uid
    };
  }

  private buildReconcileRecord(machine: any, record: any) {
    return {
      server_scan_id: record.id,
      local_scan_id: record.local_scan_id,
      machine_code: machine.machine_code,
      profile_id: record.profile_id,
      duplicate_key: record.duplicate_key,
      local_status: record.local_status,
      server_status: record.server_status,
      final_status: record.final_status,
      ng_stage: record.ng_stage,
      ng_reason: record.ng_reason,
      scan_at: record.scan_at.toISOString(),
      checksum: this.buildRecordChecksum(record)
    };
  }

  private buildPullRecord(machine: any, record: any) {
    return {
      ...this.buildReconcileRecord(machine, record),
      serial: machine.serial,
      uid: machine.uid,
      full_code: {
        raw: record.full_code_raw,
        prefix: record.full_prefix,
        chassis_code: record.full_chassis_code,
        before_vendor: record.full_before_vendor,
        vendor_char: record.full_vendor_char,
        led_code: record.full_led_code,
        factory_code: record.full_factory_code,
        after_factory: record.full_after_factory
      },
      chassis_scan_raw: record.chassis_scan_raw,
      led_scans: record.led_items.map((item: any) => ({
        slot: item.led_slot,
        index: item.led_index,
        raw: item.led_scan_raw,
        lot_no: item.led_lot_no,
        vendor_char: item.vendor_char,
        suffix: item.led_suffix,
        status: item.local_status,
        ng_reason: item.ng_reason
      })),
      created_at: record.created_at.toISOString()
    };
  }

  private buildRecordChecksum(record: any) {
    return this.sha256({
      local_scan_id: record.local_scan_id,
      profile_id: record.profile_id,
      duplicate_key: record.duplicate_key,
      local_status: record.local_status,
      server_status: record.server_status,
      final_status: record.final_status,
      ng_reason: record.ng_reason ?? null,
      scan_at: record.scan_at.toISOString()
    });
  }

  private buildManifestChecksum(records: any[]) {
    return this.sha256(
      records
        .map((record) => ({
          local_scan_id: record.local_scan_id,
          checksum: this.buildRecordChecksum(record)
        }))
        .sort((a, b) => a.local_scan_id.localeCompare(b.local_scan_id))
    );
  }

  private sha256(value: unknown) {
    return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
  }

  private uniqueStrings(values?: string[]) {
    return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
  }

  private cleanString(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private async writeSyncRequestLog(machineId: number, requestType: string, payload: unknown, response: unknown, status: string) {
    await this.prisma.syncRequestLog.create({
      data: {
        machine_id: machineId,
        request_type: requestType,
        payload_json: JSON.parse(JSON.stringify(payload)),
        response_json: JSON.parse(JSON.stringify(response)),
        status,
        error_message: null
      }
    });
  }
}
