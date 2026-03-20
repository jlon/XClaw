# 渠道插件内置化测试

## 目标

确认 WeCom / Feishu 新来源在开发态与打包态都能继续离线工作，不要求用户自行安装插件。

## 必跑验证

### 代码级

- `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/openclaw-auth.test.ts`
- `pnpm exec eslint scripts/bundle-openclaw-plugins.mjs scripts/after-pack.cjs electron/utils/plugin-install.ts electron/gateway/config-sync.ts electron/utils/openclaw-auth.ts electron/utils/channel-config.ts tests/unit/channel-config.test.ts tests/unit/openclaw-auth.test.ts --max-warnings=0`
- `pnpm run typecheck`

### 打包链

- `pnpm run bundle:openclaw-plugins`
- `pnpm run package:mac:local`

### 本轮已执行

- `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/openclaw-auth.test.ts`
- `pnpm exec eslint scripts/bundle-openclaw-plugins.mjs scripts/after-pack.cjs electron/utils/plugin-install.ts electron/gateway/config-sync.ts electron/utils/openclaw-auth.ts electron/utils/channel-config.ts tests/unit/channel-config.test.ts tests/unit/openclaw-auth.test.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run bundle:openclaw-plugins`
- `pnpm run package:mac:local`

## 手工检查

### 开发态

1. 删除 `~/.openclaw/extensions/wecom`
2. 删除 `~/.openclaw/extensions/openclaw-lark`
3. 若存在，删除 `~/.openclaw/extensions/feishu-openclaw-plugin`
4. 启动应用
5. 检查插件目录是否被自动恢复

### 打包态

检查打包产物中的资源目录是否存在：

- `openclaw-plugins/wecom`
- `openclaw-plugins/openclaw-lark`

## 通过标准

- WeCom 来源已经切换到 `@openclaw-china/wecom`
- Feishu 主链只使用 `openclaw-lark`
- 旧 `feishu-openclaw-plugin` 不再作为打包或安装目标
- 启动后无需联网安装即可恢复渠道插件
- mac `x64 / arm64` 本地产物资源目录均包含 `wecom` 与 `openclaw-lark`
