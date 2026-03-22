# 微信频道集成测试

## 目标

确认微信频道以“内置官方插件 + QClaw 对齐的主进程 `start / poll / cancel` + 频道中心 GUI 扫码”的方式落地后，以下能力稳定可用：

- 打包镜像内置与启动安装
- 微信账号扫码新增
- 已有账号重新扫码
- 账号列表、Agent 绑定、首选账号、启停状态回读
- 微信专属限制提示与健康守护提醒
- 不破坏现有 WhatsApp `web.login.*` 流

## 必跑验证

### 代码级

- `pnpm exec eslint src/pages/Channels/index.tsx src/pages/Agents/index.tsx src/components/channels/ChannelConfigModal.tsx src/lib/channel-registry.ts src/types/channel.ts electron/api/routes/channels.ts electron/utils/channel-config.ts electron/utils/plugin-install.ts electron/gateway/config-sync.ts electron/utils/weixin-login.ts tests/unit/channel-config.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-registry.test.ts tests/unit/channels-page.test.tsx tests/unit/agents-page.test.tsx tests/unit/weixin-login.test.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-registry.test.ts tests/unit/channels-page.test.tsx tests/unit/agents-page.test.tsx tests/unit/weixin-login.test.ts`

### 当前已执行

- `pnpm test tests/unit/weixin-bundling.test.ts`
- `pnpm test tests/unit/weixin-guardian.test.ts`
- `pnpm test tests/unit/channel-routes.test.ts`
- `pnpm test tests/unit/channels-page.test.tsx`
- `pnpm test tests/unit/weixin-guardian.test.ts tests/unit/channel-routes.test.ts tests/unit/channels-page.test.tsx tests/unit/weixin-bundling.test.ts`
- `pnpm test tests/unit/account-id.test.ts tests/unit/weixin-bundling.test.ts tests/unit/weixin-login.test.ts`
- `pnpm test tests/unit/account-id.test.ts tests/unit/plugin-install.test.ts tests/unit/weixin-login.test.ts tests/unit/host-events.test.ts tests/unit/channel-config-modal.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-config.test.ts tests/unit/weixin-guardian.test.ts tests/unit/channel-routes.test.ts tests/unit/channels-page.test.tsx tests/unit/weixin-bundling.test.ts`
- `pnpm test tests/unit/weixin-login.test.ts`
- `pnpm test tests/unit/plugin-install.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-icon.test.tsx`
- `pnpm test tests/unit/channels-page.test.tsx tests/unit/channel-config-modal.test.tsx tests/unit/host-events.test.ts`
- `pnpm test tests/unit/plugin-install.test.ts tests/unit/weixin-login.test.ts tests/unit/channel-routes.test.ts`
- `pnpm test tests/unit/weixin-login.test.ts tests/unit/plugin-install.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-config-modal.test.tsx`
- `pnpm test tests/unit/weixin-login.test.ts -t "reuses a stable transient login key"`
- `pnpm test tests/unit/channel-config-modal.test.tsx`
- `pnpm test tests/unit/channels-page.test.tsx`
- 结果：历史主链路批次 `74/74` 通过，新增回归命令也已全部通过

### 构建级

- `pnpm run build:vite`

当前已执行：

- `pnpm run build:vite`
- 结果：通过

### 运行态补充验证

- 观察 `pnpm dev` 日志，确认主进程启动时出现：
  `Normalized Weixin plugin SDK imports in ~/.openclaw/extensions/openclaw-weixin`
- 观察 Gateway 启动日志，确认 `openclaw-weixin` 不再报
  `Cannot find module ... root-alias.cjs/gateway/protocol`
- 用 `curl -m 5 -X POST http://127.0.0.1:3210/api/channels/weixin/start -d '{}'` 触发一次扫码开始请求
- 观察同一时间的 `pnpm dev` 日志，确认没有新的
  `gateway-refresh`
  `Gateway stop requested`
  `Gateway start requested`

结果：

