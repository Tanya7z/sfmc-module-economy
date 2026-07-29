/**
 * types.ts — 经济系统数据模型（本模块权威）
 *
 * 平台 db-server 保留结构等价的本地行类型，不 npm 依赖本包。
 */

export interface EconomyAccountRow {
  player_id: string;
  player_name_snapshot: string;
  balance: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface EconomyIdempotencyRow {
  actor_id: string;
  idempotency_key: string;
  transaction_id: string;
  response_json: string;
  created_at: number;
}

export interface EconomyTransactionRow {
  id: string;
  transaction_type: string;
  actor_id: string;
  source_player_id?: string;
  target_player_id?: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  reference_type: string;
  reference_id: string;
  reason: string;
  created_at: number;
  idempotency_key: string;

  /** JS-side alias fields */
  actorId?: string;
  type?: string;
  referenceType?: string;
  referenceId?: string;
  sourcePlayerName?: string;
  targetPlayerName?: string;
}
