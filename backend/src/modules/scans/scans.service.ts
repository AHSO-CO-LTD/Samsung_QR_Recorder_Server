import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SubmitScanDto } from "./dto/submit-scan.dto";

@Injectable()
export class ScansService {
  constructor(private readonly prisma: PrismaService) {}

  async listLatestScans(take: number) {
    const scans = await this.prisma.scanRecord.findMany({
      take: Math.min(Math.max(take || 50, 1), 200),
      orderBy: { scan_at: "desc" },
      include: {
        machine: true,
        profile: {
          include: {
            chassis_code: true
          }
        },
        led_items: true
      }
    });

    return {
      success: true,
      code: "SCANS_LISTED",
      message: "Latest scans loaded.",
      data: scans
    };
  }

  async submitScan(dto: SubmitScanDto) {
    const scanAt = new Date(dto.scan_at);

    return this.prisma.$transaction(async (tx) => {
      const machine = await tx.machine.findUnique({
        where: { machine_code: dto.machine_code }
      });

      if (!machine || !machine.is_active) {
        throw new BadRequestException({
          success: false,
          code: "MACHINE_NOT_FOUND",
          message: "Machine code does not exist or is inactive."
        });
      }

      const profile = await tx.productProfile.findUnique({
        where: { id: dto.profile_id },
        include: {
          chassis_code: true
        }
      });

      if (!profile || !profile.is_active) {
        throw new BadRequestException({
          success: false,
          code: "PROFILE_NOT_FOUND",
          message: "Profile does not exist or is inactive."
        });
      }

      const profileSnapshot = await tx.profileSnapshot.findFirst({
        where: {
          profile_id: profile.id,
          version: profile.version
        },
        orderBy: { created_at: "desc" }
      });

      if (dto.local_status === "NG") {
        const scan = await this.createScanRecord(tx, dto, {
          machine_id: machine.id,
          profile_snapshot_id: profileSnapshot?.id ?? null,
          local_status: "NG",
          server_status: "SKIPPED",
          final_status: "NG",
          ng_stage: "LOCAL",
          ng_reason: dto.local_ng_reason || "LOCAL_NG",
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
          scan_at: scanAt
        });

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
        scan_at: scanAt
      });

      await tx.recentDuplicateKey.create({
        data: {
          profile_id: profile.id,
          duplicate_key: dto.duplicate_key,
          first_scan_record_id: okScan.id,
          first_machine_id: machine.id,
          first_scan_at: scanAt,
          expires_at: new Date(scanAt.getTime() + duplicateDays * 24 * 60 * 60 * 1000)
        }
      });

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
      }
    });
  }
}
