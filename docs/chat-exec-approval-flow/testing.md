# 聊天内本机执行审批流修复验证

## 自动化验证

已执行：

- `pnpm exec vitest run tests/unit/chat-target-routing.test.ts tests/unit/chat-render-stability.test.tsx --reporter=dot`
- `pnpm exec eslint src/stores/chat/exec-approval-submit.ts src/stores/chat/local-command-router.ts src/pages/Chat/index.tsx src/pages/Chat/ExecApprovalOverlay.tsx tests/unit/chat-target-routing.test.ts tests/unit/chat-render-stability.test.tsx --max-warnings=0`
- `pnpm run typecheck`

结果：

- `vitest` 通过，`33 passed`
- `eslint` 通过
- `typecheck` 通过

## 本次新增覆盖点

### 单测

- `/approve` 不仅要调 `exec.approval.resolve`，还要调 `chat.inject`
- stale slug fallback 时也要把同步消息写入 transcript
- 聊天页在当前 session 存在 pending approval 时，必须渲染桌面审批层

## 尚未覆盖

- 真实 Electron 窗口里的审批层点击 smoke
- 真 gateway + 真模型 + 真 async exec followup 的端到端人工复现
