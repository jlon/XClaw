# 开发进度

## 当前状态

当前阶段：开发完成，待发布验收

当前批次进展：`Task 1` 到 `Task 6` 的主链都已经打通。除了前面已完成的 settings 语义迁移、runtime controller、恢复仲裁、setup/startup 接入、route / IPC / settings / provider / channel / agent 收口之外，这一轮又补了两块直接影响“退出后不误重启 OpenClaw”的兜底：一是 `before-quit` 不再 fire-and-forget 地丢出异步 handoff，而是显式拦住退出，等 `GatewayManager.handoffForQuit()` 至少完成 handoff 调度或超时后再 `app.exit(0)`；二是启动重试时，如果探测到的“现有 Gateway”其实就是自己刚拉起但握手抖动过一次的子进程，现在会保住 `pid/ownership`，不再错误降级成 external attach，导致后续 quit 看不到 `pid` 只能退化成 `detach(reason=quit)`。此外，startup attach 也补了 `gateway-handoff.json` 标记与最小接管窗口：如果 XClaw 在 quit handoff 进行中被重新打开，会优先等待 pending handoff，并在监听者已出现时把它作为 handoff 候选接回，而不是立刻再次拉起一个新 Gateway。基于你本机真实 `~/.openclaw` 的 smoke 验证，日志已经能稳定看到 `Scheduling detached Gateway handoff` 与 `Waiting for pending Gateway handoff` 两个关键事实，证明退出交接和启动等待都已接上线；当前剩余的主要噪音来自你本机长期残留的旧 gateway 实例与 `memos-local-openclaw-plugin` 的 `better-sqlite3` ABI 异常，它们会显著拉长启动时间并污染个别手工场景。

## 里程碑

- [x] 明确 v1 只做应用内完全托管
- [x] 明确接管后允许收编外部实例
- [x] 明确 Gateway 运行时主事实源以 XClaw 为准
- [x] 明确手动停止后记住为停止
- [x] 明确优先复用现有 `GatewayManager / supervisor / orchestrator / health` 链路
- [x] 明确“无感自动恢复”是 v1 最高优先级
- [x] 完成第一轮架构设计
- [x] 吸收设计审查中的阻断项
- [x] 写出修正版实现计划
- [x] 完成 Task 1：settings 语义迁移与兼容同步
- [x] 完成 Task 2 第一阶段：runtime controller 骨架
- [x] 完成 Task 3 第一阶段：自动 reconnect 前恢复仲裁
- [x] 完成 Task 4 第一阶段：setup activation / startup 接入 controller
- [x] 完成 Task 5 第一阶段：settings / provider / channel / agent / legacy IPC 入口收口
- [x] 完成 Task 6 第一阶段：现有实例附着失败后转受控替换
- [x] 打通托管主链上的 Gateway 控制入口
- [x] 完成 macOS 真实环境托管 E2E
- [x] 补齐托管主链测试
- [ ] 完成 macOS / Windows 验收
- [x] 收紧 settings 对外 DTO 与 renderer 持久化边界
- [x] 收口 `refresh / stop` 并发重入竞态
- [x] 收口 `before-quit` 退出路径到受控 handoff

## 下一步

1. 在 Windows 真机上补完启动、手动停止、自动恢复、quit handoff 验收
2. 继续压缩“handoff 中途重开 app”时的最坏等待时长

## 备注

- 本功能必须严格控制范围，不能顺手扩成系统级守护方案
- 托管增强必须复用现有 Gateway 低层逻辑，不做推倒重来
- macOS 与 Windows 仍是发布红线
