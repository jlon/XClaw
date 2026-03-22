# Chat Slash Router 实施计划

## 任务拆分

### 1. 先补失败测试

- 在聊天 store 路由测试里补 slash command 矩阵
- 在聊天布局测试里补 focus mode 断言
- 在聊天页面测试里保留 export / focus 页面副作用断言，并把 `/usage` 改为本地结果断言
- 在输入框测试里补 slash menu 与参数菜单红测
- 在旧 `runtime-send-actions` 分支测试里补共享执行器红测

### 2. 再补路由实现

- 新增共享本地命令执行器
- 把 `sendMessage` 的本地命令分流前置，并让旧模块化发送分支复用同一执行器
- 保留 `/status`、`/skill`、`/steer` 继续走 agent 路径

### 3. 再补桌面动作桥

- 新增 `pendingSlashAction`
- Chat 页面消费 `toggle-focus / export`
- MainLayout 根据 `chatFocusMode` 切换聊天侧栏

### 4. 再补导出能力

- 新增 Markdown 构建函数
- 新增 `/api/files/save-text`

### 5. 再补输入框菜单

- 输入 `/` 时展示分组命令菜单
- 固定参数命令进入参数子菜单
- `Tab / Enter / Esc / ↑↓` 对齐 QClaw 的基础键盘语义

### 6. 最后补文档与验证

- 更新 README 三语说明
- 补 feature docs
- 执行 lint / typecheck / E2E，并补 Win32 路径回归
