# 渠道插件内置化实施计划

## 任务 1：更新依赖来源

- 修改 `package.json`
- 更新 `pnpm-lock.yaml`
- 删除 `@wecom/wecom-openclaw-plugin`
- 引入 `@openclaw-china/wecom`
- 升级 `@larksuite/openclaw-lark`

## 任务 2：更新打包链

- 修改 `scripts/bundle-openclaw-plugins.mjs`
- 修改 `scripts/after-pack.cjs`
- WeCom 输出目录保持 `wecom`
- Feishu 输出目录改为 `openclaw-lark`

## 任务 3：更新运行时安装链

- 修改 `electron/utils/plugin-install.ts`
- Feishu 安装目标改为 `openclaw-lark`
- 安装 Feishu 时删除旧目录 `feishu-openclaw-plugin`
- WeCom 开发态回退来源改为 `@openclaw-china/wecom`

## 任务 4：更新配置同步链

- 修改 `electron/gateway/config-sync.ts`
- Feishu 配置渠道目录改为 `openclaw-lark`
- 保留旧 Feishu id 的配置迁移

## 任务 5：补关键回归

- 修改 `tests/unit/channel-config.test.ts`
- 修改 `tests/unit/openclaw-auth.test.ts`
- 验证 Feishu 保存与 sanitize 迁移

## 任务 6：执行验证

- `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/openclaw-auth.test.ts`
- `pnpm exec eslint scripts/bundle-openclaw-plugins.mjs scripts/after-pack.cjs electron/utils/plugin-install.ts electron/gateway/config-sync.ts electron/utils/openclaw-auth.ts electron/utils/channel-config.ts tests/unit/channel-config.test.ts tests/unit/openclaw-auth.test.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run bundle:openclaw-plugins`
- `pnpm run package:mac:local`
