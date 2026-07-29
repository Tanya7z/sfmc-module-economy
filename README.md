# sfmc-module-example

> 模板仓：`Use this template` 派生你的模块仓；改名后跑通联调与发布即可。  
> **`sfmc-modules` 仅为薄 index，不要在那里写业务源码。**

## 一次性设置

```bash
node scripts/rename.mjs my-feature --scope <你的npm用户名> --name "我的功能"
# 官方模块: --official（包名 @sfmc-bds/module-<id>）
npm install
npm run typecheck
```

## 日常开发（在平台主仓执行）

```bash
sfmc mod install my-feature --from dir:<本仓绝对路径> --link
sfmc mod enable my-feature
sfmc mod reload
sfmc mod watch
```

也可：`sfmc mod install --from local:<本仓绝对路径> --link`（可省略 id）。

## 测试

```bash
sfmc mod test
# 或
npm test
```

## 发布

```bash
sfmc mod publish --dry-run
sfmc mod publish --bump patch
sfmc mod publish --gh-push
```

或用 `.github/workflows/release.yml`（Trusted Publishing + 薄 index PR）。

## 目录结构

```text
.
├── package.json
├── scripts/rename.mjs
├── sapi/
│   ├── manifest.json
│   ├── tsconfig.json
│   └── src/index.ts
├── test/
└── .github/workflows/
```

## 修改 `manifest.json` 后

SAPI 启动期缓存——**`sfmc mod watch` 不会热更**。请重启 BDS。