- 历史行为验证通过。旧实现下请求会因等待扫码而超时，但验证期间未再出现“点击即重启 Gateway”的日志证据
- 当前实现已修正为 `start` 直接返回 `qrcodeUrl + sessionKey`，渲染层通过 `/poll` 获取状态快照，不再依赖 host event 推送

### 静态检查

- `pnpm exec eslint src/pages/Channels/index.tsx src/pages/Agents/index.tsx src/components/channels/ChannelConfigModal.tsx src/lib/channel-registry.ts src/types/channel.ts electron/api/routes/channels.ts electron/utils/channel-config.ts electron/utils/plugin-install.ts electron/gateway/config-sync.ts electron/utils/weixin-login.ts electron/utils/weixin-guardian.ts shared/account-id.ts shared/weixin-guardian.ts tests/unit/account-id.test.ts tests/unit/plugin-install.test.ts tests/unit/channel-config.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-registry.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-config-modal.test.tsx tests/unit/host-events.test.ts tests/unit/weixin-login.test.ts tests/unit/weixin-bundling.test.ts tests/unit/weixin-guardian.test.ts --max-warnings=0`
- 结果：通过
- `pnpm exec eslint electron/utils/weixin-login.ts src/components/channels/ChannelIcon.tsx src/pages/Channels/index.tsx src/pages/Agents/index.tsx src/components/channels/ChannelConfigModal.tsx src/pages/Cron/index.tsx electron/utils/plugin-install.ts electron/api/routes/channels.ts electron/gateway/config-sync.ts tests/unit/weixin-login.test.ts tests/unit/channel-icon.test.tsx tests/unit/plugin-install.test.ts tests/unit/channel-routes.test.ts --max-warnings=0`
- 结果：通过
- `pnpm exec eslint src/components/channels/ChannelConfigModal.tsx electron/api/routes/channels.ts tests/unit/channel-config-modal.test.tsx tests/unit/channel-routes.test.ts --max-warnings=0`
- 结果：通过
- `pnpm run typecheck`
- 结果：当前分支失败，失败点为 `src/stores/chat.ts` 与 `src/stores/chat/slash-commands.ts` 的未使用导入，与微信集成代码无直接关系

### 端到端

- `pnpm run test:e2e -- tests/e2e/channels.spec.ts`

### 文档级

- 检查 `README.md`
- 检查 `README.zh-CN.md`
- 检查 `README.ja-JP.md`

## 建议新增测试

### 1. 插件镜像与启动安装

文件：

- `tests/unit/plugin-install.test.ts`
- `tests/unit/weixin-bundling.test.ts`

覆盖点：

- `openclaw-weixin` 被纳入 bundled plugin 清单
- 启动前自动升级链路包含 `openclaw-weixin`
- 历史安装产物即使残留旧 bridge，也不再阻断当前扫码主链路
- 修补失败时会返回明确错误，而不是静默继续

### 2. 微信配置持久化

文件：

- `tests/unit/channel-config.test.ts`

覆盖点：

- `saveChannelConfig('openclaw-weixin', ...)` 会正确写入 `channels.openclaw-weixin.accounts.<accountId>`
- `ensurePluginAllowlist()` 会开启 `plugins.entries.openclaw-weixin.enabled`
- `setChannelDefaultAccount('openclaw-weixin', ...)` 只影响 XClaw 首选账号语义，不破坏账号配置
- 删除账号后，`defaultAccount` 会回退到下一个账号

### 3. 微信登录桥接

文件：

- `tests/unit/weixin-login.test.ts`
- `tests/unit/channel-routes.test.ts`

覆盖点：

- 启动扫码时主进程直接请求 `ilink` 二维码接口
- 同版本已安装微信插件若导入未导出的 `openclaw/plugin-sdk/gateway/protocol`，安装修补会改写为 `openclaw/plugin-sdk`
- `start` 立即返回 `qrcodeUrl + sessionKey`
- 非 `data:image/*` 的微信二维码值会按内容字符串绘制为 canvas
- `poll` 返回 `wait / scaned / confirmed / expired`
- 新账号成功后会先写账号状态文件，再保存最小账号配置并刷新 Gateway
- 再次扫码时 `force=true` 会覆盖旧会话
- `cancel` 会显式结束当前桌面端登录会话

