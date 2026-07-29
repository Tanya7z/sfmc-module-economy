# sfmc-module-economy

SFMC 官方模块：经济系统（账户 / 转账 / 日常任务 / 月度白皮书）。

包名：`@sfmc-bds/module-economy`  
manifest id：`feature-economy`（安装 id：`economy`）

## 日常开发（在平台主仓执行）

```bash
sfmc mod install economy --from dir:<本仓绝对路径> --link
sfmc mod enable economy
sfmc mod reload
sfmc mod watch
```

## 测试

```bash
npm test
# 或
sfmc mod test --from local:<本仓绝对路径>
```

## 发布

```bash
SFMC_OFFICIAL_PUBLISH=1 sfmc mod publish --dry-run
SFMC_OFFICIAL_PUBLISH=1 sfmc mod publish --bump patch --skip-index-pr
# index 中已有 economy 条目时：发布后手动把 npm/version 写入 sfmc-modules/index.json
```

或用 `.github/workflows/release.yml`（Trusted Publishing）。
