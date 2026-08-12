import assert from "node:assert/strict";
import test from "node:test";
import { ScansService } from "./scans.service";

test("history analytics applies the selected time range to both charts", async () => {
  const service = Object.create(ScansService.prototype) as ScansService;
  const receivedQueries: Array<Parameters<ScansService["getMachineErrorRanking"]>[0]> = [];

  service.getMachineErrorRanking = async (query) => {
    receivedQueries.push(query);
    return {
      success: true,
      code: "TEST",
      message: "TEST",
      data: {
        ok_count: 0,
        ng_count: 0,
        rework_count: 0,
        total_count: 0,
        ranking_status: "NG" as const,
        ranking_type: "machine" as const,
        machines: []
      }
    };
  };

  const from = "2026-08-10T00:00:00.000Z";
  const to = "2026-08-10T23:59:59.999Z";
  await service.getHistoryAnalytics({
    line_name: "LINE-A",
    profile_id: 12,
    vendor_char: "S",
    final_status: "NG",
    ng_reason: "SERVER_DUPLICATE",
    from,
    to
  });

  assert.equal(receivedQueries.length, 2);
  assert.deepEqual(receivedQueries[0], {
    machine_code: undefined,
    line_name: "LINE-A",
    profile_id: 12,
    vendor_char: "S",
    from,
    to
  });
  assert.deepEqual(receivedQueries[1], {
    line_name: "LINE-A",
    profile_id: 12,
    vendor_char: "S",
    final_status: "NG",
    ng_reason: "SERVER_DUPLICATE",
    from,
    to
  });
});
