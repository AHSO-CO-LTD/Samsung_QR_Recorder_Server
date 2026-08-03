import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { UsersService } from "./users.service";

const existingDev = {
  id: 7,
  username: "dev",
  full_name: "Support Service",
  role: "DEV" as const,
  is_active: false,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z")
};

test("blocks DEV recovery for every role except ADMIN", async () => {
  const service = createService({});

  await assert.rejects(service.getDevRecoveryStatus("DEV"), ForbiddenException);
  await assert.rejects(service.getDevRecoveryStatus("ENGINEER"), ForbiddenException);
});

test("resets and reactivates the selected existing DEV account", async () => {
  let updateData: Record<string, unknown> | undefined;
  const auditCalls: Array<Record<string, unknown>> = [];
  const service = createService({
    findMany: async () => [existingDev],
    update: async (input: { data: Record<string, unknown> }) => {
      updateData = input.data;
      return { ...existingDev, is_active: true, updated_at: new Date("2026-08-03T00:00:00.000Z") };
    },
    auditWrite: async (input: Record<string, unknown>) => {
      auditCalls.push(input);
    }
  });

  const result = await service.recoverDevAccount({ user_id: existingDev.id, password: "NewDev@123" }, 1, "ADMIN");

  assert.equal(result.code, "DEV_PASSWORD_RESET");
  assert.equal(updateData?.is_active, true);
  assert.equal(typeof updateData?.password_hash, "string");
  assert.notEqual(updateData?.password_hash, "NewDev@123");
  assert.equal(auditCalls[0]?.action, "RESET_DEV_PASSWORD");
});

test("creates the first DEV account when none exists", async () => {
  let createData: Record<string, unknown> | undefined;
  const service = createService({
    findMany: async () => [],
    findUnique: async () => null,
    create: async (input: { data: Record<string, unknown> }) => {
      createData = input.data;
      return { ...existingDev, id: 8, is_active: true, ...input.data };
    }
  });

  const result = await service.recoverDevAccount(
    { username: "dev", full_name: "Developer", password: "NewDev@123" },
    1,
    "ADMIN"
  );

  assert.equal(result.code, "DEV_ACCOUNT_CREATED");
  assert.equal(createData?.role, "DEV");
  assert.equal(createData?.username, "dev");
  assert.equal(createData?.is_active, true);
});

function createService(overrides: {
  findMany?: () => Promise<typeof existingDev[]>;
  findUnique?: () => Promise<typeof existingDev | null>;
  update?: (input: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  create?: (input: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  auditWrite?: (input: Record<string, unknown>) => Promise<void>;
}) {
  const prisma = {
    user: {
      findMany: overrides.findMany ?? (async () => []),
      findUnique: overrides.findUnique ?? (async () => null),
      update: overrides.update ?? (async () => existingDev),
      create: overrides.create ?? (async () => existingDev)
    }
  };
  const audit = {
    write: overrides.auditWrite ?? (async () => undefined)
  };

  return new UsersService(prisma as never, audit as never);
}
