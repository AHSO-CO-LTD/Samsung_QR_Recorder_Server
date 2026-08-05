import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateNotificationTemplateDto,
  UpdateNotificationEventStatusDto,
  UpdateNotificationTemplateDto
} from "./dto/notification-crud.dto";

type NotificationSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
type NotificationEventStatus = "NEW" | "SENT" | "READ" | "DISMISSED";

const VISIBLE_NOTIFICATION_CODES = ["MACHINE_RUNTIME_DISCONNECTED", "SERVER_DUPLICATE"];

type CreateNotificationEventInput = {
  notiCode: string;
  title: string;
  message: string;
  titleVi?: string | null;
  messageVi?: string | null;
  titleEn?: string | null;
  messageEn?: string | null;
  payload?: unknown;
  severity: NotificationSeverity;
  status?: NotificationEventStatus;
  machineId?: number | null;
  scanRecordId?: number | null;
  batchId?: number | null;
  errorCode?: string | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async createEvent(input: CreateNotificationEventInput) {
    try {
      return await this.prisma.notificationEvent.create({
        data: {
          noti_code: input.notiCode,
          machine_id: input.machineId ?? null,
          scan_record_id: input.scanRecordId ?? null,
          batch_id: input.batchId ?? null,
          error_code: input.errorCode ?? null,
          title: input.title,
          message: input.message,
          title_vi: this.cleanOptional(input.titleVi),
          message_vi: this.cleanOptional(input.messageVi),
          title_en: this.cleanOptional(input.titleEn) ?? input.title,
          message_en: this.cleanOptional(input.messageEn) ?? input.message,
          payload_json: input.payload === undefined ? undefined : JSON.parse(JSON.stringify(input.payload)),
          severity: input.severity,
          status: input.status ?? "NEW"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to create notification event ${input.notiCode}: ${message}`);
      return null;
    }
  }

  async listNotifications(take: number) {
    const notifications = await this.prisma.notificationEvent.findMany({
      take: Math.min(Math.max(take || 50, 1), 200),
      where: {
        noti_code: {
          in: VISIBLE_NOTIFICATION_CODES
        }
      },
      orderBy: { created_at: "desc" },
      include: {
        machine: true,
        scan_record: true,
        batch: true
      }
    });

    return {
      success: true,
      code: "NOTIFICATIONS_LISTED",
      message: "Đã tải sự kiện thông báo.",
      data: notifications
    };
  }

  async updateNotificationStatus(id: number, dto: UpdateNotificationEventStatusDto, actorUserId?: number | null) {
    const oldEvent = await this.ensureNotificationEvent(id);
    const event = await this.prisma.notificationEvent.update({
      where: { id },
      data: {
        status: dto.status
      },
      include: {
        machine: true,
        scan_record: true,
        batch: true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_NOTIFICATION_STATUS",
      tableName: "notification_events",
      recordId: event.id,
      oldValue: oldEvent,
      newValue: event
    });

    return {
      success: true,
      code: "NOTIFICATION_STATUS_UPDATED",
      message: "Đã cập nhật trạng thái thông báo.",
      data: event
    };
  }

  async listTemplates() {
    const templates = await this.prisma.notificationTemplate.findMany({
      orderBy: [{ is_active: "desc" }, { noti_code: "asc" }]
    });

    return {
      success: true,
      code: "NOTIFICATION_TEMPLATES_LISTED",
      message: "Đã tải mẫu thông báo.",
      data: templates
    };
  }

  async createTemplate(dto: CreateNotificationTemplateDto, actorUserId?: number | null) {
    const template = await this.prisma.notificationTemplate.create({
      data: {
        noti_code: dto.noti_code.trim(),
        title_template: dto.title_template.trim(),
        message_template: dto.message_template.trim(),
        title_template_vi: this.cleanOptional(dto.title_template_vi),
        message_template_vi: this.cleanOptional(dto.message_template_vi),
        title_template_en: this.cleanOptional(dto.title_template_en) ?? dto.title_template.trim(),
        message_template_en: this.cleanOptional(dto.message_template_en) ?? dto.message_template.trim(),
        severity: dto.severity,
        target: dto.target,
        is_active: dto.is_active ?? true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_NOTIFICATION_TEMPLATE",
      tableName: "notification_templates",
      recordId: template.id,
      newValue: template
    });

    return {
      success: true,
      code: "NOTIFICATION_TEMPLATE_CREATED",
      message: "Đã tạo mẫu thông báo.",
      data: template
    };
  }

  async updateTemplate(id: number, dto: UpdateNotificationTemplateDto, actorUserId?: number | null) {
    const oldTemplate = await this.ensureNotificationTemplate(id);
    const template = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        title_template: dto.title_template?.trim(),
        message_template: dto.message_template?.trim(),
        title_template_vi: this.cleanOptionalForUpdate(dto.title_template_vi),
        message_template_vi: this.cleanOptionalForUpdate(dto.message_template_vi),
        title_template_en: this.cleanOptionalForUpdate(dto.title_template_en),
        message_template_en: this.cleanOptionalForUpdate(dto.message_template_en),
        severity: dto.severity,
        target: dto.target,
        is_active: dto.is_active
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_NOTIFICATION_TEMPLATE",
      tableName: "notification_templates",
      recordId: template.id,
      oldValue: oldTemplate,
      newValue: template
    });

    return {
      success: true,
      code: "NOTIFICATION_TEMPLATE_UPDATED",
      message: "Đã cập nhật mẫu thông báo.",
      data: template
    };
  }

  async deactivateTemplate(id: number, actorUserId?: number | null) {
    const oldTemplate = await this.ensureNotificationTemplate(id);
    const template = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        is_active: false
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DEACTIVATE_NOTIFICATION_TEMPLATE",
      tableName: "notification_templates",
      recordId: template.id,
      oldValue: oldTemplate,
      newValue: template
    });

    return {
      success: true,
      code: "NOTIFICATION_TEMPLATE_DEACTIVATED",
      message: "Đã tắt mẫu thông báo.",
      data: template
    };
  }

  private async ensureNotificationEvent(id: number) {
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id }
    });

    if (!event) {
      throw new NotFoundException({
        success: false,
        code: "NOTIFICATION_NOT_FOUND",
        message: "Không tìm thấy sự kiện thông báo."
      });
    }

    return event;
  }

  private async ensureNotificationTemplate(id: number) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new NotFoundException({
        success: false,
        code: "NOTIFICATION_TEMPLATE_NOT_FOUND",
        message: "Không tìm thấy mẫu thông báo."
      });
    }

    return template;
  }

  private cleanOptional(value?: string | null) {
    const cleaned = value?.trim();
    return cleaned || null;
  }

  private cleanOptionalForUpdate(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }
    return this.cleanOptional(value);
  }
}
