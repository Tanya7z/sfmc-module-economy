/**
 * client.ts — feature-economy 对其他模块开放的简洁 API
 *
 * 消费者应只通过本文件调用经济能力，禁止直接读写 sfmc_economy_* 表。
 *
 * 用法:
 *   import { economy } from "@sfmc-bds/module-economy/client";
 *   await economy.account.get({ playerId });
 *   await economy.account.inTx(tx).debit({ playerId, amount, reason });
 *
 * 与 SDK Money 的关系:
 *   - Money（@sfmc-bds/sdk/sapi/runtime）是玩家侧余额缓存助手，底层同样走本模块 service
 *   - UI 展示 / 缓存刷新可用 Money.get / load / setCached / UNIT
 *   - 跨模块写账本（尤其 db.tx 内）必须用本 client，保证与外层事务共享
 */

import type { TxContext } from "@sfmc-bds/sdk/sapi/db";
import { service } from "@sfmc-bds/sdk/sapi/service";

/** 货币展示单位（与 SDK Money.UNIT 一致） */
export const ECONOMY_UNIT = "节操";

export interface EconomyAccountView {
  playerId?: string;
  playerName?: string;
  balance: number;
  version: number;
}

export interface EconomyMutateResult {
  transactionId?: string;
  replayed?: boolean;
  balance?: number;
  version?: number;
  source?: unknown;
  target?: unknown;
}

export interface AccountGetInput {
  playerId: string;
  playerName?: string;
}

export interface AccountMutateInput {
  playerId: string;
  playerName?: string;
  amount: number;
  reason?: string;
  actorId?: string;
  idempotencyKey?: string;
  referenceType?: string;
  referenceId?: string;
  meta?: Record<string, unknown>;
}

export interface AccountTransferInput {
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
  fromPlayerName?: string;
  toPlayerName?: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface DailyTaskRow {
  id: string;
  item_type: string;
  item_aux?: number;
  target_qty: number;
  filled_qty: number;
  unit_reward: number;
}

export interface DailyTasksListInput {
  status?: string;
  includeExpired?: boolean;
}

export interface DailyTasksListResult {
  tasks: DailyTaskRow[];
}

export interface DailyTaskSubmitInput {
  taskId: string;
  actorId: string;
  actorName?: string;
  quantity: number;
}

export interface DailyTaskSubmitResult {
  ok: boolean;
  reward?: number;
  balance?: number;
  balanceVersion?: number;
  error?: string;
  status?: number;
}

export interface MonthlyStats {
  id?: string;
  total_issued?: number;
  total_destroyed?: number;
  total_supply?: number;
  active_accounts?: number;
}

type AccountOps = {
  get(input: AccountGetInput): Promise<EconomyAccountView | null>;
  credit(input: AccountMutateInput): Promise<EconomyMutateResult>;
  debit(input: AccountMutateInput): Promise<EconomyMutateResult>;
  transfer(input: AccountTransferInput): Promise<EconomyMutateResult>;
};

function accountViaService(): AccountOps {
  return {
    get: (input) => service.get<EconomyAccountView | null>("economy.account.get", { ...input }),
    credit: (input) =>
      service.get<EconomyMutateResult>("economy.account.credit", { ...input }),
    debit: (input) => service.get<EconomyMutateResult>("economy.account.debit", { ...input }),
    transfer: (input) =>
      service.get<EconomyMutateResult>("economy.account.transfer", { ...input }),
  };
}

function accountViaTx(tx: TxContext): AccountOps {
  return {
    get: (input) => tx.call<EconomyAccountView | null>("economy.account.get", { ...input }),
    credit: (input) => tx.call<EconomyMutateResult>("economy.account.credit", { ...input }),
    debit: (input) => tx.call<EconomyMutateResult>("economy.account.debit", { ...input }),
    transfer: (input) =>
      tx.call<EconomyMutateResult>("economy.account.transfer", { ...input }),
  };
}

/** 账户 / 日常任务 / 统计 统一入口 */
export const economy = {
  unit: ECONOMY_UNIT,

  account: {
    ...accountViaService(),
    /** 事务内调用，与外层 db.tx 共享同一 SQLite 事务（方案 A） */
    inTx(tx: TxContext): AccountOps {
      return accountViaTx(tx);
    },
  },

  dailyTasks: {
    list(input: DailyTasksListInput = {}): Promise<DailyTasksListResult> {
      return service.get<DailyTasksListResult>("economy.dailyTasks.list", { ...input });
    },
    submit(input: DailyTaskSubmitInput): Promise<DailyTaskSubmitResult> {
      return service.get<DailyTaskSubmitResult>("economy.dailyTasks.submit", { ...input });
    },
  },

  stats: {
    monthly(): Promise<MonthlyStats | null> {
      return service.get<MonthlyStats | null>("economy.stats.monthly", {});
    },
  },
};
