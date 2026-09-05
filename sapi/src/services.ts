/**
 * economy.account.* / economy.stats.query 服务实现。
 */

import { db } from "@sfmc-bds/sdk/sapi/db";
import { ServiceError } from "@sfmc-bds/sdk/sapi/service";
import {
  ACCOUNTS_TABLE,
  TX_TABLE,
  archiveMutation,
  findByIdempotencyKey,
  type MutateResult,
  type TxArchiveRow,
} from "./archive.js";
import { getBalance, setBalance } from "./scoreboard.js";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asAmount(v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0) {
    throw new ServiceError("amount 须为正整数", "invalid_argument", 400);
  }
  return v;
}

function resolveAccountId(input: Record<string, unknown>): string {
  const id = asString(input.accountId) || asString(input.playerId);
  if (!id) throw new ServiceError("缺少 accountId / playerId", "invalid_argument", 400);
  return id;
}

function replayResult(row: TxArchiveRow): MutateResult {
  return {
    transactionId: row.id,
    balance: row.balance_after,
    replayed: true,
  };
}

/** economy.account.get */
export async function handleGet(input: Record<string, unknown>): Promise<{
  accountId: string;
  balance: number;
  accountName?: string;
}> {
  const accountId = resolveAccountId(input);
  const balance = getBalance(accountId);
  const accountName = asString(input.accountName) || asString(input.playerName) || undefined;
  const out: { accountId: string; balance: number; accountName?: string } = { accountId, balance };
  if (accountName) out.accountName = accountName;
  return out;
}

/** economy.account.credit */
export async function handleCredit(input: Record<string, unknown>): Promise<MutateResult> {
  const accountId = resolveAccountId(input);
  const amount = asAmount(input.amount);
  const idempotencyKey = asString(input.idempotencyKey);
  if (idempotencyKey) {
    const hit = await findByIdempotencyKey(idempotencyKey);
    if (hit) return replayResult(hit);
  }

  const before = getBalance(accountId);
  const after = before + amount;
  setBalance(accountId, after);

  const transactionId = await archiveMutation({
    accountId,
    accountName: asString(input.accountName) || asString(input.playerName) || accountId,
    balance: after,
    tx: {
      type: "credit",
      actor_id: asString(input.actorId),
      source_account_id: "",
      target_account_id: accountId,
      amount,
      balance_before: before,
      balance_after: after,
      reason: asString(input.reason),
      reference_type: asString(input.referenceType),
      reference_id: asString(input.referenceId),
      idempotency_key: idempotencyKey,
      created_at: Date.now(),
    },
  });
  return { transactionId, balance: after };
}

/** economy.account.debit */
export async function handleDebit(input: Record<string, unknown>): Promise<MutateResult> {
  const accountId = resolveAccountId(input);
  const amount = asAmount(input.amount);
  const idempotencyKey = asString(input.idempotencyKey);
  if (idempotencyKey) {
    const hit = await findByIdempotencyKey(idempotencyKey);
    if (hit) return replayResult(hit);
  }

  const before = getBalance(accountId);
  if (before < amount) {
    throw new ServiceError("余额不足", "insufficient_funds", 409);
  }
  const after = before - amount;
  setBalance(accountId, after);

  const transactionId = await archiveMutation({
    accountId,
    accountName: asString(input.accountName) || asString(input.playerName) || accountId,
    balance: after,
    tx: {
      type: "debit",
      actor_id: asString(input.actorId),
      source_account_id: accountId,
      target_account_id: "",
      amount,
      balance_before: before,
      balance_after: after,
      reason: asString(input.reason),
      reference_type: asString(input.referenceType),
      reference_id: asString(input.referenceId),
      idempotency_key: idempotencyKey,
      created_at: Date.now(),
    },
  });
  return { transactionId, balance: after };
}

