import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UpsertServerSettingsDto } from "./dto/server-settings.dto";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async getServerSettings() {
    const settings = await this.prisma.serverSetting.findFirst({
      orderBy: { id: "asc" }
    });

    return {
      success: true,
      code: "SERVER_SETTINGS_LOADED",
      message: "Đã tải cài đặt máy chủ.",
      data: settings
    };
  }

  async upsertServerSettings(dto: UpsertServerSettingsDto, actorUserId?: number | null) {
    const current = await this.prisma.serverSetting.findFirst({
      orderBy: { id: "asc" }
    });

    const data = {
      factory_code_default: dto.factory_code_default.trim(),
      full_code_length_default: dto.full_code_length_default ?? 35,
      full_vendor_position_default: dto.full_vendor_position_default ?? 18,
      led_scan_length_default: dto.led_scan_length_default ?? 22,
      led_vendor_position_default: dto.led_vendor_position_default ?? 16,
      duplicate_days: dto.duplicate_days ?? 31,
      heartbeat_timeout_seconds: dto.heartbeat_timeout_seconds ?? 300,
      updated_by: dto.updated_by ?? actorUserId ?? null
    };

    const settings = current
      ? await this.prisma.serverSetting.update({
          where: { id: current.id },
          data
        })
      : await this.prisma.serverSetting.create({
          data
        });
    await this.audit.write({
      userId: actorUserId,
      action: current ? "UPDATE_SERVER_SETTINGS" : "CREATE_SERVER_SETTINGS",
      tableName: "server_settings",
      recordId: settings.id,
      oldValue: current,
      newValue: settings
    });

    return {
      success: true,
      code: "SERVER_SETTINGS_SAVED",
      message: "Đã lưu cài đặt máy chủ.",
      data: settings
    };
  }
}
