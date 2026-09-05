/**
 * 计分板权威余额读写（objective 默认 sfmc_money）。
 * 支持在线玩家实体与假名参与者（组织公账如 coop:<cid>）。
 */

import { Player, world, type ScoreboardObjective } from "@minecraft/server";

let objectiveId = "sfmc_money";
let objectiveDisplay = "节操";

/** 更新 objective 配置（init 时调用）。 */
export function configureScoreboard(id: string, display: string): void {
  objectiveId = id || "sfmc_money";
  objectiveDisplay = display || "节操";
}

/** 确保 objective 存在并返回句柄。 */
export function ensureObjective(): ScoreboardObjective {
  const sb = world.scoreboard;
  let obj = sb.getObjective(objectiveId);
  if (!obj) {
    obj = sb.addObjective(objectiveId, objectiveDisplay);
  }
  return obj;
}

/** 将 accountId 解析为计分板参与者（在线玩家优先）。 */
export function resolveParticipant(accountId: string): Player | string {
  for (const p of world.getAllPlayers()) {
    if (p.id === accountId) return p;
    if (`player:${p.id}` === accountId) return p;
    if (p.name === accountId) return p;
  }
  return accountId;
}

/** 推断账户类型。 */
export function inferAccountType(accountId: string): "player" | "org" {
  if (accountId.includes(":")) return "org";
  return "player";
}

/** 读权威余额；无记录视为 0。 */
export function getBalance(accountId: string): number {
  const obj = ensureObjective();
  const participant = resolveParticipant(accountId);
  const score = obj.getScore(participant);
  return typeof score === "number" ? score : 0;
}

/** 写权威余额（非负整数）。 */
export function setBalance(accountId: string, balance: number): void {
  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new Error(`invalid_balance:${balance}`);
  }
  const obj = ensureObjective();
  obj.setScore(resolveParticipant(accountId), balance);
}

/** 扫描 objective 全部参与者快照（对账用）。 */
export function listScoreboardBalances(): Array<{ accountId: string; balance: number }> {
  const obj = ensureObjective();
  const out: Array<{ accountId: string; balance: number }> = [];
  for (const info of obj.getScores()) {
    const id = info.participant.displayName || String(info.participant.id);
    out.push({ accountId: id, balance: info.score });
  }
  return out;
}
