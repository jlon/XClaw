# 问题与待确认项

## 当前已知问题

### `99.99%` 目前只能作为方向，不能当 v1 承诺值

这条功能的核心是“无感自动恢复”，不是在当前架构下直接宣称字面 `99.99%` 可用性。

原因很直接：

- v1 只做应用内托管
- 没有独立系统级 watchdog
- 没有长期运行指标采集
- 没有严格的可用性度量闭环

所以：

- 可以把“无感自动恢复”作为第一优先级
- 不能把 `99.99%` 当作当前版本的可验证承诺

### macOS 主链已跑通，但 Windows 仍未验收

当前已在你本机真实 `~/.openclaw` 上确认：

- 启动时能自动收敛陈旧插件配置并把 Gateway 拉起
- `kill -9` 当前 Gateway 进程后能自动恢复到 `running + health ok`

但 Windows 真机还没跑，因此不能把“双端可发布”当成已完成。

### Windows 仍是发布红线

本功能同样必须满足：

- macOS 可用
- Windows 可用

当前没有 Windows 环境，因此未来实现完成后仍需登记发布遗留项并补验收。

## 未决问题

### 手动 restart 是否视为用户显式“恢复运行”

当前方向下，`restart` 更接近：

- 如果用户当前期望是 `running`，则执行受控重启
- 如果用户当前期望是 `stopped`，则不应偷偷恢复为运行

实现前需要把 route / IPC 行为再收一次。

### `before-quit` 退出收口仍绕过 controller

当前 `before-quit` 仍直接调用 `gatewayManager.stop({ shutdownExternal: false })`，没有完全走 controller。

这条边界原先已确认存在，当前批次已补成受控 handoff，不再继续保持 open issue 状态。

本轮收口后：

- `before-quit` 会显式拦截退出，等待 Gateway quit handoff 至少被调度完成或超时后再退出
- quit 时会落 `gateway-handoff.json`，供下一次启动优先等待并接管 handoff 中的 runtime
- 启动重试时，如果“现有 Gateway”其实就是自己先前拉起的 managed child，不再丢掉 `pid/ownership`

这条风险已从“功能缺口”降为“已收口，待双端验收”。

## 本轮已收口

### 通用 settings 对外边界已收紧

当前 `/api/settings`、统一 `app:request(settings.*)`、legacy `settings:getAll / settings:get / settings:set / settings:setMany` 都已经改成只暴露 renderer 允许读写的字段。

本轮收口后：

- `gatewayToken` 不再混进通用 settings DTO
- renderer 初始化不会再把内部字段整包写进持久化状态
- `gatewayToken` 改为只走 `gateway:getControlUiUrl` 这条专门通道

这条风险不再是当前阻断项，但后续仍需防止回退。

### `refresh / stop` 并发重入已加二次栅栏

当前 `GatewayManager` 已经在 `debouncedRestart / debouncedReload / restart / reload / replaceRuntime` 这条链上补了 stop generation 栅栏。

本轮收口后：

- 已排队但尚未执行的 refresh 不会在 stop 之后偷跑
- 已经进入 teardown 的 restart，如果中途收到 stop，也不会再继续 `start()`
- 观测日志会明确标记为 `aborted_by_stop`，不再误报成已应用刷新

这条风险当前已从 open issue 降为已收口项。

### 极端崩溃后的首次恢复仍可能出现一次瞬时锁竞争

本轮真实 E2E 中，手工 `kill -9` 运行中的 `openclaw-gateway` 后，controller 会立即进入自动恢复链；但第一次自动重启曾出现一次：

- `Gateway failed to start: gateway already running (pid=旧 pid); lock timeout after 5000ms`

随后无需人工干预，后续自动重试成功，Gateway 仍恢复到了 `running + health ok`。

这说明：

- 托管主链已经成立
- 但极端崩溃后的首次恢复时延还有继续压缩空间

当前将它登记为“加固项”，不是主链阻断项。

### 本机历史残留 Gateway 与 ABI 异常仍会污染 quit/relaunch 现场

当前你本机真实环境里还有两类噪音，会让手工 smoke 的观感比代码真实状态更差：

- 历史残留的旧 `openclaw-gateway` 进程偶尔会占住 `18789`，导致新一轮 `pnpm dev` 首次启动先撞一次 `gateway already running`
- `memos-local-openclaw-plugin` 的 `better-sqlite3` ABI 不匹配会显著拖慢 Gateway 启动，进而拉长 handoff 后重新接管的等待时间

这两条都不是本轮 quit handoff 逻辑直接引入的问题，但它们会放大“重开 app 时要等多久”的现场噪音。

### `setup-activation` 的 direct-start fallback 已移除

此前 `runSetupActivationSideEffects()` 还保留了“未提供 controller 时直接 `gatewayManager.start()`”的 fallback。

当前这条旁路已经移除：

- 真实调用点必须传入 controller
- setup activation 只再表达托管意图，不再直接拉起 Gateway

### renderer 最小状态展示做到哪一层

v1 不计划大改 UI，但至少要让用户看到：

- 当前是否处于托管模式
- 当前期望状态
- 最近一次恢复原因
- 是否处于自动恢复暂停

这部分展示深度还需要在实现前再压一次范围。

## v1 已接受的取舍

- 只做应用内托管，不做系统级守护进程
- 不实现 XClaw 退出后的持续保活
- 不做持久化 crash ledger
- 不做 last-known-good runtime rollback
- 不重写 GatewayManager，只在外面增加状态驱动控制层
- 将“无感自动恢复”作为核心目标，但不把字面 `99.99%` 作为当前版本承诺

## 后续候选项

- 引入 crash ledger
- 引入 last-known-good runtime rollback
- 引入独立 helper / watchdog
- 将托管状态在 UI 中可视化得更完整
- 收紧极端崩溃后的首次恢复时延
