# 微信频道集成设计

## 背景

XClaw 当前的频道能力不是“前端直接接第三方 SDK”，而是稳定的三段式链路：

- 渲染层负责展示、编辑、状态回读
- 主进程负责写入 `openclaw.json`、安装内置插件、触发 Gateway 刷新
- OpenClaw Gateway 负责真正的收发消息与频道插件运行

这条链路已经在 DingTalk、WeCom、Feishu、QQ Bot 上跑通。本轮微信集成必须继续复用这条架构，不能为了接入官方微信插件把现有生命周期管理打散。

## 证据结论

### 1. XClaw 当前频道底层实现

- 频道页入口与工作台在 `src/pages/Channels/index.tsx`
- 主进程路由在 `electron/api/routes/channels.ts`
- 配置持久化在 `electron/utils/channel-config.ts`
- 插件镜像安装在 `electron/utils/plugin-install.ts`
- Gateway 启动前插件升级在 `electron/gateway/config-sync.ts`
- 打包内置镜像在 `scripts/bundle-openclaw-plugins.mjs` 与 `scripts/after-pack.cjs`

当前真实模式是：

1. 打包期把插件展开到 `build/openclaw-plugins/<pluginDir>`
2. 启动期或保存频道配置时，再复制到 `~/.openclaw/extensions/<pluginDir>`

这意味着用户机器上不需要 `npm install`、`npx` 或手动 `openclaw plugins install`。

### 2. 官方微信插件的真实能力

基于 `@tencent-weixin/openclaw-weixin@1.0.2` 包内容，可以确认：

- 真实插件 id / channel id 是 `openclaw-weixin`
- 配置主路径是 `channels.openclaw-weixin`
- 登录态保存在 `~/.openclaw/openclaw-weixin/accounts/*.json` 与 `accounts.json`
- 插件实现了 `gateway.loginWithQrStart` / `gateway.loginWithQrWait`
- 插件也实现了 CLI `auth.login`
- 账号 id 由扫码成功后的真实 bot id 归一化生成，不是用户可以任意填写的普通字符串

### 3. 官方 CLI 安装器不适合直接塞进 XClaw

`@tencent-weixin/openclaw-weixin-cli` 实际只是一个命令包装器，执行顺序是：

1. `openclaw plugins install "@tencent-weixin/openclaw-weixin"`
2. `openclaw channels login --channel openclaw-weixin`
3. `openclaw gateway restart`

这条路径和 XClaw 现有架构直接冲突：

- 依赖机器上已有 `openclaw` CLI
- 依赖联网安装 npm 包
- 依赖终端交互扫码
- 绕过 XClaw 自己的插件镜像与 Gateway 生命周期管理

所以本轮不能照文章把 `npx -y @tencent-weixin/openclaw-weixin-cli install` 当集成方案。

### 4. 不能直接复用通用 `web.login.*`

OpenClaw 当前 `web.login.start / web.login.wait` 是单提供者模型：

- Gateway 只会挑选声明了 `gatewayMethods: ["web.login.start", "web.login.wait"]` 的第一个频道插件
- 当前微信官方插件没有声明这两个 `gatewayMethods`
- WhatsApp 已经占用了这条通用 QR 登录语义

因此本轮不能假设“微信像 WhatsApp 一样直接走 `web.login.*` 就能用”。

## 本轮范围

用户已确认本轮做 `A + B`，但需要按真实证据收敛：

- A：官方微信插件内置、频道中心展示、多账号、扫码登录、Agent 绑定、状态与限制提示
- B：做“24 小时风险辅助”，但不承诺做无证据的自动模拟保活

## 非目标

- 不接入 CLI 一键安装器
- 不要求用户预装 Node、npm、npx、openclaw
- 不伪造消息或自动给微信发送保活流量
- 不承诺绕过上游平台会话限制
- 不把微信账号 id 伪装成可自由编辑的普通账号标识
- 不在 v1 暴露当前插件没有真实闭环证据的字段

## 设计结论

### 1. 继续沿用“官方插件内置化”架构

微信插件按现有 bundled plugin 模式落地：

- `package.json` 增加 `@tencent-weixin/openclaw-weixin`
- `scripts/bundle-openclaw-plugins.mjs` 增加 `openclaw-weixin`
- `scripts/after-pack.cjs` 同步把微信镜像带入安装包
- `electron/utils/plugin-install.ts` 增加 `ensureWeixinPluginInstalled()`
- `electron/gateway/config-sync.ts` 把 `openclaw-weixin` 纳入启动前自动升级

这样可以继续保证：

- 离线可用
- 打包态一致
- 用户零命令接入

### 2. 频道内部标识使用真实 id `openclaw-weixin`

本轮不引入额外的 `weixin -> openclaw-weixin` 别名层，直接采用真实 channel key：

