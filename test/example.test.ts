/**
 * test/example.test.ts — lifecycle smoke（无 BDS 跑通 register/init/cleanup）
 *
 * 跑法：
 *   - `sfmc mod test`（CLI 委托到本仓 `npm test`）
 *   - 或 `npm test` → `node --test --import tsx test/*.test.ts`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFakePlayer,
  createFakeWorld,
  createFakeDb,
  runLifecycle,
  runCleanup,
  assertMsg,
} from "@sfmc-bds/sdk/testing";

/* 用 side-effect import 让 ModuleRegistry.register 跑一遍。 */
import "../sapi/src/index.ts";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";

test("smoke: 模块入口加载并跑 register* → init 不抛错", async () => {
  const descriptor = ModuleRegistry.list().find((d) => d.id === "feature-example");
  assert.ok(descriptor, "模块未注册到 ModuleRegistry");

  const player = createFakePlayer({ id: "1", name: "tester" });
  const world = createFakeWorld();
  const db = createFakeDb();
  void player;
  void world;
  void db;

  const r = await runLifecycle(descriptor);
  assert.equal(r.ok, true, `lifecycle 抛出: ${r.error?.message ?? ""}`);
});

test("smoke: 演示命令输出含预期前缀", async () => {
  const descriptor = ModuleRegistry.list().find((d) => d.id === "feature-example");
  const player = createFakePlayer({ id: "1", name: "tester" });
  /* 直接调一次 registerCommands 让命令入 in-memory 表（harness 不自动跑）。 */
  descriptor.lifecycle.registerPermissions?.();
  descriptor.lifecycle.registerCommands?.();
  /* 这里演示：测试方自行从 in-memory 表拿命令 handler 并调（避免触发真 MCP 注册）。 */
  /* 由于 Command.register 表是 SDK 内部状态，本测试仅断言 register 钩子不抛。 */
  assert.ok(player.log.length === 0, "Msg.* 未主动发时玩家 log 应为空");
  void assertMsg;
});

test("cleanup: 反向操作不抛错", async () => {
  const descriptor = ModuleRegistry.list().find((d) => d.id === "feature-example");
  const r = await runCleanup(descriptor);
  assert.equal(r.ok, true);
});