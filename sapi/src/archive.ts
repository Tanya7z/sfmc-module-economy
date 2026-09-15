/**
 * 经济归档：账户快照 + 流水 + 幂等重放 + 失败重试队列。
 */

import { db } from "@sfmc-bds/sdk/sapi/db";
import { debug } from "@sfmc-bds/sdk/sapi/runtime";
import { inferAccountType } from "./account-id.js";

export const ACCOUNTS_TABLE = "sfmc_economy_accounts";
export const TX_TABLE = "sfmc_economy_transactions";

export interface TxArchiveRow {
  id: string;
  type: "credit" | "debit" | "transfer";
  actor_id: string;
  source_account_id: string;
  target_account_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reason: string;
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  created_at: number;
}

export interface MutateResult {
  transactionId: string;
  balance: number;
  replayed?: boolean;
}

type PendingArchive = {
  kind: "mutate";
  accountId: string;
  accountName: string;
  balance: number;
  alsoAccounts?: Array<{ accountId: string; balance: number; accountName?: string }>;
  tx: TxArchiveRow;
};

const pendingQueue: PendingArchive[] = [];

function makeTxId(): string {
  return `eco_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 建表。 */
export async function defineEconomyTables(): Promise<void> {
  await db.defineTable(ACCOUNTS_TABLE, {
    account_id: { type: "TEXT", primary: true },
    account_name_snapshot: { type: "TEXT", default: "" },
    balance: { type: "INTEGER", notNull: true, default: 0 },
    account_type: { type: "TEXT", notNull: true, default: "player" },
    updated_at: { type: "INTEGER", notNull: true, index: true },
  });
  await db.defineTable(TX_TABLE, {
    id: { type: "TEXT", primary: true },
    type: { type: "TEXT", notNull: true },
    actor_id: { type: "TEXT", default: "" },
    source_account_id: { type: "TEXT", default: "" },
    target_account_id: { type: "TEXT", default: "" },
    amount: { type: "INTEGER", notNull: true },
    balance_before: { type: "INTEGER", notNull: true },
    balance_after: { type: "INTEGER", notNull: true },
    reason: { type: "TEXT", default: "" },
    reference_type: { type: "TEXT", default: "" },
    reference_id: { type: "TEXT", default: "" },
    idempotency_key: { type: "TEXT", default: "", index: true },
    created_at: { type: "INTEGER", notNull: true, index: true },
  });
}

/** 按幂等键查找已有流水。 */
export async function findByIdempotencyKey(key: string): Promise<TxArchiveRow | null> {
  if (!key) return null;
  const rows = await db.query(TX_TABLE, {
    where: { eq: ["idempotency_key", key] },
    limit: 1,
  });
  return (rows[0] as unknown as TxArchiveRow | undefined) ?? null;
}

async function upsertAccount(
  tx: { get: Function; insert: Function; update: Function },
  accountId: string,
  balance: number,
  accountName?: string,
): Promise<void> {
  const existing = await tx.get(ACCOUNTS_TABLE, accountId);
  const snap = {
    account_id: accountId,
    account_name_snapshot: accountName ?? accountId,
    balance,
    account_type: inferAccountType(accountId),
    updated_at: Date.now(),
  };
  if (existing) await tx.update(ACCOUNTS_TABLE, accountId, snap);
  else await tx.insert(ACCOUNTS_TABLE, snap);
}

/** 写入快照 + 流水；失败入重试队列，不得静默丢流水。 */
export async function archiveMutation(opts: {
  accountId: string;
  accountName?: string;
  balance: number;
  /** 额外需同步的账户快照（如 transfer 目标）。 */
  alsoAccounts?: Array<{ accountId: string; balance: number; accountName?: string }>;
  tx: Omit<TxArchiveRow, "id"> & { id?: string };
}): Promise<string> {
  const txId = opts.tx.id ?? makeTxId();
  const row: TxArchiveRow = { ...opts.tx, id: txId };
  const accountName = opts.accountName ?? opts.accountId;
  try {
    await db.tx(async (tx) => {
      await upsertAccount(tx, opts.accountId, opts.balance, accountName);
      for (const extra of opts.alsoAccounts ?? []) {
        await upsertAccount(tx, extra.accountId, extra.balance, extra.accountName);
      }
      await tx.insert(TX_TABLE, row as unknown as Record<string, unknown>);
    });
  } catch (err) {
    debug.e(
      "Economy",
      `archive failed, queued tx=${txId}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    pendingQueue.push({
      kind: "mutate",
      accountId: opts.accountId,
      accountName,
      balance: opts.balance,
      alsoAccounts: opts.alsoAccounts,
      tx: row,
    });
  }
  return txId;
}

/** 刷写重试队列。 */
export async function flushPendingArchive(): Promise<void> {
  if (pendingQueue.length === 0) return;
  const batch = pendingQueue.splice(0, pendingQueue.length);
  for (const item of batch) {
    try {
      await archiveMutation({
        accountId: item.accountId,
        accountName: item.accountName,
        balance: item.balance,
        alsoAccounts: item.alsoAccounts,
        tx: item.tx,
      });
    } catch (err) {
      debug.e(
        "Economy",
        "retry archive still failing",
        err instanceof Error ? err : new Error(String(err)),
      );
      pendingQueue.push(item);
    }
  }
}

/** 以计分板为准回写快照。 */
export async function reconcileAccount(accountId: string, balance: number, accountName?: string): Promise<void> {
  const now = Date.now();
  await db.tx(async (tx) => {
    const existing = await tx.get(ACCOUNTS_TABLE, accountId);
    const snap = {
      account_id: accountId,
      account_name_snapshot: accountName ?? accountId,
      balance,
      account_type: inferAccountType(accountId),
      updated_at: now,
    };
    if (existing) await tx.update(ACCOUNTS_TABLE, accountId, snap);
    else await tx.insert(ACCOUNTS_TABLE, snap);
  });
}

export function pendingArchiveSize(): number {
  return pendingQueue.length;
}