- 配置写入：`channels.openclaw-weixin`
- 插件 allowlist：`plugins.allow += "openclaw-weixin"`
- 插件开关：`plugins.entries.openclaw-weixin.enabled = true`
- 运行态 channelType：`openclaw-weixin`

原因：

- 与官方插件、Gateway、状态回读完全一致
- 少一层映射，后端和前端都更稳
- 避免后续再补 `channelType -> pluginId -> configKey` 的二次兼容逻辑

用户侧名称仍然显示为“微信 / WeChat”，不直接暴露内部 id。

### 3. 频道配置边界必须尊重上游真实契约

本轮只暴露当前能被证实的配置能力。

#### 3.1 可进入 v1 的字段

- `name`
- `enabled`
- `cdnBaseUrl`
- `routeTag`

#### 3.2 不能在 v1 中做成可编辑表单的字段

- `accountId`
  - 新账号 id 由扫码结果生成
  - 只能展示，不能让用户手填创建
- `token`
  - 存在插件自己的状态文件，不在 `openclaw.json`
- `baseUrl`
  - 虽然 schema 里声明了，但当前插件的 `resolveWeixinAccount()` 实际优先读状态文件里的 `baseUrl`，没有形成稳定的 `save -> read -> runtime` 闭环

#### 3.3 默认账号语义

微信官方插件本身要求显式 `accountId`，不提供“无账号时自动落默认账号”的运行语义。

因此本轮保留 XClaw 自己的 `defaultAccount` 仅作为：

- 频道页默认选中账号
- Agent 页面默认展示账号
- 未来主账号快捷操作的 UI 语义

不能把它包装成“官方微信插件会自动使用默认账号”。

### 4. 新增一条 QClaw 对齐的桌面二维码链路

这是本轮最关键的设计点。

#### 4.1 为什么不能直接走 CLI

- 终端二维码不适合 GUI
- 没有稳定的结构化返回
- 与 bundled plugin 生命周期冲突

#### 4.2 为什么不能直接走 `web.login.*`

- 微信插件没有注册通用 QR gateway method
- `web.login.*` 当前是单 provider 语义，会和 WhatsApp 冲突

#### 4.3 推荐方案

在 XClaw 主进程直接实现微信登录服务：

- `start`
- `poll`
- `cancel`

主进程直接请求微信 `ilink` 二维码接口：

- `GET /ilink/bot/get_bot_qrcode`
- `GET /ilink/bot/get_qrcode_status`

这样可以得到：

- 不依赖 CLI
- 不依赖额外的 Gateway method 补丁
- 二维码数据结构化返回
- 不占用通用 `web.login.*`
- 登录完成后仍由官方插件消费最终账号状态文件

#### 4.4 主进程登录服务

在 XClaw 主进程新增 `electron/utils/weixin-login.ts`，职责如下：

- `start` 直接拉取二维码并立即返回 `qrcodeUrl + sessionKey`
- `poll` 只返回当前会话状态，不阻塞请求
- `cancel` 结束当前会话
- 主进程后台维护二维码状态轮询
- 登录成功后按官方插件格式写入 `~/.openclaw/openclaw-weixin/accounts/*.json` 与 `accounts.json`
- 再把 `routeTag`、`cdnBaseUrl` 等 XClaw 配置写入 `openclaw.json`
- 最后触发 Gateway `reload`

渲染层不再依赖微信专用 host event，而是：

- 点击按钮调用 `/api/channels/weixin/start`
- 记住 `sessionKey`
- 定时调用 `/api/channels/weixin/poll`
- 关闭弹窗时调用 `/api/channels/weixin/cancel`

### 5. 微信账号流必须特化，不能套现有“先填 accountId 再保存”模型

现有频道中心大量默认假设是：

- 用户先创建账号
- 用户自己输入 `accountId`
- 再填写凭证保存

这套模型对微信是不成立的。

#### 5.1 新账号创建流

微信的新账号创建必须改成：

1. 点击“添加微信账号”
2. 直接开始扫码
3. 扫码成功后由插件返回真实账号 id
4. XClaw 再写入最小账号配置
5. 页面切换到这个新账号

#### 5.2 已有账号编辑流

已有账号只允许编辑：

- 显示名称 `name`
- 启停
- `cdnBaseUrl`
- `routeTag`
- Agent 绑定
- XClaw 侧默认账号

#### 5.3 重新登录流

已有账号支持“重新扫码”：

- 复用已有 `accountId`
- 主进程 `start` 时传现有账号 id
- 成功后按扫码结果更新账号登录态

#### 5.4 账号 id 展示规则

微信账号 id 只做只读展示：

- 列表项展示真实 `accountId`
- 右侧编辑区展示为只读字段或 badge
- 不提供 rename

