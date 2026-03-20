# Gateway 托管增强设计

## 问题背景

当前 XClaw 已经具备 Gateway 启停、健康检查、自动重连、接管已有 OpenClaw 环境等基础能力，但这些能力仍然偏“技术性恢复”，还不是完整的“运行期间完全托管”。

目前的主要问题是：

- Gateway 的保活能力存在，但缺少统一的运行时主权模型
- 用户手动停止、自动恢复、接管外部实例这三套语义还没有完全收口
- `GatewayManager` 已经承担了大量底层职责，不适合继续叠加产品层状态语义
- 接管完成后，XClaw 需要对已有外部 OpenClaw Gateway 拥有明确控制权
- 当前大量 `start / stop / restart / reload` 入口分散在 route、IPC、settings side effect、provider/channel runtime sync 中

这条功能的最高优先级不是“能恢复一次”，而是：

- 用户尽量不需要手动干预
- 故障后优先自动恢复
- 恢复过程尽量无感
- 不进入明显的 restart storm

## 本轮设计结论

本功能的 v1 目标是：

- 仅在 XClaw 运行期间提供完全托管
- 不引入独立系统级 helper、watchdog、LaunchAgent 或 Windows Service
- 一旦进入托管模式，Gateway 的运行时主事实源以 XClaw 为准
- 接管完成后，原本由用户手动启动的外部 Gateway 可以被 XClaw 收编
- 用户手动停止 Gateway 后，XClaw 必须记住“期望状态=停止”，不能再自动拉起

这里对“99.99% 可用性”的口径做明确收敛：

- v1 把“无感自动恢复”定义为最高优先级
- v1 不把字面 `99.99%` 当成当前版本可对外承诺的 SLA
- 只有引入长期运行指标与系统级守护后，才有资格讨论严格可用性承诺

## 目标

- 在主进程内建立明确的 Gateway 托管控制层
- 将“无感自动恢复”作为本功能第一优先级
- 让 XClaw 在运行期间统一控制 Gateway 的：
  - 启动
  - 停止
  - 重启
  - 健康恢复
  - 外部实例收编
- 将用户手动停止/启动的意图持久化
- 在 setup / takeover 完成后，把 Gateway 切换到正式托管模式
- 支持 macOS 与 Windows 的一致语义

## 非目标

- 不在 v1 保证 XClaw 退出后 Gateway 仍被持续保活
- 不在 v1 实现独立系统级守护进程
- 不在 v1 实现持久化 crash ledger
- 不在 v1 实现 last-known-good runtime rollback
- 不在 v1 大改 renderer UI
- 不在 v1 重写 `GatewayManager`

## 产品决策

### 决策 1：v1 只做应用内完全托管

“完全托管”的边界限定为：

- 只要 XClaw 正在运行，XClaw 就负责确保 Gateway 处于用户期望状态
- XClaw 退出后，不承诺继续保活

补充：

- v1 的核心工程目标是“XClaw 运行期间的高概率无感自动恢复”
- 不承诺系统级、跨进程生命周期的严格高可用

### 决策 2：Gateway 运行时主事实源以 XClaw 为准

进入托管模式后，以下运行时控制由 XClaw 决定：

- gateway 端口
- gateway token
- 进程 ownership
- 自动恢复策略

必要时由 XClaw 将期望配置回写到 `~/.openclaw`

### 决策 3：手动停止优先级最高

用户手动点击“停止 Gateway”后：

- 必须立即停止当前 Gateway
- 必须写入持久化的期望状态
- 后续自动恢复、自愈、重连都必须让位

### 决策 4：接管后的外部实例允许被收编

如果当前连着的是用户之前手动启动的外部 Gateway，则在托管模式下：

- 允许先附着
- 允许在健康失败、token 漂移、端口漂移时直接终止并重启
- 一旦发生强制恢复，应转为 XClaw 管理的实例

## 方案选择

### 方案 A：继续把托管语义堆进 GatewayManager

优点：

- 改动文件少

缺点：

- `GatewayManager` 会同时承担进程管理、协议连接、产品状态控制
- 用户意图与底层重连逻辑耦合过深

结论：

不采用。

### 方案 B：新增状态驱动的应用内托管控制器