/** economy.account.transfer */
export async function handleTransfer(input: Record<string, unknown>): Promise<MutateResult> {
  const fromAccountId = asString(input.fromAccountId) || asString(input.fromPlayerId);
  const toAccountId = asString(input.toAccountId) || asString(input.toPlayerId);
  if (!fromAccountId || !toAccountId) {
    throw new ServiceError("缺少 fromAccountId / toAccountId", "invalid_argument", 400);
  }
  if (fromAccountId === toAccountId) {
    throw new ServiceError("转账账户不能相同", "invalid_argument", 400);
  }
  const amount = asAmount(input.amount);
  const idempotencyKey = asString(input.idempotencyKey);
  if (idempotencyKey) {
    const hit = await findByIdempotencyKey(idempotencyKey);
    if (hit) return replayResult(hit);
  }

  const fromBefore = getBalance(fromAccountId);
  if (fromBefore < amount) {
    throw new ServiceError("余额不足", "insufficient_funds", 409);
  }
  const fromAfter = fromBefore - amount;
  const toBefore = getBalance(toAccountId);
  const toAfter = toBefore + amount;
  setBalance(fromAccountId, fromAfter);
  setBalance(toAccountId, toAfter);

  const createdAt = Date.now();
  const transactionId = await archiveMutation({
    accountId: fromAccountId,
    balance: fromAfter,
    alsoAccounts: [{ accountId: toAccountId, balance: toAfter }],
    tx: {
      type: "transfer",
      actor_id: asString(input.actorId),
      source_account_id: fromAccountId,
      target_account_id: toAccountId,
      amount,
      balance_before: fromBefore,
      balance_after: fromAfter,
      reason: asString(input.reason),
      reference_type: asString(input.referenceType),
      reference_id: asString(input.referenceId),
      idempotency_key: idempotencyKey,
      created_at: createdAt,
    },
  });
  return { transactionId, balance: fromAfter };
}

type StatsMetric =
  | "supply"
  | "active_accounts"
  | "tx_count"
  | "volume_credit"
  | "volume_debit"
  | "volume_transfer";

const ALL_METRICS: StatsMetric[] = [
  "supply",
  "active_accounts",
  "tx_count",
  "volume_credit",
  "volume_debit",
  "volume_transfer",
];

function bucketKey(ts: number, groupBy: "day" | "month"): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (groupBy === "month") return `${y}-${m}`;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** economy.stats.query */
export async function handleStatsQuery(input: Record<string, unknown>): Promise<{
  generatedAt: number;
  rows: Array<{ bucket?: string; values: Record<string, number> }>;
}> {
  const rawMetrics = Array.isArray(input.metrics) ? input.metrics : ALL_METRICS;
  const metrics = rawMetrics.filter((m): m is StatsMetric =>
    typeof m === "string" && (ALL_METRICS as string[]).includes(m),
  );
  const from = typeof input.from === "number" ? input.from : undefined;
  const to = typeof input.to === "number" ? input.to : undefined;
  const groupBy = input.groupBy === "day" || input.groupBy === "month" ? input.groupBy : undefined;

  const accountRows = await db.query<{ balance: number }>(ACCOUNTS_TABLE, {});
  const txWhere =
    from !== undefined || to !== undefined
      ? {
          and: [
            ...(from !== undefined ? [{ gte: ["created_at", from] as [string, number] }] : []),
            ...(to !== undefined ? [{ lte: ["created_at", to] as [string, number] }] : []),
          ],
        }
      : undefined;
  const txRows = await db.query<{
    type: string;
    amount: number;
    created_at: number;
  }>(TX_TABLE, txWhere ? { where: txWhere } : {});

  function aggregate(rows: typeof txRows, accounts: typeof accountRows): Record<string, number> {
    const values: Record<string, number> = {};
    for (const m of metrics) {
      switch (m) {
        case "supply":
          values.supply = accounts.reduce((s, r) => s + (Number(r.balance) || 0), 0);
          break;
        case "active_accounts":
          values.active_accounts = accounts.filter((r) => (Number(r.balance) || 0) > 0).length;
          break;
        case "tx_count":
          values.tx_count = rows.length;
          break;
        case "volume_credit":
          values.volume_credit = rows
            .filter((r) => r.type === "credit")
            .reduce((s, r) => s + (Number(r.amount) || 0), 0);
          break;
        case "volume_debit":
          values.volume_debit = rows
            .filter((r) => r.type === "debit")
            .reduce((s, r) => s + (Number(r.amount) || 0), 0);
          break;
        case "volume_transfer":
          values.volume_transfer = rows
            .filter((r) => r.type === "transfer")
            .reduce((s, r) => s + (Number(r.amount) || 0), 0);
          break;
      }
    }
    return values;
  }

  if (!groupBy) {
    return {
      generatedAt: Date.now(),
      rows: [{ values: aggregate(txRows, accountRows) }],
    };
  }

  const buckets = new Map<string, typeof txRows>();
  for (const row of txRows) {
    const key = bucketKey(Number(row.created_at) || 0, groupBy);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  // supply / active_accounts 在分桶时仍用当前快照（归档语义）
  const rows = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, list]) => ({ bucket, values: aggregate(list, accountRows) }));

  return { generatedAt: Date.now(), rows };
}
