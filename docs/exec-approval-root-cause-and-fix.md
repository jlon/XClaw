# exec approvals 无法成功授权的问题排查与解决方案

## 结论

当前 XClaw / OpenClaw 桌面 UI 里的 exec approval 主链路，**主根因已定位并已着手修复：Gateway operator 连接缺少 `operator.approvals` scope**。

这会导致桌面 UI 虽然能看到 `exec.approval.requested`，但在点击 **Allow once / Allow always / Deny** 或走本地 `/approve` 时，底层 `exec.approval.resolve` 调用没有满足协议要求的作用域。

此外，排查中还发现一个**次级 bug**：`api-client` 的 Gateway WS 握手失败响应没有被正确消费，服务端即使返回 `FORBIDDEN`，前端仍可能表现成 `Gateway WS connect timeout`。这会把真正的权限错误掩盖掉。

## 现象

用户侧现象：

- `/approve <id> allow-once` 看起来已提交，但模型仍持续要求审批
- 桌面 UI 中点击授权也不生效
- 偶发出现：
  - `unknown or expired approval id`
  - 继续要求新的 approval id
  - 授权后没有任何执行恢复迹象

## 第一性原理拆解

### 1. 审批真正需要什么
根据 OpenClaw gateway protocol：

- 当 exec 需要审批时，Gateway 广播 `exec.approval.requested`
- operator client 需要调用 `exec.approval.resolve`
- **`exec.approval.resolve` 需要 `operator.approvals` scope**

来源：
- `openclaw/docs/gateway/protocol.md`
- `openclaw/docs/zh-CN/gateway/protocol.md`
- CHANGELOG 中也有专门说明：
  - `require operator.approvals for in-chat /approve when invoked from gateway clients`

### 2. 桌面 UI 实际走哪条链路
桌面 UI 审批按钮不是直接本地改状态，而是：

1. `src/stores/chat/exec-approval-submit.ts`
2. `src/stores/gateway.ts -> rpc()`
3. `invokeIpc('gateway:rpc', ...)`
4. `electron/main/ipc-handlers.ts`
5. `gatewayManager.rpc(...)`
6. `electron/gateway/ws-client.ts` 连接 Gateway 并发送 operator connect frame

### 3. 当前实现的实际 scope
在以下三个位置，operator connect 原先都只带了：

```ts
scopes: ['operator.admin']
```

位置：

- `electron/gateway/ws-client.ts`
- `src/lib/api-client.ts`
- `src/lib/gateway-client.ts`

这意味着：

- UI 能作为 operator 连上 Gateway
- 但**不代表它自动拥有 approvals scope**
- 如果协议对 `exec.approval.resolve` 单独要求 `operator.approvals`，那么当前身份就不够

## 已完成复现

### 稳定单侧复现
新增测试：

- `tests/unit/gateway-ws-client.test.ts`

复现方式：

- 调用 `buildGatewayConnectFrame()`
- 断言 connect frame 当前只包含 `operator.admin`
- 再断言它应该包含 `operator.approvals`

结果：

- 修复前：现状测试通过，协议预期测试失败
- 失败信息：

```txt
AssertionError: expected [ 'operator.admin' ] to include 'operator.approvals'
```

这说明当时的实现与审批协议要求不一致。

## 已实施的修复

已将以下三处 operator 连接 scope 补齐为：

```ts
['operator.admin', 'operator.approvals']
```

修改位置：

1. `electron/gateway/ws-client.ts`
2. `src/lib/api-client.ts`
3. `src/lib/gateway-client.ts`

并已将 `tests/unit/gateway-ws-client.test.ts` 更新为通过态回归测试。

## 新发现的次级 bug

在补齐 scope 之后，`tests/unit/api-client.test.ts` 里与 Gateway WS 握手失败相关的测试暴露出另一个问题：

- 我模拟 Gateway 在 connect 阶段返回：
  - `FORBIDDEN: missing required scope operator.approvals`
- 但前端最终收到的不是这个明确错误
- 而是：

```txt
Gateway WS connect timeout
```

这说明：

- WS 握手失败响应没有被正确消费/透传
- 真实的权限错误可能被 timeout 掩盖

### 影响

这会让用户看到的现象更像：

- 点了没反应
- 像超时
- 像 approval id 失效

而不是直接看到：

- 权限不够 / scope 缺失