优点：

- 复用现有低层逻辑
- 能清晰表达用户期望状态、ownership 与恢复边界
- 更适合逐步增强

缺点：

- 需要把现有分散入口统一收口
- 需要给 `GatewayManager` 增加恢复仲裁接口

结论：

采用该方案。

## 运行时状态模型

### 持久化状态

新增主进程 settings 字段：

- `gatewayDesiredState: 'running' | 'stopped'`
- `gatewayManagedMode: 'managed' | 'unmanaged'`

说明：

- `gatewayDesiredState` 表示用户当前真正期望 Gateway 的状态
- `gatewayManagedMode` 表示当前是否已经进入 XClaw 托管模式

### 与现有 `gatewayAutoStart` 的关系

为避免状态冲突，v1 明确：

- `gatewayDesiredState` 是唯一运行时真值
- `gatewayManagedMode` 表示是否启用托管控制
- 现有 `gatewayAutoStart` 不再直接决定恢复与否

迁移规则：

- 对已 setup 完成的用户，首次进入新版本时：
  - 若 `gatewayAutoStart=true`，则初始化 `gatewayDesiredState=running`
  - 若 `gatewayAutoStart=false`，则初始化 `gatewayDesiredState=stopped`
- 迁移完成后，运行时判断只看：
  - `gatewayManagedMode`
  - `gatewayDesiredState`
- `gatewayAutoStart` 仅作为兼容字段保留，直到 renderer 设置项切换到新语义

### 内存状态

放在新的运行时控制器中：

- `ownership: 'managed' | 'adopted' | 'detached'`
- `recoveryInFlight: boolean`
- `lastHealthyAt?: number`
- `lastRecoveryReason?: string`
- `suppressAutoRecoverUntil?: number`

说明：

- `managed` 表示当前实例由 XClaw 自己拉起
- `adopted` 表示原本是外部实例，但已被 XClaw 收编
- `detached` 表示只附着观察，不参与控制

## 核心语义

### 期望状态优先级

优先级从高到低：

1. 用户手动停止
2. 用户手动启动
3. setup / takeover 完成后的初始化激活
4. 自动托管恢复
5. 被动重连 / ping health 自愈

### 恢复仲裁权

`runtime-controller` 不能只是旁路监听者，必须拥有是否恢复的仲裁权。

因此 v1 设计明确：

- 需要修改 `GatewayManager` 内部恢复入口
- `GatewayManager` 不再在所有失败场景下无条件自行 `scheduleReconnect()`
- `GatewayManager` 需要把恢复原因上抛给控制器，或至少在恢复前先调用控制器提供的判定函数

也就是说：

- 低层恢复执行仍复用 `GatewayManager`
- 但“是否允许恢复”必须上收给 `runtime-controller`

### 自动恢复前置条件

只有同时满足以下条件时，才允许自动恢复：

- `gatewayManagedMode=managed`
- `gatewayDesiredState=running`
- setup 已完成
- app 不处于退出中
- 当前没有恢复中的操作
- 没有命中恢复节流

### 不自动恢复的场景

以下场景禁止自动恢复：

- 用户手动停止后
- XClaw 正在退出
- setup 还未完成
- 当前处于 `unmanaged`
- 已进入恢复静默窗口

## 外部实例收编

### 收编时机

v1 仅支持两类收编时机：

- XClaw 启动时附着到已有外部 Gateway
- 托管过程中因失败恢复而强制收编

### token 对齐前置条件

v1 不接受“先盲目附着，再事后修 token”。

规则必须是：

- 如果现有实例的 token 与 XClaw 当前期望 token 一致，则允许附着并进入 `adopted`
- 如果 token 无法确认，或确认不一致，则不把该实例视为可安全附着
- 这种场景下直接走受控重启，按 XClaw 当前 token / port 拉起受控实例

### 收编后的恢复规则

进入 `adopted` 后：

- 健康失败时允许直接终止并重启
- token 漂移时以 XClaw 为准并重启
- 端口漂移时以 XClaw 为准并重启
- 一旦发生强制重启，应转为 `managed`

### ownership 边界

必须明确：

- `managed`
  - XClaw 自己拉起的实例
  - quit 时允许直接停止
