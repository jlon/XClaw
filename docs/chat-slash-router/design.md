# Chat Slash Router 设计

## 目标

把 QClaw 的聊天 slash command router 语义正式接到 XClaw 的 React 聊天链路里，避免系统级命令继续落进普通 `chat.send`，也避免 `/approve` 之外的命令继续被当作自然语言发给模型。

## 设计边界

本次处理聊天工作台里的 slash command 路由、输入框命令菜单、页面副作用与旧发送分支收口，不扩展新的业务入口，也不修改 OpenClaw Gateway 的协议。

## 命令分层

### 1. 会话命令

- `/new`
- `/reset`
- `/clear`
- `/stop`
- `/compact`

这类命令不再落成自然语言聊天。

- `/new` / `/reset`：按 QClaw 高层 dispatch 语义，仍由 renderer 拦截，但会复用统一网关发送链，把字面命令 `"/new"` / `"/reset"` 发给 Gateway，而不是在本地伪造会话切换。
- `/clear`：保持本地清空语义，通过 `sessions.reset` 清空当前线程，并同步清理 renderer 里的消息与标签状态。
- `/stop`：通过 `chat.abort` 中止当前运行，兼容 `stop / esc / abort / wait / exit` 这些 QClaw 同源别名。
- `/compact`：通过 `sessions.compact` 触发压缩，并返回本地结果消息。

### 2. 本地会话配置命令

- `/model`
- `/think`
- `/verbose`
- `/fast`

这类命令通过本地路由直接调用 `sessions.patch` 或查询 `sessions.list` / `models.list`，不再发给模型。

### 3. 本地桌面动作命令

- `/focus`
- `/export`
- `/usage`

这类命令不是聊天内容，而是桌面动作。

- `/focus`：切换聊天聚焦模式，隐藏左侧聊天记录面板。
- `/export`：把当前聊天记录导出为 Markdown，并通过桌面保存对话框落盘。

`/usage` 不再归到桌面动作。QClaw 真源码会把它作为本地结果消息回显，因此 XClaw 也改成在聊天区直接显示当前会话的 token 使用摘要，不再跳转页面。

### 4. 本地信息命令

- `/help`
- `/agents`
- `/kill`
- `/approve`

这类命令本地执行并把结果作为本地助手消息显示。

## 非本地命令

- `/status`
- `/skill`
- `/steer`

这些命令继续走普通 `chat.send`，因为它们在 QClaw 语义里本来就是 agent/gateway 侧命令，不应该被 renderer 私自截断。

## 架构落点

### Store 层

在 [`src/stores/chat.ts`](../../src/stores/chat.ts) 前置解析 slash command。

- 普通消息继续走既有发送链。
- `stop / approve / local slash` 统一收口到共享本地命令执行器 [`src/stores/chat/local-command-router.ts`](../../src/stores/chat/local-command-router.ts)。
- [`src/stores/chat.ts`](../../src/stores/chat.ts) 与 [`src/stores/chat/runtime-send-actions.ts`](../../src/stores/chat/runtime-send-actions.ts) 都复用这一条执行链，不再各自维护一套判断。
- 新增共享本地命令队列 [`src/stores/chat/local-command-queue.ts`](../../src/stores/chat/local-command-queue.ts)，对齐 QClaw `busy` 语义：`stop / focus / export` 立即执行，其余本地命令忙时入队，run 结束后自动出队。
- 仅真正的桌面副作用命令写入 `pendingSlashAction`，不直接操作路由或 DOM。

### 输入框层

在 [`src/pages/Chat/ChatInput.tsx`](../../src/pages/Chat/ChatInput.tsx) 接入 QClaw 风格的 slash menu。

- 输入 `/` 时展示分组命令菜单。
- 命令支持按前缀过滤。
- 对 `think / verbose / fast` 这类固定参数命令，二次进入参数菜单。
- 命令菜单补齐图标和徽标，`argOptions` 显示 `N options`，无参数本地命令显示 `instant`。
- `Tab` 只补全，`Enter` 选择并在可立即执行时直接提交。

### 页面层

在 [`src/pages/Chat/index.tsx`](../../src/pages/Chat/index.tsx) 监听 `pendingSlashAction`。

- `toggle-focus`：调用设置 store 切换 `chatFocusMode`
- `export`：构建 Markdown 并调用 host route 保存文本

### 桌面壳层

在 [`src/components/layout/MainLayout.tsx`](../../src/components/layout/MainLayout.tsx) 读取 `chatFocusMode`，聊天路由下隐藏 `ChatSessionsPane`，保持 Win/mac 统一行为。

### Host API

在 [`electron/api/routes/files.ts`](../../electron/api/routes/files.ts) 新增 `/api/files/save-text`，通过 Electron `showSaveDialog` 落盘 Markdown 文本，保持 renderer 不直接碰 Node 文件 API。

## 取舍

### 不把页面动作塞回 store 里直接操作路由

store 只负责“识别并发出动作”，Chat 页面负责“真正执行焦点切换与导出”，这样桌面保存对话框和 UI 状态仍然保持清晰边界。
