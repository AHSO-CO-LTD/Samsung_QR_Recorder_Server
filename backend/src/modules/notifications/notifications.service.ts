import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
