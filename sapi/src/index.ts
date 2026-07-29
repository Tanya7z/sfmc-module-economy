/**
 * @CHANGE_ME/sfmc-module-example — 示例模块
 * 由 sfmc-module-template 生成；运行 `node scripts/rename.mjs <kebab-id> --scope <user>` 改名。
 *
 * 黄金路径：
 *   1) node scripts/rename.mjs my-feature --scope <user> --name "我的功能"
 *   2) npm install && npm run typecheck
 *   3) （主仓）sfmc mod install my-feature --from dir:<本仓> --link
 *   4) sfmc mod enable my-feature && sfmc mod reload
 *   5) sfmc mod watch
 *   6) sfmc mod publish
 */

import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Command, Permission, Msg } from "@sfmc-bds/sdk/sapi/runtime";

const MODULE_ID = "feature-example";
const PERM = "example.use";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register(PERM, Permission.Any);
    },
    registerCommands() {
      Command.register(
        "example",
        PERM,
        (player) => {
          Msg.info(`模块示例已就绪 — 你好 ${player?.name ?? "?"}`);
        },
        "示例命令"
      );
    },
    async init() {
      // 首次启用时读取 configs/example.json；可在此注册 db 表 / service。
    },
    cleanup() {
      // 关闭连接 / 清理 timer。
    },
  },
});