### 6. 24 小时需求在 v1 中收敛为“健康守护”，不是伪造保活

这里必须明确反对“为了保活，后台自动模拟消息或自动发送内容”这类方案：

- 没有足够上游证据证明这种做法稳定有效
- 平台风险和误触发风险高
- 会让 XClaw 侵入真实会话行为

因此 B 在 v1 中定义为“健康守护”：

- 明确展示微信会话可能存在时间窗或失活风险
- 当运行态出现 `session expired`、`errcode -14`、长时间无入站/出站活动时，给出醒目的风险提示
- 提供可选的桌面提醒
- 提供一键重新扫码入口

#### 6.1 健康守护的数据来源

- `channels.status` 的 `lastInboundAt`
- `channels.status` 的 `lastOutboundAt`
- `channels.status` 的 `lastError`
- 微信插件 runtime 的暂停 / 过期报错

#### 6.2 健康守护的存储位置

该能力是 XClaw 桌面端辅助行为，不是微信插件配置本身。

所以相关开关和阈值不写进 `openclaw.json`，而写入 `electron-store`，避免污染上游插件 schema。

#### 6.3 v1 行为

- 默认关闭
- 开启后，XClaw 在应用运行期间做定时健康检查
- 临近风险窗口或已过期时弹桌面提醒，并在频道页显示“需要重新扫码”
- 不在后台静默发消息，不承诺应用退出后的守护能力

### 7. 频道中心 UI 设计

#### 7.1 左栏

- 新增“微信”渠道卡片
- 展示官方插件渠道，不显示 CLI 安装提示
- 状态摘要优先显示：
  - 账号数
  - 连接状态
  - 是否需要重新扫码

#### 7.2 中栏

- 账号列表展示真实微信账号
- 新增主按钮改为“扫码添加账号”
- 每个账号支持：
  - 重新扫码
  - 设为首选账号
  - 绑定 Agent
  - 删除账号

#### 7.3 右栏

微信右栏不显示传统的凭证输入表单，改成：

- 账号状态卡
- 二维码登录卡
- 基础配置卡
- Agent 绑定卡
- 健康守护卡
- 限制说明卡

限制说明至少包含：

- 新账号 id 由扫码生成
- 重新登录需要重新扫码
- 会话异常时需要重新扫码恢复
- 健康守护只是提醒与诊断，不是平台绕过手段

### 8. 涉及模块

预计落点：

- `package.json`
- `pnpm-lock.yaml`
- `scripts/bundle-openclaw-plugins.mjs`
- `scripts/after-pack.cjs`
- `electron/utils/plugin-install.ts`
- `electron/gateway/config-sync.ts`
- `electron/utils/channel-config.ts`
- `electron/api/routes/channels.ts`
- `electron/utils/weixin-login.ts`
- `src/types/channel.ts`
- `src/lib/channel-registry.ts`
- `src/pages/Channels/index.tsx`
- `src/components/channels/ChannelConfigModal.tsx`
- `src/pages/Agents/index.tsx`
- `src/locales/*/channels.json`
- `README.md`
- `README.zh-CN.md`
- `README.ja-JP.md`

### 9. 实施顺序

1. 内置官方微信插件镜像与启动安装链路
2. 在主进程补齐 `openclaw-weixin` allowlist / config 持久化
3. 新增主进程 `weixin-login` 服务与状态文件持久化
4. 新增 `/api/channels/weixin/start|poll|cancel`
5. 新增频道元数据、图标、i18n、账号列表展示
6. 落地微信专属 UI 流与重新扫码链路
7. 落地健康守护提醒
8. 补齐单测、e2e、文档同步

## 风险与控制

### 风险 1：上游插件升级后入口文件结构变化

处理：

- 补丁逻辑集中在一个函数里
- 启动时校验补丁是否成功
- 若补丁失效，明确提示“微信 GUI 扫码桥接不可用”，不要静默回退

### 风险 2：账号 id 语义与现有通用频道模型不一致

处理：

- 微信渠道禁用手输 `accountId`
- 新账号只允许扫码创建
- 已有账号只读展示真实 id

### 风险 3：把默认账号说成插件默认运行账号

处理：

- UI 文案明确改成“首选账号”
- 设计和文档里明确它是 XClaw 语义，不是上游插件自动 fallback 语义

### 风险 4：把“24 小时保活”做成不受控的后台消息行为

处理：

- v1 只做健康守护与重连辅助
- 不自动发消息
- 不自动模拟用户操作

### 风险 5：二维码等待流程没有取消能力

处理：

- UI 提示“关闭窗口不会停止本次等待，重新发起会覆盖旧二维码”
- 再次点击“重新扫码”时用 `force=true` 启动新会话
