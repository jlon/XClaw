# 问题与待确认项

## 当前已知问题

### skills / extensions 的漂移检测仍是目录名级别

当前 reconciler 会对 `skills/` 和 `extensions/` 目录名做排序后哈希，但还不会继续下钻文件内容。也就是说，如果用户在 XClaw 外部原地升级了某个 skill / extension，而目录名没有变化，当前 fingerprint 仍可能认为“环境未漂移”。

这不是设计概念问题，而是接管后一致性精度还不够。

### 双平台仍缺少真实手工验收

虽然当前设计、代码和单测都已经把 `macOS / Windows` 作为红线来实现，但这不等于真实发布通过。至少还需要验证：

- 端口被占用但不是 OpenClaw Gateway 时，takeover 是否稳定阻断
- Windows 路径规范化后，workspace 显示、context 合并与 reconciler 是否仍然一致
- setup 完成后的当前会话激活，在双端是否都能稳定拉起 gateway / CLI / context merge
- Windows 慢 I/O 或杀软干扰下，导入回滚与备份脱敏是否仍然稳定

当前决策：

- 由于当前没有 Windows 环境，这一项转为发布遗留项
- 不继续阻塞当前 feature 的开发收口
- 但它仍然阻塞“按双端完成发布”对外宣称

### 真实首次接管 E2E 已完成，但仍缺 Windows 对等验证

本轮已经直接在真实 `~/Library/Application Support/clawx` 上临时回退到 pending，完成了一次：

- `setup-inspection`
- `setup-plan`
- `takeover-import`
- `setup-activation`
- 重启后不再进入 setup

这说明“首次接管”主链路已经在真实本机环境中跑通，不再只是隔离样本或已接管状态 smoke。

当前剩余问题变成：

- Windows 上还没有做对等真机验证
- `provider-review-if-needed` 仍缺一份带真实冲突样本的手工案例

### 本机存在第三方插件 ABI 与重复插件告警

当前本机 `~/.openclaw/extensions` 中至少存在两类与接管功能本身无关、但会影响启动观感的环境噪音：

- `memos-local-openclaw-plugin` 的 `better-sqlite3` ABI 与当前 Node 版本不匹配
- `openclaw-lark` 存在重复插件 id / provenance 告警

这些问题不会阻断当前这条接管修复的核心结论，因为 Gateway 最终仍已进入 `running`；但它们会拖慢启动并污染日志，需要后续作为环境治理问题单独处理。

### 退出 app 曾经会错误关闭复用中的外部 Gateway

当前已经确认并修复一条具体行为偏差：

- 窗口关闭按钮本应只是隐藏到 tray，不会停 Gateway
- 但真正 `Quit XClaw` 时，主进程会进入 `before-quit -> gatewayManager.stop()`
- 旧实现里，如果当前连接的是“复用中的外部 Gateway”，`stop()` 也会发送 `shutdown` RPC，请求那个外部 Gateway 一起退出

这不符合“接管现有 OpenClaw 后，退出 XClaw 不该顺手把外部环境停掉”的直觉与产品预期。

本轮已修复为：

- 默认手动“停止 Gateway”仍保留原行为
- `before-quit` 改为只做 detach/cleanup，不再主动 shutdown 外部 Gateway

### setup 页不会正常二次弹出，但启动副作用会重复执行

当前 setup 触发条件已经明确：

- `settings.setupComplete === false` 时，renderer 会导航到 `/setup`
- setup 正常完成后，主进程 settings 会持久化 `setupComplete = true`
- 后续正常重启不会再次自动进入 setup 页

但这不等于“setup 的所有动作只跑一次”。当前启动期仍会重复执行 `runSetupActivationSideEffects()`，以及 Gateway 恢复后的 `ensureXClawContext()`。

这不是 setup 页二次触发 bug，但它意味着“初始化副作用”和“setup 页显示”是两套不同概念，后续如果要继续瘦身启动动作，需要从 side effects 本身收敛，而不是改 setup 路由判断。

### Gateway 健康检查已提升到 round-trip，但离“完全托管”还差一层

当前 Gateway 自愈并不是完全没有，但主要集中在：

- 子进程退出
- WebSocket 关闭
- ping / pong 超时

本轮已经补上两件关键事情：

- `checkHealth()` 优先走 `system.health` RPC，目标 Gateway 不支持时才降级回 WebSocket liveness
- 定时 health check 在连续 3 次失败后会主动标记 `error`、终止当前 socket 并触发 reconnect

但这仍然不等于“完全托管”或“99.99% 可用性”：

- Gateway 是否还能完成协议往返
- provider / channel / 会话层是否仍然可服务
- 进程在 Electron 主进程整体失活时是否还有外部 watchdog 兜底
- 连续 crash 后是否有持久化 crash ledger / last-known-good 运行时回退

这意味着：

- 当前可以说“已经有 round-trip + reconnect 级自愈”
- 但还不能诚实地对外宣称“99.99% 完全托管”

后续如果继续收口这一层，优先级应是：

- 明确复用外部 Gateway 时 `stop / restart` 的产品语义
- 再决定是否引入外部 watchdog 或 crash ledger，而不是直接堆复杂度

