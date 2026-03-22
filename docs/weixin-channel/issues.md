# 微信频道集成问题跟踪

## 当前已知问题

### 1. 官方微信插件没有注册通用 `web.login.*`

这意味着 XClaw 不能直接复用 OpenClaw Control UI 的通用 QR 登录方法。

本轮处理：

- 不动 `web.login.*`
- 改成 XClaw 主进程自己实现 `start / poll / cancel`

### 2. 微信账号 id 不是普通可编辑字段

扫码成功后，插件会用真实 bot id 归一化生成账号 id，并写入自己的状态目录。

本轮处理：

- 新账号不允许手输 `accountId`
- 右栏只读展示 `accountId`
- 不做 rename

### 3. `baseUrl` 当前没有稳定的工作台读写闭环

官方插件 schema 虽然声明了 `baseUrl`，但运行态解析实际优先读状态文件中的 `baseUrl`。

本轮处理：

- v1 不把 `baseUrl` 做成可编辑字段
- 等上游契约稳定后再决定是否开放

### 4. 微信扫码会话必须由宿主维护取消能力

如果沿用插件内部 `wait` 语义，桌面端无法显式 cancel，只能靠超时或覆盖旧会话。

本轮处理：

- 主进程直接维护二维码会话
- 暴露 `/api/channels/weixin/cancel`
- 关闭弹窗时显式结束当前会话

### 5. 二维码过期不能靠插件内部自动刷新

如果桌面端依赖插件内部 `waitForWeixinLogin()`，二维码过期后的刷新时机和渲染层不可控，容易出现“界面和真实会话脱节”。

本轮处理：

- 主进程只把过期状态标记为 `expired`
- 渲染层自行决定是否重新开始扫码
- 不再偷偷刷新二维码

### 6. 微信“24 小时保活”没有足够源码证据支持自动化绕过

用户希望做保活辅助，但当前源码证据不足以证明“自动发送消息 / 模拟操作”是稳定且安全的。

本轮处理：

- v1 只做健康守护与重连辅助
- 不做自动消息保活

### 7. 默认账号语义和官方插件真实语义不完全一致

微信插件本身要求显式 `accountId`，不会像部分渠道那样天然回退到默认账号。

本轮处理：

- 保留 XClaw 的首选账号语义
- 文案里不说“插件默认账号”

### 8. Electron 主构建会被 `openclaw/plugin-sdk` barrel import 拖入重依赖

根因：

- `electron/utils/weixin-login.ts` 只需要 `normalizeAccountId`
- 但 `openclaw/plugin-sdk` 会把整个 plugin-sdk barrel 带进主进程构建
- 该依赖链里包含 `qrcode-terminal` 与 `undici`，会在 `build:vite` 第二阶段触发浏览器兼容与 strict mode 解析问题

本轮处理：

- 不用 Vite external 黑魔法掩盖症状
- 将账号 ID 归一化逻辑按上游当前实现提取到 `shared/account-id.ts`
- 用静态测试防止 `weixin-login` 再次导入 `openclaw/plugin-sdk`

### 9. 同版本已安装的微信插件镜像可能缺失历史 XClaw gateway bridge

根因：

- 早期安装过的 `~/.openclaw/extensions/openclaw-weixin` 目录可能已经是同版本
- 旧逻辑只按版本号判断“已安装”，不会再次修补入口文件
- 结果是磁盘上仍保留未注册 `xclaw.weixin.login.start / wait` 的旧副本

本轮处理：

- 保留安装期自修补，兼容历史版本
- 当前扫码主链路已不再依赖该 bridge
- 即使旧 bridge 缺失，也不会再阻断二维码登录

### 10. 运行中的旧 Gateway 可能仍持有历史未修补插件

根因：

- 历史实现把二维码登录建立在 `xclaw.weixin.login.start` 上
- 运行中的旧 Gateway 一旦没加载到这个方法，就会直接把错误暴露到 UI

本轮处理：

- 当前扫码主链路不再调用 `xclaw.weixin.login.start`
- 微信登录不再以 Gateway method 可用性为前提
- Gateway 只在登录成功后消费最终状态文件

### 11. 微信扫码流程最初没有把 Agent 绑定选择前移到弹窗

根因：

- 右栏工作台已经有成熟的 `Agent` 绑定下拉
- 但新增账号与重新扫码都走 `ChannelConfigModal`
- `Channels` 页面此前没有把 `agents` 列表和当前账号的 `agentId` 透传给弹窗
- 结果是用户必须先扫码完成，再回右栏补绑定，流程被拆成两段

本轮处理：

- 复用现有 `/api/channels/binding` 路由，不新增新的绑定接口
- `ChannelConfigModal` 增加 `availableAgents` 与 `agentId` 入参
- 新增微信账号时弹窗展示 Agent 选择器，但默认保持未绑定
- 已有账号重新扫码时弹窗预填当前绑定的 Agent
- 登录成功后仍由弹窗统一调用现有绑定路由持久化关系

## 自我反思

### 第 1 轮：是否应该直接照官方文章接入 CLI 安装器

质疑：

