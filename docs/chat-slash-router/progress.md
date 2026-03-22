# Chat Slash Router 进度

## 2026-03-22

### 已完成

- 建立与 QClaw 对齐的 slash command 定义与解析模块
- 建立共享本地命令执行器 [`src/stores/chat/local-command-router.ts`](../../src/stores/chat/local-command-router.ts)
- 把本地命令前置接入 [`src/stores/chat.ts`](../../src/stores/chat.ts) 与 [`src/stores/chat/runtime-send-actions.ts`](../../src/stores/chat/runtime-send-actions.ts)
- `/approve` 与 `stop` 从单独特判并入统一本地命令链路
- `/new`、`/reset`、`/clear`、`/stop`、`/compact` 完成会话级分流
- `/model`、`/think`、`/verbose`、`/fast` 完成会话配置分流
- `/help`、`/agents`、`/kill` 完成本地结果回显
- `/focus`、`/export` 通过 `pendingSlashAction` 接到页面副作用
- `/usage` 改为对齐 QClaw 的会话 usage 本地摘要，不再跳 `/models`
- 新增 `chatFocusMode`，聊天聚焦模式下隐藏左侧会话面板
- 新增 `/api/files/save-text`，支持 Markdown 导出
- 输入框补齐 slash command 菜单、图标、`instant / N options` 徽标与固定参数二级菜单
- `/new`、`/reset` 改为复用统一网关发送链，不再本地伪造新会话
- busy 状态下本地 slash 命令对齐 QClaw 队列语义
- 主 `chat.ts` 的后台会话标题清洗补齐 `[WhatsApp ...]` 前缀剥离
- 增补 Win32 路径的 slash menu + `/usage` E2E
- README 三语同步补充 slash command router 行为说明

### 当前状态

- 运行时主路径：已闭环
- 旧模块化发送分支：已闭环
- 输入框 slash menu：已闭环
- 页面副作用：已闭环
- 会话标题后台清洗：已闭环
- 自动化验证：已完成
  - `vitest`：待本轮回归后更新
  - `eslint`：通过
  - `typecheck`：通过
  - `test:e2e`：待本轮回归后更新

### 下一步

- 如需继续追 QClaw 体验，再评估是否补命令菜单的 hover/active 动效细节；快捷键徽标不再作为目标，因为 QClaw 当前源码并未实际渲染这部分数据
