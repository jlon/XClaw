# Chat Slash Router 测试记录

## 目标

验证 slash command router 在 XClaw 中满足三件事：

1. 本地命令不会再误发到 `chat.send`
2. 页面副作用命令会真实触发桌面动作
3. 输入框 slash menu 与固定参数命令交互符合 QClaw 语义
4. Win/mac 共用的聊天壳层行为没有被破坏

## 已执行

### 单元测试

```bash
pnpm exec vitest run tests/unit/chat-target-routing.test.ts tests/unit/chat-layout.test.tsx tests/unit/chat-slash-actions.test.tsx --reporter=dot
```

结果：通过，`36 passed`

```bash
pnpm exec vitest run tests/unit/chat-target-routing.test.ts tests/unit/chat-slash-actions.test.tsx tests/unit/chat-input.test.tsx tests/unit/chat-runtime-send-actions.test.ts tests/unit/chat-render-stability.test.tsx tests/unit/chat-layout.test.tsx tests/unit/chat-message.test.tsx --reporter=dot
```

结果：通过，`63 passed`

覆盖点：

- `/approve`
- `/new`
- `/reset`
- `/clear`
- `/help`
- `/model`
- `/think`
- `/verbose`
- `/fast`
- `/compact`
- `/agents`
- `/kill`
- `/stop`
- `/focus`
- `/export`
- `/usage`
- `/status`
- busy 状态下的本地 slash 入队与 run 结束自动出队
- 主 store 后台会话标题清洗 `[WhatsApp ...]` 前缀
- 输入框 slash menu 打开、过滤、参数二级菜单与直接执行
- 输入框 slash menu 图标与 `instant / N options` 徽标

### 代码质量

```bash
pnpm exec eslint src/stores/chat.ts src/stores/chat/runtime-send-actions.ts src/stores/chat/local-command-router.ts src/stores/chat/slash-commands.ts src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx tests/unit/chat-target-routing.test.ts tests/unit/chat-slash-actions.test.tsx tests/unit/chat-input.test.tsx tests/unit/chat-runtime-send-actions.test.ts tests/e2e/chat.spec.ts --max-warnings=0
```

结果：通过

### 类型检查

```bash
pnpm run typecheck
```

结果：通过

### 端到端

```bash
pnpm run test:e2e
```

结果：通过，`8 passed`

```bash
pnpm run test:e2e
```

结果：通过，`9 passed`

用于回归确认这次 renderer/store 改动没有把现有桌面主路径打坏，并补上 Win32 下 slash menu 与 `/usage` 的真实链路，以及会话标题清洗与 Agents 页容错。

## 重点断言

- `/status` 仍然走 `chat.send`
- `/new` / `/reset` 复用统一网关发送链，不再本地伪造会话
- `/focus` 会切换 `chatFocusMode`
- `/usage` 会以内联助手消息显示当前会话 usage
- `/export` 会调用 `/api/files/save-text`
- `runtime-send-actions` 旧分支也会复用同一套本地命令执行器
- busy 时只有 `stop / focus / export` 不入队
- 输入 `/` 会打开菜单，输入 `/th` 会收敛到 `/think`，再进入参数菜单
- 聊天聚焦模式下左侧会话面板不再渲染