- 这会把 XClaw 现有的离线 bundled plugin 架构直接绕开
- 让用户环境重新依赖 `openclaw`、`npm`、`npx`
- 二维码也只能落回终端

修正：

- 只使用官方真实插件包
- 不使用官方 CLI 安装器作为 XClaw 运行方案

结论：

- 继续走“插件镜像内置 + 主进程托管生命周期”才符合现有架构

### 第 2 轮：是否应该把微信硬塞进通用 `web.login.*`

质疑：

- OpenClaw 当前 `web.login.*` 是单 provider 模式
- 微信插件并未注册 `gatewayMethods`
- 如果强行让微信占用这两个方法，会和 WhatsApp 冲突

修正：

- 保持 WhatsApp 原链路不动
- 微信改成 QClaw 同模型的桌面端 `start / poll / cancel`

结论：

- 不能为了少写桥接层而污染现有通用 QR 登录入口

### 第 3 轮：是否应该把“24 小时保活”做成自动发消息

质疑：

- 没有足够事实证明这种行为稳定有效
- 高风险、强侵入、不可控
- 容易把桌面端助手变成偷偷操作真实账号的行为体

修正：

- 将 B 收敛为“健康守护”
- 只做提醒、诊断、重新扫码入口

结论：

- v1 不能碰无证据的自动保活

### 第 4 轮：是否应该继续沿用通用频道的账号 id 编辑模型

质疑：

- 微信账号 id 由扫码登录结果生成
- 如果允许手输，就会制造“保存成功但实际上不可用”的假配置
- rename 还会和插件状态目录脱节

修正：

- 新账号只能扫码创建
- 已有账号只显示真实 id
- 允许编辑显示名称，不允许改真实 id

结论：

- 微信必须做账号流特化，不能被通用表单模型绑架

### 第 5 轮：是否应该开放 `baseUrl` 可编辑

质疑：

- 当前源码证据显示运行态优先读状态文件中的 `baseUrl`
- 直接开放会制造“能填但不一定生效”的假能力

修正：

- v1 先只开放有真实闭环证据的字段

结论：

- 遵守 KISS 和真实证据，先不暴露 `baseUrl`

### 第 6 轮：是否应该通过改 Vite external 规则来绕过构建报错

质疑：

- `qrcode-terminal` 报错只是症状
- 如果只做 external 或 alias，很可能把真正的错误依赖继续留在主进程入口
- 后面一旦换构建器或调整入口，问题会再次出现

修正：

- 先追 import 链
- 确认根因是 `weixin-login` 引入了 `openclaw/plugin-sdk` barrel
- 从根因上切断依赖链

结论：

- 不做症状级 Vite 补丁，直接消除错误依赖

### 第 7 轮：是否应该 deep import OpenClaw 私有 dist chunk

质疑：

- `openclaw/dist/plugin-sdk/session-key-*.js` 带 hash，属于构建产物细节
- deep import 私有 chunk 会让 XClaw 对上游构建输出过度耦合

### 11. 微信插件源码依赖了当前 OpenClaw 未导出的 `plugin-sdk/gateway/protocol` 子路径

根因：

- `@tencent-weixin/openclaw-weixin@1.0.2` 的 `index.ts` 直接导入 `openclaw/plugin-sdk/gateway/protocol`
- 你当前随 XClaw 使用的 `openclaw@2026.3.13` 并没有把这个子路径暴露在 `exports` 里
- Gateway 实际解析时会落到 `dist/plugin-sdk/root-alias.cjs/gateway/protocol` 这种不存在的路径
- 结果不是“扫码失败后再重启”，而是插件从一开始就没加载成功，所以每次点击“生成二维码”都会先进入 `unknown method -> reload/restart` 兜底链

本轮处理：

- 不再把问题归因到前端按钮或页面状态
- 在插件安装修补阶段统一把微信插件里的错误 import 改成 `openclaw/plugin-sdk`
- 保留 bridge 修补，但把“可加载”放到比“有 method”更底层的优先级
- 用单测锁定“同版本已安装镜像、已有 bridge、但 import 路径坏掉”也必须被原地修好

### 12. QClaw 使用的是独立桌面桥接，二维码值实际是内容字符串而不是图片 Data URL

根因：

- 本机 `/Applications/QClaw.app` 解包后确认实际安装版本是 `0.1.15`
- 其渲染层 `WeixinLoginModal` 调用的是 `window.electronAPI.integration.weixinLoginStart / Poll / Cancel`
- 解包后的 `main/index.cjsc` 可见它直接请求 `https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode`
- 返回里的 `qrcode_img_content` 被映射成 `qrcodeUrl` 交给前端，再由前端用 `QRCode.toCanvas(...)` 现场绘制
- 官方微信插件虽然把这个字段命名成 `qrDataUrl`，但实际承载的仍是二维码内容字符串
- XClaw 之前把非 `data:image/*` 的值降级成占位图标，用户看到的不是可扫描二维码

本轮处理：

- 微信二维码改为按内容字符串绘制 canvas
- 仅对真正的 `data:image/*` 保留 `<img>` 分支
- 用单测锁定“微信二维码内容字符串必须调用 `QRCode.toCanvas`”

