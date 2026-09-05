/**
 * @sfmc-bds/module-economy — 计分板权威经济中枢
 *
 * 生命周期：registerPermissions → registerCommands → registerEvents → init
 * 对外仅经 service.provide：account.get/credit/debit/transfer + stats.query
 */

import { system } from "@minecraft/server";
import { config } from "@sfmc-bds/sdk/sapi/config";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { debug } from "@sfmc-bds/sdk/sapi/runtime";
import { service } from "@sfmc-bds/sdk/sapi/service";
import {
  defineEconomyTables,
  flushPendingArchive,
  reconcileAccount,
} from "./archive.js";
import {
  configureScoreboard,
  ensureObjective,
  listScoreboardBalances,
} from "./scoreboard.js";
import {
  handleCredit,
  handleDebit,
  handleGet,
  handleStatsQuery,
  handleTransfer,
} from "./services.js";

const MODULE_ID = "economy";

const unprovide: Array<() => void> = [];
let reconcileRunId: number | undefined;
let retryRunId: number | undefined;

interface EconomyConfig {
  objectiveId?: string;
  objectiveDisplay?: string;
  unitName?: string;
  reconcileIntervalTicks?: number;
}

async function loadConfig(): Promise<Required<EconomyConfig>> {
  const all = (await config.getAll()) as EconomyConfig;
  return {
    objectiveId: all.objectiveId ?? "sfmc_money",
    objectiveDisplay: all.objectiveDisplay ?? "节操",
    unitName: all.unitName ?? "节操",
    reconcileIntervalTicks: all.reconcileIntervalTicks ?? 12000,
  };
}

async function runReconcile(): Promise<void> {
  try {
    for (const { accountId, balance } of listScoreboardBalances()) {
      await reconcileAccount(accountId, balance);
    }
  } catch (err) {
    debug.e("Economy", "reconcile failed", err instanceof Error ? err : new Error(String(err)));
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions() {
      // 无玩家命令面
    },
    registerCommands() {
      // 无
    },
    registerEvents() {
      // 无原生事件订阅
    },
    async init() {
      const cfg = await loadConfig();
      configureScoreboard(cfg.objectiveId, cfg.objectiveDisplay);
      ensureObjective();
      await defineEconomyTables();

      unprovide.push(service.provide("economy.account.get", (input) => handleGet(input)));
      unprovide.push(service.provide("economy.account.credit", (input) => handleCredit(input)));
      unprovide.push(service.provide("economy.account.debit", (input) => handleDebit(input)));
      unprovide.push(service.provide("economy.account.transfer", (input) => handleTransfer(input)));
      unprovide.push(service.provide("economy.stats.query", (input) => handleStatsQuery(input)));

      if (cfg.reconcileIntervalTicks > 0) {
        reconcileRunId = system.runInterval(() => void runReconcile(), cfg.reconcileIntervalTicks);
      }
      retryRunId = system.runInterval(() => void flushPendingArchive(), 200);
      debug.i("Economy", `init objective=${cfg.objectiveId} unit=${cfg.unitName}`);
    },
    cleanup() {
      for (const off of unprovide.splice(0, unprovide.length)) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      if (reconcileRunId !== undefined) {
        try {
          system.clearRun(reconcileRunId);
        } catch {
          /* ignore */
        }
        reconcileRunId = undefined;
      }
      if (retryRunId !== undefined) {
        try {
          system.clearRun(retryRunId);
        } catch {
          /* ignore */
        }
        retryRunId = undefined;
      }
      void flushPendingArchive();
      debug.i("Economy", "cleanup");
    },
  },
});
