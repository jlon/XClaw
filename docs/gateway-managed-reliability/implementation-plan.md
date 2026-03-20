# Gateway 托管增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 XClaw 在运行期间成为 Gateway 的状态驱动托管控制器，并把“无感自动恢复”作为最高优先级，支持手动停止记忆、外部实例收编与受控恢复。

**Architecture:** 保留现有 `GatewayManager` 作为低层执行器，但补上“恢复仲裁”控制面；在其外新增 `runtime-controller` 负责 `desiredState / managedMode / ownership / recovery` 决策。启动、setup 激活、route、IPC、settings side effect、provider/channel runtime sync 全部改为表达意图，由控制器统一判断是否附着、拉起、停止或恢复。

**Tech Stack:** Electron main process、TypeScript、electron-store、Vitest

---

### Task 1: 扩展 settings 模型并收口旧字段语义

**Files:**
- Modify: `electron/utils/store.ts`
- Modify: `electron/api/routes/settings.ts`
- Modify: `src/stores/settings.ts`
- Test: `tests/unit/stores.test.ts`
- Test: `tests/unit/settings-routes.test.ts`

- [x] **Step 1: 写失败测试，覆盖新的 settings 字段与迁移关系**

增加测试覆盖：
- `gatewayDesiredState`
- `gatewayManagedMode`
- `gatewayAutoStart -> gatewayDesiredState` 的迁移逻辑

- [x] **Step 2: 运行测试，确认当前失败**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/stores.test.ts tests/unit/settings-routes.test.ts
```

- [x] **Step 3: 在主进程 settings schema 中加入新字段并定义迁移**

修改：
- `electron/utils/store.ts`

要求：
- `gatewayDesiredState` 成为唯一运行时真值
- `gatewayAutoStart` 仅作为兼容字段保留

- [x] **Step 4: 在 host api / renderer store 中接通新字段**

修改：
- `electron/api/routes/settings.ts`
- `src/stores/settings.ts`

- [x] **Step 5: 重新运行测试确认通过**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/stores.test.ts tests/unit/settings-routes.test.ts
```

### Task 2: 新增 runtime controller 骨架

**Files:**
- Create: `electron/gateway/runtime-controller.ts`
- Test: `tests/unit/gateway-runtime-controller.test.ts`

- [x] **Step 1: 写失败测试，覆盖最小状态机**

覆盖：
- `bootstrap()` 在 `desiredState=running` 时调用托管入口
- `bootstrap()` 在 `desiredState=stopped` 时不自动拉起
- `requestStop()` 会持久化为 `stopped`
- `requestStart()` 会持久化为 `running`
- 用户未主动停止时，controller 会优先走自动恢复链路

- [x] **Step 2: 运行测试，确认失败**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts
```

- [x] **Step 3: 写最小实现骨架**

创建：
- `electron/gateway/runtime-controller.ts`

包含：
- settings 读取
- `bootstrap`
- `requestStart`
- `requestStop`
- `requestRestart`
- ownership 字段
- 恢复抑制字段

- [x] **Step 4: 再跑测试，确认最小行为通过**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts
```

### Task 3: 给 GatewayManager 增加恢复仲裁控制面

**Files:**
- Modify: `electron/gateway/manager.ts`
- Test: `tests/unit/gateway-manager-health.test.ts`
- Test: `tests/unit/gateway-runtime-controller.test.ts`

- [x] **Step 1: 写失败测试，覆盖“恢复前先仲裁”**

覆盖：
- `health fail / child exit / ws close / ping timeout` 不再无条件直接恢复
- controller 可阻止恢复

- [x] **Step 2: 运行测试，确认失败**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts tests/unit/gateway-runtime-controller.test.ts
```

- [x] **Step 3: 最小修改 GatewayManager**

要求：
- 保留现有低层恢复执行能力
- 上收“是否允许恢复”的决策
- 不重写 health / reconnect / restart governor

- [x] **Step 4: 重新运行测试**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts tests/unit/gateway-runtime-controller.test.ts
```

### Task 4: 收口启动入口与 setup 激活

**Files:**
- Modify: `electron/main/index.ts`
- Modify: `electron/main/setup-activation.ts`
- Modify: `electron/api/context.ts`
- Test: `tests/unit/app-routes.test.ts`
- Test: `tests/unit/setup-activation.test.ts`

- [x] **Step 1: 写失败测试，锁定 bootstrap 与 setup activation 入口语义**

要求：
- 启动不再直接 `gatewayManager.start()`
- setup 完成后不再直接按 `gatewayAutoStart` 启动

- [x] **Step 2: 运行失败测试**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts
```

- [x] **Step 3: 接入 runtime controller**

要求：
- `initialize()` 走 `runtimeController.bootstrap()`
- `setup-activation` 改为写入托管状态并交给 controller
- 不破坏 setup 只读门禁

- [x] **Step 4: 运行回归**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/setup-inspection.test.ts
```

