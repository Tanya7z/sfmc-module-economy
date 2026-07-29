/**
 * test/economy.test.ts — 包结构冒烟（不依赖 BDS / SDK testing harness）
 *
 * 完整 lifecycle 测试等 @sfmc-bds/sdk/testing 随 npm 发布后再接回。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package.json 官方包名与 files", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "@sfmc-bds/module-economy");
  assert.equal(pkg.private, undefined);
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes("sapi"));
  assert.equal(pkg.exports?.["./client"], "./sapi/src/client.ts");
});

test("manifest v2 id/configKey", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "sapi/manifest.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.id, "feature-economy");
  assert.equal(manifest.configKey, "economy");
});
