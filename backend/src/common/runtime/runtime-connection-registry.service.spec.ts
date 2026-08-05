import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeConnectionRegistry } from "./runtime-connection-registry.service";

test("keeps a machine connected until its final websocket disconnects", () => {
  const registry = new RuntimeConnectionRegistry();

  registry.connect(1, "socket-a");
  registry.connect(1, "socket-b");

  assert.equal(registry.hasConnection(1), true);
  assert.equal(registry.disconnect(1, "socket-a"), false);
  assert.equal(registry.hasConnection(1), true);
  assert.equal(registry.disconnect(1, "socket-b"), true);
  assert.equal(registry.hasConnection(1), false);
});