### Task 5: 收口所有 Gateway 控制入口

**Files:**
- Modify: `electron/api/routes/gateway.ts`
- Modify: `electron/main/ipc-handlers.ts`
- Modify: `electron/api/routes/settings.ts`
- Modify: `electron/api/routes/channels.ts`
- Modify: `electron/api/routes/agents.ts`
- Modify: `electron/services/providers/provider-runtime-sync.ts`
- Test: `tests/unit/gateway-routes.test.ts`
- Test: `tests/unit/ipc-gateway-handlers.test.ts`
- Test: `tests/unit/ipc-settings-handlers.test.ts`
- Test: `tests/unit/provider-runtime-sync.test.ts`
- Test: `tests/unit/runtime-refresh-routes.test.ts`
- Test: `tests/unit/gateway-runtime-controller.test.ts`

- [x] **Step 1: 写失败测试，覆盖旁路入口**

覆盖：
- route start/stop/restart
- IPC start/stop/restart
- settings 触发的 runtime 重启
- provider/channel/agent 触发的 debounced restart/reload
- legacy `channel:*` IPC 的 refresh/restart

- [x] **Step 2: 运行失败测试**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-routes.test.ts tests/unit/ipc-gateway-handlers.test.ts tests/unit/ipc-settings-handlers.test.ts tests/unit/provider-runtime-sync.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/gateway-runtime-controller.test.ts
```

- [x] **Step 3: 把这些入口统一改走 controller**

要求：
- 手动停止优先
- `desiredState=stopped` 时禁止被旁路重新拉起

- [x] **Step 4: 跑回归**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-routes.test.ts tests/unit/ipc-gateway-handlers.test.ts tests/unit/ipc-settings-handlers.test.ts tests/unit/provider-runtime-sync.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/gateway-runtime-controller.test.ts
```

### Task 6: 实现外部实例收编与 token 对齐规则

**Files:**
- Modify: `electron/gateway/runtime-controller.ts`
- Modify: `electron/gateway/manager.ts`
- Modify: `electron/gateway/supervisor.ts`
- Test: `tests/unit/gateway-runtime-controller.test.ts`
- Test: `tests/unit/gateway-manager-health.test.ts`

- [x] **Step 1: 写失败测试，覆盖安全附着条件**

覆盖：
- token 一致时允许附着并进入 `adopted`
- token 不一致或不可确认时，不盲目附着
- 这类场景改走受控重启

- [x] **Step 2: 运行失败测试**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts tests/unit/gateway-manager-health.test.ts
```

- [ ] **Step 3: 最小实现收编逻辑**

要求：
- 优先复用现有探测与启动逻辑
- 不再假设“先附着再修 token”是安全路径
- `adopted` 强制恢复后转为 `managed`

当前进度：
- 已实现“现有 Gateway 附着失败后转 managed 启动”
- 尚未实现“附着前正向证明 token 一致”
- 尚未实现 ownership=`adopted` 的完整落盘与状态流

- [ ] **Step 4: 重新运行测试**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts tests/unit/gateway-manager-health.test.ts
```

### Task 7: 增加“手动停止后记住停止”与无感恢复回归

**Files:**
- Modify: `electron/gateway/runtime-controller.ts`
- Test: `tests/unit/gateway-runtime-controller.test.ts`

- [ ] **Step 1: 补失败测试**

覆盖：
- 手动停止后重开 app 不自动拉起
- 用户手动 start 可重新进入托管
- 常见运行期故障下自动恢复不要求手动再次点击启动
- 连续恢复失败后进入静默窗口
- 静默窗口期间不会进入明显 restart storm

- [ ] **Step 2: 运行失败测试**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts
```

- [ ] **Step 3: 补实现**

要求：
- `gatewayDesiredState=stopped` 时禁止自动恢复
- 用户手动 start 可越过恢复静默窗口
- “无感自动恢复”作为默认路径

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts
```

### Task 8: 统一验证与文档回写

**Files:**
- Modify: `docs/gateway-managed-reliability/testing.md`
- Modify: `docs/gateway-managed-reliability/issues.md`
- Modify: `docs/gateway-managed-reliability/progress.md`

- [ ] **Step 1: 跑本功能回归集**

Run:
```bash
node node_modules/vitest/vitest.mjs run tests/unit/gateway-runtime-controller.test.ts tests/unit/gateway-manager-health.test.ts tests/unit/gateway-manager-stop.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/stores.test.ts tests/unit/settings-routes.test.ts
```

- [ ] **Step 2: 跑 typecheck**

Run:
```bash
node node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 3: 更新 feature 文档**

要求：
- 回写已完成项
- 记录残余风险
- 明确 Windows 仍是发布红线

- [ ] **Step 4: 提交**

```bash
git add docs/gateway-managed-reliability electron/gateway electron/main electron/api electron/services src/stores tests/unit
git commit -m "feat: add gateway managed runtime control"
```
