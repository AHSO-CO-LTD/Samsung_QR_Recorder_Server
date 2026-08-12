import assert from "node:assert/strict";
import test from "node:test";
import { NotificationsService } from "./notifications.service";

test("marks only visible new notifications as read and writes one bulk audit record", async () => {
  const updateManyCalls: unknown[] = [];
  const auditCalls: unknown[] = [];
  const prisma = {
    notificationEvent: {
      updateMany: async (input: unknown) => {
        updateManyCalls.push(input);
        return { count: 3 };
      }
    }
  };
  const audit = {
    write: async (input: unknown) => {
      auditCalls.push(input);
      return input;
    }
  };
  const service = new NotificationsService(prisma as never, audit as never);

  const result = await service.markAllNotificationsRead(7);

  assert.deepEqual(updateManyCalls, [
    {
      where: {
        status: "NEW",
        noti_code: {
          in: ["MACHINE_RUNTIME_DISCONNECTED", "SERVER_DUPLICATE"]
        }
      },
      data: {
        status: "READ"
      }
    }
  ]);
  assert.deepEqual(auditCalls, [
    {
      userId: 7,
      action: "MARK_ALL_NOTIFICATIONS_READ",
      tableName: "notification_events",
      recordId: "bulk",
      newValue: {
        status: "READ",
        updated_count: 3
      }
    }
  ]);
  assert.equal(result.data.updated_count, 3);
});