### 13. 新账号二维码轮询会不断生成新会话，导致二维码持续刷新

根因：

- 官方插件的 `startWeixinLoginWithQr()` 用 `accountId || randomUUID()` 作为登录会话键
- XClaw 之前对“新账号扫码”没有 `accountId`，初始 start 和后续轮询都传了 `undefined`
- 结果是每次轮询都会落到新的 `randomUUID()`，等于每 1.5 秒重新创建一个登录会话
- 用户看到的现象就是二维码一直变，几乎不可能稳定扫码

本轮处理：

- 新账号扫码时由 XClaw 主进程生成稳定的临时登录键 `xclaw-weixin-login-*`
- 初始 start 与后续轮询统一复用这一个键
- 登录成功后仍只保存插件返回的真实账号 id，不保存临时键
- 用单测锁定“新账号轮询必须复用同一个临时登录键”

### 第 8 轮：是否应该继续依赖 `unknown method` 之后的 reload/restart 兜底

质疑：

- 这本质上是在用运行时重启掩盖安装态损坏
- 用户点击“生成二维码”的预期是启动扫码会话，不是触发网关生命周期抖动
- 一旦插件从未正确加载，兜底每次都会命中，体验上等同于“按钮就是重启按钮”

修正：

- 将修复重心前移到插件安装与启动阶段
- 保证 Gateway 启动时就能正常加载微信插件
- `reload/restart` 只保留为异常兼容兜底，不再承担主路径职责

结论：

- 第一性原理上，扫码是业务动作，插件可加载性是运行前提，这两层不能混在同一次用户点击里解决
- 每次上游发版都可能直接失效

修正：

- 只提取当前已验证的 `normalizeAccountId` 语义
- 放入 XClaw 自己的 `shared` 层，并补测试锁定行为

结论：

- 不能把私有 dist chunk 当公共 API 使用

### 第 8 轮：是否应该顺手修掉同分支其他功能造成的 `typecheck` 错误

质疑：

- 错误位于 `src/stores/chat.ts` 与 `src/stores/chat/slash-commands.ts`
- 这些文件当前存在其他进行中的改动，不属于微信集成最小责任边界
- 顺手改动会增加合并冲突风险，也会把“微信问题”和“聊天功能问题”混在一起

修正：

- 记录为当前分支级阻塞，不篡改成微信功能缺陷
- 维持微信功能自己的 lint、build、定向测试全部可验证

结论：

- 不应为了追求表面全绿去侵入不相关的脏工作区

### 第 9 轮：是否应该只修磁盘插件补丁，不处理运行中的旧 Gateway

质疑：

- 这只能修“下一次启动”后的状态
- 用户在当前会话里点击扫码仍然会直接看到 `unknown method`
- 把“重启应用再试”留给用户，本质上是把架构缺陷外包给使用者

修正：

- 保留磁盘镜像自修补
- 同时在运行态入口补一层 Gateway 自动重启重试

结论：

- 必须同时修磁盘和运行态，缺一不可

### 第 10 轮：是否应该只改 Channels 页图标，不统一其他渠道入口

质疑：

- 频道视觉如果只改左栏，Agents、配置弹窗、Cron 仍会混着旧图标和 emoji
- 这种半改状态不满足“模仿 QClaw 的统一彩色识别”目标

修正：

- 抽公共 `ChannelIcon` 组件
- 在 Channels、Agents、配置弹窗和 Cron 一起切换

结论：

- 图标必须统一到组件级，不能页面级零散修补

### 第 11 轮：微信二维码入口是否应该在开始前主动重启 Gateway

质疑：

- 点击“生成二维码”立即重启 Gateway，会把正在运行的渠道状态整体打断
- 插件镜像已修补或仅仅 allowlist 变更时，主动重启属于过度动作
- 路由层和登录管理器双重重启会制造“二维码还没出来，网关先没了”的糟糕体验

修正：

- 删除 `/api/channels/weixin/start` 里的安装后主动重启
- `weixin-login` 不再因 `ensureChannelPluginEnabled()` 结果直接重启
- 改成仅在 `xclaw.weixin.login.start` 真正返回 `unknown method` 时，先尝试 `reload`，仍失败再单次 `restart`

结论：

- 微信登录入口必须按“懒修复”设计，不能按“预防性重启”设计

## 未决问题

### 1. 微信专用 gateway bridge 采用补丁还是本地 wrapper

当前推荐是“对 bundled 微信插件镜像做最小入口补丁”。如果后续上游更新频繁，可能需要升级为本地 wrapper。

### 2. 健康守护的提醒阈值

当前实现已收口为：

- 20 小时无入站 / 出站 / 最近连接活动时进入预警
- 24 小时后进入过期风险
- `lastError` 命中 `session expired`、`errcode -14`、`paused` 等语义时直接判定为高风险

### 3. 桌面提醒是否要支持全局设置页入口

v1 推荐只放在微信频道页内，避免扩大范围。后续如果多个渠道都需要类似守护，再抽成全局能力。
