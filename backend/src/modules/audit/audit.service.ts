import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(take: number) {
    const logs = await this.prisma.auditLog.findMany({
      take: Math.min(Math.max(take || 100, 1), 500),
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            role: true
          }
        }
      }
    });

    return {
      success: true,
      code: "AUDIT_LOGS_LISTED",
      message: "Đã tải nhật ký kiểm tra.",
      data: logs
    };
  }

  async write(input: {
    userId?: number | null;
    action: string;
    tableName: string;
    recordId: string | number;
    oldValue?: unknown;
    newValue?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        action: input.action,
        table_name: input.tableName,
        record_id: String(input.recordId),
        old_value_json: input.oldValue === undefined ? undefined : JSON.parse(JSON.stringify(input.oldValue)),
        new_value_json: input.newValue === undefined ? undefined : JSON.parse(JSON.stringify(input.newValue))
      }
    });
  }
}
