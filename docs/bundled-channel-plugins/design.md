# 渠道插件内置化设计

## 背景

当前 XClaw 已经具备“打包期内置插件镜像 + 首次启动自动复制到 `~/.openclaw/extensions`”的能力，用户不需要手工执行 `npm`、`npx` 或 `openclaw plugins install`。

本轮目标不是重做架构，而是把渠道插件来源收敛到新的上游包，并继续保证：

- macOS 离线可用
- Windows 离线可用
- 用户零安装

## 本轮范围

- WeCom 插件来源切换为 `@openclaw-china/wecom`
- Feishu 插件继续使用 `@larksuite/openclaw-lark`
- 打包脚本与 afterPack 内置镜像来源同步更新
- 启动期和渠道配置期继续自动安装 / 升级插件
- Feishu 统一使用真实插件 id `openclaw-lark`
- 删除旧的 `feishu-openclaw-plugin` 目录与主链引用

## 非目标

- 不改 DingTalk 来源
- 不改 QQ Bot 来源
- 不引入运行时联网安装
- 不要求用户机器预装 Node、npm、npx 或 openclaw CLI

## 设计结论

### 1. 保留现有离线架构

继续沿用两段式流程：

1. 打包阶段将插件包展开为 `build/openclaw-plugins/<pluginDir>`
2. 首次启动或保存渠道配置时，将镜像复制到 `~/.openclaw/extensions/<pluginDir>`

这样可继续复用现有 Win/mac 兼容路径，尤其是 Windows 长路径处理和 packaged 模式资源复制逻辑。

### 2. WeCom 改为新来源

- 旧来源：`@wecom/wecom-openclaw-plugin`
- 新来源：`@openclaw-china/wecom`

新包的 `openclaw.plugin.json` 已直接声明 `id: "wecom"`，因此运行时仍可继续使用目录名 `wecom`，无需新增兼容层。

### 3. Feishu 主链只保留 `openclaw-lark`

`@larksuite/openclaw-lark` 的真实插件 id 是 `openclaw-lark`。当前代码里仍残留 `feishu-openclaw-plugin` 作为打包目录名，这会让配置、安装目录和运行时 manifest id 长期不一致。

本轮改为：

- 打包目录统一为 `openclaw-lark`
- 启动安装目录统一为 `~/.openclaw/extensions/openclaw-lark`
- 旧目录 `~/.openclaw/extensions/feishu-openclaw-plugin` 在安装 / 升级时主动删除
- 配置清洗阶段继续兼容一次旧 id，并迁移到 `openclaw-lark`

## 涉及模块

- `package.json`
- `pnpm-lock.yaml`
- `scripts/bundle-openclaw-plugins.mjs`
- `scripts/after-pack.cjs`
- `electron/utils/plugin-install.ts`
- `electron/gateway/config-sync.ts`
- `electron/utils/openclaw-auth.ts`
- `electron/utils/channel-config.ts`

## 风险与控制

### 风险 1：旧 Feishu 目录残留导致重复加载

处理：

- 安装新插件时主动删除旧目录
- `sanitizeOpenClawConfig()` 继续把旧配置迁移到 `openclaw-lark`

### 风险 2：打包脚本改源后 packaged 资源缺失

处理：

- `bundle-openclaw-plugins`
- `after-pack`
- `package:mac:local`

三条链路都要验证 `openclaw-plugins/wecom` 与 `openclaw-plugins/openclaw-lark` 真实存在。

### 风险 3：Windows 离线能力回退

处理：

- 不在用户机器执行安装命令
- 继续使用打包期镜像复制
- 保留现有 Windows 长路径保护逻辑