- `adopted`
  - 外部实例已被 XClaw 收编
  - 手动 stop 时允许直接停止
  - 强制恢复后应转为 `managed`
- `detached`
  - 非托管观察态
  - quit 时只 detach，不主动停止

## 架构拆分

### 复用的现有模块

以下模块优先复用：

- `electron/gateway/manager.ts`
- `electron/gateway/connection-monitor.ts`
- `electron/gateway/startup-orchestrator.ts`
- `electron/gateway/supervisor.ts`
- `electron/gateway/restart-governor.ts`
- `electron/gateway/runtime-config.ts`

### 新增模块

新增：

- `electron/gateway/runtime-controller.ts`

职责：

- 维护期望状态
- 维护 ownership
- 提供 `bootstrap / ensureRunning / ensureStopped / restartManaged`
- 接收 `GatewayManager` 事件并决定是否恢复
- 统一给 `main / routes / setup-activation` 提供高层控制入口

### 最小接入点

至少必须调整以下入口：

- `electron/main/index.ts`
- `electron/main/setup-activation.ts`
- `electron/api/routes/gateway.ts`
- `electron/main/ipc-handlers.ts`
- `electron/api/routes/settings.ts`
- `electron/api/routes/channels.ts`
- `electron/services/providers/provider-runtime-sync.ts`
- `electron/utils/store.ts`

如果这些入口不一起纳入控制层，“手动停止优先”就会被旁路，设计不成立。

## 数据流

### 启动路径

1. 主进程读取 settings
2. `runtime-controller.bootstrap()` 判断是否处于托管模式
3. 若 `gatewayDesiredState=running`，则尝试附着或拉起 Gateway
4. 若 `gatewayDesiredState=stopped`，则不自动拉起

### 手动停止路径

1. 用户点击停止
2. route 或 IPC 调用 runtime controller
3. controller 写入 `gatewayDesiredState=stopped`
4. controller 调用底层 stop
5. 关闭自动恢复入口

### 自动恢复路径

1. 收到 `exit / close / health fail / drift`
2. controller 判断是否允许恢复
3. 若允许，执行附着修复或受控重启
4. 若连续失败过多，进入恢复暂停状态

### app quit 路径

必须明确区分：

- `gatewayManagedMode=managed`
  - quit 时允许停止当前由 XClaw 托管的实例
- `gatewayManagedMode=unmanaged`
  - quit 时只 detach，不主动关闭外部实例

## 错误处理

- 优先维持状态一致性，不追求每次都自动恢复成功
- 优先保证“无需用户手动介入”的恢复体验
- 自动恢复失败时应进入明确错误态，而不是无限重试
- 用户手动操作应始终允许打破自动恢复抑制
- 健康恢复失败时要区分：
  - 可重试
  - 已进入静默窗口
  - 用户主动停止

## 无感恢复目标

v1 以“无感自动恢复”作为最高优先级，但做如下收口：

- 目标是减少用户手动操作，不是承诺字面 SLA
- 优先覆盖最常见的运行期故障：
  - WebSocket 断开
  - 健康检查失败
  - 进程退出
  - token / port 漂移
- 用户只要没有主动停止，XClaw 就应优先尝试自动恢复
- 如果恢复已经明显失控，则应果断进入静默窗口，而不是假装高可用

## 平台要求

### macOS

- 需兼容现有 `launchctl` 卸载与孤儿进程清理逻辑
- 不能因为托管增强破坏当前附着/重启链路

### Windows

- 需兼容现有 `waitForPortFree` 与 orphan 清理逻辑
- 必须考虑慢 I/O、杀软干扰与端口释放延迟

## 完成标准

只有同时满足以下条件，v1 才算完成：

1. XClaw 运行期间，Gateway 完全受 XClaw 控制
2. 最常见运行期故障下，XClaw 能自动恢复且不需要用户手动介入
3. 用户手动停止后，不会再被自动恢复拉起
4. 用户手动启动后，可重新进入托管态
5. 已接管的外部实例可被收编并在失败时转为受控实例
6. 不会因错误恢复而进入明显 restart storm
7. macOS 与 Windows 都通过同等级验收