## 为什么这能解释“桌面 UI 也授权不了”

因为桌面 UI 点授权时，最终还是通过 Gateway operator connection 去调用：

```ts
exec.approval.resolve
```

如果这条连接没有 `operator.approvals`：

- 它在协议层就可能被拒绝
- 即使 UI 层看起来“点击成功”，底层也可能没有真正 resolve 掉 pending approval
- 上层如果没有把错误清晰透出，就会表现成：
  - 授权没反应
  - 模型仍持续要求审批
  - 旧 id 过期后又生成新 id

## 次级问题

除主 bug 外，还有两个次级问题会放大混乱：

### A. 错误透传不清晰

当前多层包装：

- renderer store
- api-client
- IPC handler
- gatewayManager
- ws client

任何一层如果把 FORBIDDEN / scope error 改写成 timeout / generic error，都会让现象更像“UI 没反应”。

### B. approval id 生命周期较短

前端队列中有：

- `createdAtMs`
- `expiresAtMs`
- prune 逻辑

所以一旦授权没真正生效，用户再次尝试时就可能撞上：

- `unknown or expired approval id`

这不是第一根因，但会显著放大体验问题。

## 最小修复建议

### 修复 1：给 operator client 补齐 approvals scope

至少以下三处应统一评估并补齐：

1. `electron/gateway/ws-client.ts`
2. `src/lib/api-client.ts`
3. `src/lib/gateway-client.ts`

建议改为：

```ts
scopes: ['operator.admin', 'operator.approvals']
```

如果协议设计要求更细，也可以抽成集中常量，避免三处漂移。

### 修复 2：集中 operator scopes 定义

建议新增统一常量，例如：

```ts
export const OPERATOR_SCOPES = ['operator.admin', 'operator.approvals'] as const;
```

避免：

- 主进程一套
- renderer 一套
- gateway-client 一套

长期再次漂移。

### 修复 3：修正 WS 握手失败响应透传

当前还需要继续排查 `api-client.ts` 中 Gateway WS connect 阶段的失败响应消费逻辑，目标是：

- 服务端返回 `FORBIDDEN`
- 前端也应收到明确的 `FORBIDDEN`
- 不应被吞成 `Gateway WS connect timeout`

建议排查点：

- `createGatewayWsTransportInvoker()`
- `connectRequestId` 与 response id 匹配
- connect handshake 的 pending promise resolve/reject 时机
- `message` 事件中 connect response 的消费顺序

### 修复 4：改善授权失败时的错误透出

当 `exec.approval.resolve` 因 scope 不足失败时，建议前端直接显示类似：

```txt
Approval submission failed: missing operator.approvals scope
```

而不是模糊的 timeout / gateway failed。

## 回归测试建议

### 必加测试

1. `buildGatewayConnectFrame()` 包含 `operator.approvals`
2. `api-client.ts` 的 WS connect frame 包含 `operator.approvals`
3. `src/lib/gateway-client.ts` 的 connect frame 包含 `operator.approvals`
4. `/approve` 提交失败时，错误文案应透出真实原因
5. connect 阶段的 `FORBIDDEN` 响应应被正确透传，而不是超时

### 行为测试

补一个更完整的集成测试：

- 模拟 `exec.approval.requested`
- UI 调用 `exec.approval.resolve`
- Gateway 返回成功
- 断言：
  - pending approval 被移除
  - chat.inject 正常
  - 不再重复要求旧 approval id

## 建议修改顺序

1. 先统一修 `scopes`（已完成）
2. 跑单测确认 connect frame 正确（已完成）
3. 再修 WS 握手失败错误透传
4. 最后补一个审批成功的集成回归测试

## 当前状态

- 已定位到主根因
- 已完成单侧稳定复现
- 已实施主修复（补 `operator.approvals`）
- 仍有一个次级 bug 待修：WS 握手失败响应被 timeout 掩盖

## 相关文件

- `electron/gateway/ws-client.ts`
- `electron/gateway/manager.ts`
- `electron/main/ipc-handlers.ts`
- `src/stores/chat/exec-approval-submit.ts`
- `src/stores/gateway.ts`
- `src/lib/api-client.ts`
- `src/lib/gateway-client.ts`
- `tests/unit/gateway-ws-client.test.ts`
- `tests/unit/api-client.test.ts`
