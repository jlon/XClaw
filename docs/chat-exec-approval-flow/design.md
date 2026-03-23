# 聊天内本机执行审批流修复设计

## 问题定义

现有 XClaw 在聊天里处理 `exec approval` 时存在两类错位：

1. 只验证了 `/approve` 有没有触发 `exec.approval.resolve`，没有保证审批结果同步回 transcript。
2. 桌面聊天页没有像 QClaw 一样提供原生审批入口，用户被迫手打 slash command，随后再发一句“好了吗”时，模型容易把它当成新一轮请求再跑一次。

## 根因证据

基于 `~/.openclaw/agents/main/sessions/65e60ded-ca15-47c3-8540-914ce6822c55.jsonl` 的实际 transcript：

- `approval-pending` 的 `toolResult` 已经落盘。
- `/approve` 成功回执也已经落盘，格式为 `✅ Exec approval allow-once submitted for ...`。
- 但批准之后没有出现 `Exec finished ...` 这类续跑结果。
- 用户继续发送自然语言后，模型重新发起了新的 `exec`，生成了新的 approval id。

说明旧逻辑的问题不只是“slash 没拦截”，而是“审批成功后的上下文和桌面交互没有闭环”。

## 目标

1. 聊天页对齐 QClaw 的桌面审批逻辑，收到 pending approval 后直接在 UI 中批准/拒绝。
2. `/approve` 仍可作为兼容路径，但成功后必须同步 transcript，不能只留本地 UI 假消息。
3. 减少用户用自然语言再次触发同一命令重跑的概率。

## 方案

### 1. 抽共享审批提交器

新增 `src/stores/chat/exec-approval-submit.ts`：

- 统一解析当前 session 的 pending approval。
- 统一调用 `exec.approval.resolve`。
- 成功后统一移除本地 `execApprovalQueue` 项。
- 成功后统一调用 `chat.inject`，把审批结果写回 transcript。

### 2. 保留 slash 兼容，但不再靠 reload history 伪同步

`src/stores/chat/local-command-router.ts`：

- `/approve` 继续支持。
- 成功后仍给当前聊天一个本地回执，避免用户无反馈。
- 去掉审批成功后立刻 `loadHistory()` 的副作用，避免消息闪烁或被空 history 覆盖。

### 3. 聊天页补原生审批层

新增 `src/pages/Chat/ExecApprovalOverlay.tsx`，在 `src/pages/Chat/index.tsx` 接入：

- 监听 `useGatewayStore().execApprovalQueue`。
- 优先显示当前 session 的 pending approval，没有则回退到全局第一条。
- 提供 `仅这次允许 / 长期允许 / 拒绝` 三个动作。
- 动作直接走共享审批提交器，不再要求用户手打 slash。

## 非目标

- 这次不改 OpenClaw gateway 侧的 async exec followup 机制。
- 这次不承诺已经覆盖真实 macOS / Windows 原生窗口的最终人工验收。
