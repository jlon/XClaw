# 开发进度

## 当前状态

当前阶段：开发完成，待发布验收

当前批次进展：`Task 1` 到 `Task 6` 的主链都已经打通。除了前面已完成的 settings 语义迁移、runtime controller、恢复仲裁、setup/startup 接入、route / IPC / settings / provider / channel / agent 收口之外，这一轮又补了两块生产兜底：`sanitizeOpenClawConfig()` 现在会按“当前 runtime 可解析的插件清单”清理陈旧 `plugins.allow / plugins.entries`，不再让 `skillhub` 这类历史残留直接卡死 Gateway 启动；`removeProviderFromOpenClaw()` 现在也会同步移除 `plugins.allow` 里的 `*-auth` 插件 id，避免 provider 删除后再次留下 `qwen-portal-auth` 这类 stale config。基于你本机真实 `~/.openclaw` 的 smoke / E2E 已经跑通：启动 XClaw 后，旧配置里的 `skillhub` 被自动收敛掉，Gateway 最终进入 `running`；随后手工 `kill -9` 当前 `openclaw-gateway` 进程后，controller 会进入自动恢复链，最终重新拉起新 pid 并恢复到 `health ok=true`。

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

## 下一步

1. 在 Windows 真机上补完启动、手动停止、自动恢复验收
2. 决定是否把 `before-quit` 这条退出边界也显式收口到 controller
3. 评估是否继续加固极端崩溃后的首次恢复时延

## 备注

- 本功能必须严格控制范围，不能顺手扩成系统级守护方案
- 托管增强必须复用现有 Gateway 低层逻辑，不做推倒重来
- macOS 与 Windows 仍是发布红线