### 4. 频道中心微信特化 UI

文件：

- `tests/unit/channels-page.test.tsx`

覆盖点：

- 微信渠道显示“扫码添加账号”，不显示普通凭证表单
- 新建微信账号时不允许手输 `accountId`
- 已有微信账号只读展示真实 `accountId`
- 扫码配置弹窗会展示 Agent 选择器，而不是要求用户保存后再回到右栏绑定
- 重新扫码弹窗会预填当前已绑定的 Agent，新账号扫码默认保持未绑定
- “重新扫码”按钮存在并能触发桥接接口
- 微信右栏显示健康守护卡与限制说明卡
- 首选账号文案不会误导成官方默认账号
- 频道图标在 Channels / Agents / 配置弹窗 / Cron 中保持统一彩色风格

### 5. Agent 页面集成

文件：

- `tests/unit/agents-page.test.tsx`

覆盖点：

- 微信账号能出现在 Agent 绑定列表
- 绑定关系显示用户可读名称
- 绑定后不会丢失真实 `accountId`

### 6. 健康守护

文件：

- `tests/unit/weixin-guardian.test.ts`

覆盖点：

- 仅在用户开启时才启动守护
- 检测到 `lastError` 包含会话过期或暂停语义时触发提醒
- 长时间无入站/出站活动时触发提醒
- 不会自动发消息或改写微信配置

## 手工测试

### 场景 1：首次内置安装

1. 清空本地 `~/.openclaw/extensions/openclaw-weixin`
2. 启动 XClaw
3. 打开频道页
4. 确认微信渠道可见
5. 点击进入微信渠道
6. 确认不会要求用户执行 `npx` 或 CLI 命令

### 场景 2：扫码新增账号

1. 在微信渠道点击“扫码添加账号”
2. 确认不会在二维码出现前主动触发 Gateway 重启
3. 确认页面展示的是真实可扫描二维码，而不是占位图标或错误图片
4. 确认弹窗内可以直接选择要绑定的 Agent
5. 用手机扫码完成登录
6. 确认账号自动出现在列表中
7. 确认页面选中的是新账号
8. 确认真实 `accountId` 为只读展示
9. 确认刚才选择的 Agent 已经绑定到该账号

### 场景 3：已有账号重新扫码

1. 选择已有微信账号
2. 点击“重新扫码”
3. 确认弹窗预填当前已绑定的 Agent
4. 确认二维码重新生成
5. 扫码成功后确认账号状态恢复
6. 如果扫码的是其他 bot，确认页面以真实扫码结果为准，不伪造原账号 id

### 场景 4：基础配置与绑定

1. 为微信账号设置显示名称
2. 设置首选账号
3. 绑定 Agent
4. 刷新页面
5. 确认以上状态都能回读

### 场景 5：健康守护

1. 打开微信账号的健康守护开关
2. 人工制造或模拟会话异常状态
3. 确认频道页出现风险提示
4. 确认桌面提醒可触发
5. 确认提醒只提供重新扫码入口，不会自动发消息

### 场景 6：回归保护

1. 打开 WhatsApp 配置弹窗
2. 确认 WhatsApp 现有二维码流程仍可用
3. 打开 WeCom / Feishu / QQ Bot
4. 确认原有配置保存与状态回读不受影响
5. 确认 Channels / Agents / 配置弹窗 / Cron 中渠道图标均为真实品牌彩色图标，而不是统一渐变底板

## 当前验证缺口

- CI 无法完成真实微信扫码登录，二维码成功链路仍需手工验证
- 上游插件状态文件格式若变动，需要重新验证写入兼容性
- 健康守护只覆盖“提示与重连辅助”，不验证任何平台绕过能力
- 全仓 `typecheck` 目前被同分支其他功能改动阻塞，不能把它误判成微信功能回归
