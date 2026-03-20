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

### 通用 settings 对外 DTO 当前仍暴露过多内部字段

当前 `/api/settings` 直接返回整份 settings，renderer `init()` 又会把返回结果整包写进 zustand 持久化层。

这会带来一个明确边界风险：

- `gatewayToken` 这类仅应留在主进程的字段，当前可能被带进 renderer / localStorage

这个问题真实存在，但不应混进本功能的托管主链里顺手扩大范围。当前处理原则是：

- 先登记为独立问题
- 后续单独收 `settings 内部 schema` 与 `renderer 安全 DTO` 的边界

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

### `before-quit` 仍直接对 GatewayManager 做退出清理

当前 `before-quit` 仍直接调用 `gatewayManager.stop({ shutdownExternal: false })`。

这条路径不会把外部 Gateway 一起关掉，语义上已经比之前安全，但仍有一个待确认边界：

- 退出语义是否继续允许绕过 controller
- 还是也应该显式经由 controller 做一次 `quitting` 态收口

这不是当前最高风险旁路，但在“所有控制入口统一”完成前不能当成已完全闭环。

### 极端崩溃后的首次恢复仍可能出现一次瞬时锁竞争

本轮真实 E2E 中，手工 `kill -9` 运行中的 `openclaw-gateway` 后，controller 会立即进入自动恢复链；但第一次自动重启曾出现一次：

- `Gateway failed to start: gateway already running (pid=旧 pid); lock timeout after 5000ms`

随后无需人工干预，后续自动重试成功，Gateway 仍恢复到了 `running + health ok`。

这说明：

- 托管主链已经成立
- 但极端崩溃后的首次恢复时延还有继续压缩空间

当前将它登记为“加固项”，不是主链阻断项。

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