本轮还额外修掉了一条接近阻断级的风险：

- 如果连续 health 失败的是 XClaw 自己拉起的 Gateway，恢复流程现在会先终止该子进程，再进入 reconnect
- 不再允许“同一个已失活但仍占端口的自管进程”被误当成可复用 existing gateway 重新附着回来

### `setup-plan` 对外部 Gateway 的探测存在一次瞬时抖动记录

真实本机 E2E 中，首次调用 `POST /api/app/setup-plan` 曾出现过一次：

- `externalGatewayDetected=false`
- `canApply=false`

但紧接着重复调用后即稳定返回：

- `externalGatewayDetected=true`
- `canApply=true`

这更像探测时序上的瞬时抖动，而不是稳定逻辑错误。当前没有足够证据表明这是必现问题，因此这轮没有强行加复杂状态机；但需要保留记录，后续如果用户再次遇到，就应该优先排查 probe 时序，而不是继续拍脑袋改 plan 逻辑。

### `takeover-status` 在 import 完成后很快回到 idle，需要确认是否是产品预期

真实本机 E2E 中，`POST /api/app/takeover-import` 成功后，立即读取 `GET /api/app/takeover-status` 很快又看到 `idle`。

如果这个接口的产品语义是“只表示当前后台导入任务状态”，那它回到 `idle` 是合理的；但如果 UI 未来要依赖它做完成态回显，就可能不够稳定。

当前没有证据表明这已造成用户侧错误行为，因此先保留为观察项，不额外设计新状态。

### setup inspection 与 runtime 启动的外部 Gateway 判定曾经不一致，本轮已修正

之前 setup inspection 会把“纯 WebSocket 能打开”的任意监听都识别为外部 Gateway，而 runtime 启动真正复用实例时要求协议级 challenge 握手。

这个不一致会导致：

- setup 阶段提示“可以复用现有 Gateway”
- 运行时却无法真正复用，甚至把该监听进程识别成 orphan 再清理

本轮已经改成：

- setup inspection 与 runtime 启动统一使用 challenge-based probe

当前不再把这条列为剩余 bug，但保留记录，避免后续回归。

### takeover activation 乱序调用曾经可能提前退出只读模式，本轮已加前置守卫

之前 `takeover` 模式的 `/api/app/setup-activation` 没有要求 import 已经 commit 完成，理论上可以被乱序调用，直接写入 `setupComplete=true` 并放开启动副作用。

本轮已经改成：

- takeover activation 必须满足 `takeover-status=complete`，或至少已有 `takeoverFingerprint`

当前不再把这条列为剩余 bug，但保留记录，避免后续回归。

### 已补充隔离 `userData` 的开发态入口

仅改 `HOME` 不能隔离 Electron `userData`。为解决这点，本轮已新增 `CLAWX_USER_DATA_DIR` 开发态覆盖入口，用于：

- 在 macOS 上隔离 settings/provider store/logs
- 复现“首次接管”而不污染真实本机数据
- 为后续 Windows 对等验证预留同样入口

### 当前外部 Gateway 检测是只读探测，不做停止或接管

为满足“确认前只读”的硬约束，当前 inspection 中的外部 Gateway 判断只会做只读探测，不会调用会顺手清理进程的逻辑。

这是正确方向，但也意味着：

- 当前只能告诉用户“存在外部 Gateway”
- 还不能在这一阶段替用户安全地停止或接管它

真正的阻断 / 接管停止逻辑仍要放到后续 `setup-apply` / `takeover-import` 阶段。

### Node 侧全量 typecheck 仍是仓库存量阻塞

`node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit` 仍会被仓库旧文件打断，当前可见问题主要集中在：

- `electron/api/routes/channels.ts`
- `electron/api/routes/skills.ts`
- `electron/gateway/clawhub.ts`
- `electron/utils/device-identity.ts`

这会影响后续把 “Node 侧全量 typecheck 通过” 作为发布门槛。

## v1 已接受的取舍

- 将“安装目录”解释为默认 workspace 路径
- 只检测默认的本地 OpenClaw 根目录 `~/.openclaw`
- 不引入破坏性迁移逻辑
- 接管行为必须经过用户显式确认
- v1 目标已经明确为“全面接管”，因此必须包含 provider 导入、默认项恢复和 setup 状态落盘
- 对未知第三方 provider 可允许降级为只读或 `custom`，但不能让已知官方 provider 依赖手动重绑
- Linux 不作为这次功能的发布红线，macOS 与 Windows 才是验收阻断项
- takeover 备份文件允许保留结构化恢复信息，但敏感 token / apiKey / OAuth 凭据必须脱敏后再写盘

## 后续候选项

- 增加 XClaw ownership marker，用于未来更安全地区分 XClaw 管理配置
- 区分“完整复用现有配置”和“按项目导入部分配置”
- 在高级 setup 模式中加入代理、开机启动等选项
- 在最终应用前增加 setup 汇总确认页
- 将 skills / extensions 漂移检测提升到内容级别，而不只是目录名级别
