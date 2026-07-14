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

type CreateNotificationEventInput = {
  notiCode: string;
  title: string;
  message: string;
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
      message: "Notification events loaded.",
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
      message: "Notification status updated.",
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
      message: "Notification templates loaded.",
      data: templates
    };
  }

  async createTemplate(dto: CreateNotificationTemplateDto, actorUserId?: number | null) {
    const template = await this.prisma.notificationTemplate.create({
      data: {
        noti_code: dto.noti_code.trim(),
        title_template: dto.title_template.trim(),
        message_template: dto.message_template.trim(),
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
      message: "Notification template created.",
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
      message: "Notification template updated.",
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
      message: "Notification template deactivated.",
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
        message: "Notification event was not found."
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
        message: "Notification template was not found."
      });
    }

    return template;
  }
}
