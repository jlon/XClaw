# 测试方案

## 范围

本方案覆盖 `Gateway 托管增强` 的以下能力：

- 托管模式持久化
- 期望状态持久化
- 手动停止 / 启动语义
- 外部实例收编
- 自动恢复、自愈与节流
- 无感自动恢复优先级
- macOS / Windows 双端一致性

## 单元测试

### Runtime controller

- `gatewayManagedMode=managed` 且 `gatewayDesiredState=running` 时，启动后会尝试托管
- `gatewayDesiredState=stopped` 时，启动后不会自动拉起
- 手动停止后会写入 `gatewayDesiredState=stopped`
- 手动启动后会写入 `gatewayDesiredState=running`
- 外部实例附着成功后会进入 `adopted`
- token 不一致或无法确认时，不会盲目附着，而是走受控重启
- `adopted` 实例健康失败时允许转为 `managed`
- 命中恢复静默窗口后，不会再自动恢复
- 用户手动点击启动时可越过静默窗口
- 用户未主动停止时，常见运行期故障应走自动恢复链路

### Settings / route / IPC

- `gatewayDesiredState` 能正确读写
- `gatewayManagedMode` 能正确读写
- `POST /api/gateway/start` 改为走 runtime controller
- `POST /api/gateway/stop` 改为走 runtime controller
- `POST /api/gateway/restart` 改为走 runtime controller
- `ipc gateway:start/stop/restart` 改为走 runtime controller
- settings / channel / provider 触发的 runtime 重启不会绕过托管控制层

### GatewayManager 回归

- 现有 `system.health` 优先策略继续成立
- 不支持 `system.health` 时可回退到 WebSocket liveness
- 连续 health 失败后仍会触发底层恢复链路
- 恢复失败时不会无限循环重启
- 退出 app 时仍不会在 `unmanaged` 场景主动关闭外部 Gateway

## 集成测试

- `managed + running`：XClaw 启动后自动进入托管态
- `managed + manual stop`：手动停止后不会自动恢复
- `managed + relaunch`：重启 XClaw 后仍保持 `stopped`
- `adopted + health fail`：外部实例被收编后，失败时可受控重启
- `drift recovery`：token / port 漂移后，XClaw 可按自身配置恢复
- `silent recover`：用户未主动停止时，故障恢复不要求手动点击启动
- `storm guard`：连续恢复失败后进入静默窗口，不进入明显 restart storm

## 手工测试

### macOS

1. 启动 XClaw，确认 Gateway 自动进入托管态
2. 点击“停止 Gateway”，确认不再被自动拉起
3. 关闭并重开 XClaw，确认仍保持停止
4. 再次点击“启动 Gateway”，确认重新进入托管态
5. 准备一个外部手动启动的 Gateway，确认 XClaw 能附着并收编
6. 准备 token 不一致的外部 Gateway，确认 XClaw 不会盲目附着
7. 模拟健康失败，确认 XClaw 能恢复
8. 验证恢复过程不需要手动再次点击启动

### Windows

1. 验证启动后自动托管
2. 验证手动停止后记住为停止
3. 验证重启 XClaw 后仍不自动拉起
4. 验证外部实例收编
5. 验证 token 不一致时走受控重启
6. 验证端口释放延迟下恢复仍稳定
7. 验证慢 I/O / 杀软干扰下不会进入 restart storm
8. 验证恢复过程尽量无感，不要求用户重新操作

## 回归检查

- setup / takeover 主链路不应被破坏
- 现有 `gatewayAutoStart` 迁移到 `gatewayDesiredState` 后语义一致
- 健康恢复不应和手动停止冲突
- channel / provider 触发的 debounced restart 不应绕过期望状态约束
- “无感自动恢复”优先级不得被后续低价值需求稀释
- macOS 与 Windows 任一端未通过时，功能不能视为可发布

## 需要执行的命令

至少执行：

```bash
pnpm test
pnpm run typecheck
```

针对本功能至少执行：

```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts
node node_modules/vitest/vitest.mjs run tests/unit/startup-orchestrator.test.ts
```

## 最近一次执行结果

- 已执行：

```bash
node node_modules/vitest/vitest.mjs run tests/unit/openclaw-auth.test.ts tests/unit/setup-activation.test.ts tests/unit/app-routes.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

- 结果：
  - `3` 个测试文件通过
  - `18` 个测试通过
  - `tsc --noEmit` 通过

- 本轮新增覆盖：
  - 启动前会移除当前 runtime 无法解析的 `plugins.allow / plugins.entries` 残留项
  - 通过 `plugins.load.paths` 注入的自定义插件不会被错误清理
  - provider 删除后会同步清理 `plugins.allow` 中对应的 `*-auth` 插件 id

- 本轮真实环境验证：

```bash
pnpm dev
curl -s http://127.0.0.1:3210/api/settings
curl -s http://127.0.0.1:3210/api/gateway/status
curl -s http://127.0.0.1:3210/api/gateway/health
kill -9 <gateway-pid>
curl -s http://127.0.0.1:3210/api/gateway/status
curl -s http://127.0.0.1:3210/api/gateway/health
```

- 真实环境结果：
  - 你本机现有 `~/.openclaw/openclaw.json` 里的 `plugins.allow.skillhub` 与 `plugins.entries.skillhub` 已被 XClaw 启动链自动清理
  - XClaw 在 `managed + desiredState=running` 下成功把 Gateway 拉到 `running`
  - `kill -9` 当前 `openclaw-gateway` 后，controller 进入自动恢复链，最终拉起新 pid 并恢复到 `health ok=true`
  - 恢复期间首个重启尝试曾遇到一次 `gateway already running ... lock timeout`，但后续自动重试成功，不需要用户手动点击启动
