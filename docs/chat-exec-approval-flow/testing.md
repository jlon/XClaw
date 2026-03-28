# 聊天内本机执行审批流修复验证

## 自动化验证

已执行：

- `pnpm vitest run tests/unit/chat-target-routing.test.ts tests/unit/openclaw-exec-approval-patch.test.ts tests/unit/chat-runtime-event-actions.test.ts`
- `pnpm run typecheck`

结果：

- `vitest` 通过，`30 passed`
- `typecheck` 通过

## 本次新增覆盖点

### 单测

- `/approve` 成功后不再注入本地伪造 transcript 消息。
- 跨 session 审批会切换到真实 transcript session 再等待完成。
- OpenClaw patch 文件会校验所有目标 dist 文件的 follow-up hunk 与 internal-channel 抑制 hunk。
- injected final completion 事件在旧 run 仍活跃时也不会被错误丢弃。

## 尚未覆盖

- 真 Electron 窗口里的完整点击审批 smoke。
- 真 Gateway + 真命令执行链的全自动 e2e。
