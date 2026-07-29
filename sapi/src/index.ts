/**
 * @sfmc-bds/module-economy — v2 入口
 *
 * 提供 7 个 service (account.{get,credit,debit,transfer} + dailyTasks.{list,submit} + stats.monthly)。
 * 其他模块请 import { economy } from "@sfmc-bds/module-economy/client"，勿直操 sfmc_economy_*。
 *
 * 真正的业务逻辑仍在 db-server/src/domain/economy.ts。SAPI 端:
 *   - 对外简洁 API 见 client.ts
 *   - EconomyReport 月度白皮书保留(system.runTimeout / runInterval 调度)
 */

import { system, world } from "@minecraft/server";
import { debug, Msg } from "@sfmc-bds/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { economy } from "./client.js";

const MODULE_ID = "feature-economy";

function shuffleMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0).getTime() - now.getTime();
}

let monthlyTimer: number | undefined;

function startMonthlyReport(): void {
  if (monthlyTimer !== undefined) return;
  const delay = Math.max(1, shuffleMonthStart() / 50);
  monthlyTimer = system.runTimeout(() => {
    monthlyTimer = undefined;
    void publishMonthlyReport();
    monthlyTimer = system.runInterval(() => void publishMonthlyReport(), 30 * 86400 * 20);
  }, delay);
}

function stopMonthlyReport(): void {
  if (monthlyTimer !== undefined) {
    try {
      system.clearRun(monthlyTimer);
    } catch {
      /* ignore */
    }
    monthlyTimer = undefined;
  }
}

async function publishMonthlyReport(): Promise<void> {
  try {
    const stats = await economy.stats.monthly();
    if (!stats) return;
    const msg = [
      `§e===== 经济白皮书 (${stats.id}) =====`,
      `§7总发行量: §f${stats.total_issued} ${economy.unit}`,
      `§7总销毁量: §f${stats.total_destroyed} ${economy.unit}`,
      `§7总流通量: §f${stats.total_supply} ${economy.unit}`,
      `§7活跃账户: §f${stats.active_accounts}`,
      `§e==============================`,
    ].join("\n");
    for (const p of world.getAllPlayers()) {
      Msg.info(msg, p);
    }
  } catch (err) {
    debug.e("Economy", "monthly report failed", err instanceof Error ? err : new Error(String(err)));
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // 内部 capability,无对外命令
    },
    async init() {
      startMonthlyReport();
      debug.i("Economy", "init");
    },
    cleanup() {
      stopMonthlyReport();
      debug.i("Economy", "stop");
    },
  },
});

export type {
  EconomyAccountRow,
  EconomyIdempotencyRow,
  EconomyTransactionRow,
} from "./types.js";

export { economy, ECONOMY_UNIT } from "./client.js";
export type {
  AccountGetInput,
  AccountMutateInput,
  AccountTransferInput,
  DailyTaskRow,
  DailyTaskSubmitInput,
  DailyTaskSubmitResult,
  DailyTasksListInput,
  DailyTasksListResult,
  EconomyAccountView,
  EconomyMutateResult,
  MonthlyStats,
} from "./client.js";
