/**
 * economy 纯逻辑单元测试（不依赖 Minecraft 运行时）。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fromFakePlayerName,
  inferAccountType,
  toFakePlayerName,
} from "../sapi/src/account-id.ts";

function bucketKey(ts: number, groupBy: "day" | "month"): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (groupBy === "month") return `${y}-${m}`;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("economy helpers", () => {
  it("inferAccountType 区分玩家与组织公账", () => {
    assert.equal(inferAccountType("abc123"), "player");
    assert.equal(inferAccountType("coop:42"), "org");
    assert.equal(inferAccountType("town:spawn"), "org");
  });

  it("组织公账假名用点号，避免 Script API 把冒号当命名空间身份", () => {
    assert.equal(toFakePlayerName("coop:c_mu2pnc6s_gt6o"), "coop.c_mu2pnc6s_gt6o");
    assert.equal(fromFakePlayerName("coop.c_mu2pnc6s_gt6o"), "coop:c_mu2pnc6s_gt6o");
    assert.equal(toFakePlayerName("abc123"), "abc123");
    assert.equal(fromFakePlayerName("steve"), "steve");
  });

  it("bucketKey 按 day/month 分桶", () => {
    const ts = Date.UTC(2026, 8, 4, 12, 0, 0); // 2026-09-04
    assert.equal(bucketKey(ts, "day"), "2026-09-04");
    assert.equal(bucketKey(ts, "month"), "2026-09");
  });
});
