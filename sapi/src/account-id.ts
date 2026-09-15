/**
 * 经济账户标识：逻辑 ID 与计分板假名之间的纯转换（无 Minecraft 依赖）。
 * 当前用于组织公账（如 coop:<cid>）读写计分板，以及归档时区分 player/org。
 */

/** 从逻辑账户 ID 推断类型。含命名空间冒号的视为组织公账。 */
export function inferAccountType(accountId: string): "player" | "org" {
  if (accountId.includes(":")) return "org";
  return "player";
}

/**
 * 逻辑账户 ID → 计分板假名。
 * Script API 会把带冒号的字符串当成命名空间身份（entity identifier）解析，
 * 未登记时直接抛 Failed to resolve identity；组织公账改用点号假名。
 */
export function toFakePlayerName(accountId: string): string {
  return accountId.includes(":") ? accountId.replaceAll(":", ".") : accountId;
}

/**
 * 计分板假名 → 逻辑账户 ID。
 * 仅还原「命名空间.其余部分」形态，避免把玩家名里的点误当成公账。
 */
export function fromFakePlayerName(name: string): string {
  const match = /^([a-z][a-z0-9_]*)\.(.+)$/i.exec(name);
  return match ? `${match[1]}:${match[2]}` : name;
}
