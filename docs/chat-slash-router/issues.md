# Chat Slash Router 问题记录

## 已解决

### 1. `/approve` 之外的 slash command 全部落进 `chat.send`

现象：

- `/help`
- `/model`
- `/compact`
- `/agents`
- `/kill`
- `/focus`
- `/export`
- `/usage`

都被当成普通用户消息处理。

原因：

XClaw 之前只有单独的 `/approve` 解析，没有统一 slash command parser 和 local executor。

修复：

在聊天 store 的发送入口前增加统一解析与本地分流。

### 2. 系统命令会以普通消息形态污染聊天记录

现象：

像 `/new`、`/reset` 这类命令如果直接复用原有 `sendMessage('/new')`，会先生成普通用户气泡。

修复：

这类命令改为复用统一网关发送链，由 renderer 截获后发送字面 slash payload，不再落到自然语言路径。

### 3. 页面副作用命令没有宿主桥

现象：

`/focus`、`/export`、`/usage` 不能只在 store 里“识别”，否则会变成悬空状态。

修复：

新增 `pendingSlashAction`，由 Chat 页面消费并执行真实桌面动作。`/usage` 同时从“错误的页面导航”收回成对齐 QClaw 的本地 usage 摘要。

## 仍需关注

### 1. 平台验证仍是浏览器化 Electron harness

现在已经补了 Win32 和 mac 风格路径的 E2E，但仍然是 Playwright + 本地 Electron API mock，不是真机窗口级自动化。
