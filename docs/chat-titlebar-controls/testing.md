# 聊天侧栏控制测试

## 本轮验证

- `pnpm exec vitest run tests/unit/chat-layout.test.tsx tests/unit/titlebar-browser-fallback.test.tsx`
- `pnpm exec eslint src/components/layout/TitleBar.tsx src/components/layout/ChatSessionHeaderControls.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "keeps the global sidebar on the same font stack and applies toned navigation icons|shows a dedicated chats pane on the chat route|toggles chat focus mode from the titlebar session controls" --reporter=dot`
- `pnpm exec eslint src/components/layout/WorkspaceSidebarToggleButton.tsx src/components/layout/Sidebar.tsx src/components/layout/ChatSessionHeaderControls.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`

预期：

- 侧栏可见时，动作按钮位于标题栏左侧聊天带末端
- 侧栏隐藏时，动作按钮自动左对齐到标题栏左缘安全区
- 图标按钮使用整条标题栏高度承载，但按钮自身保持 24px 裸 icon action
- 多 Agent 场景下新建会话仍能先选择 Agent
- QClaw 同款 SVG 图标保持 `display:block`，避免上下漂移
- 全局 Sidebar 的收缩按钮与聊天标题栏的侧栏切换按钮复用同一颗共享控件
- `win32` 下工作台展开/收起与聊天收起态都必须显式通过，不允许继承 mac 安全区偏移

## 待补充验证

- `pnpm run build:vite`
- `pnpm run typecheck`

## 实际结果

2026-03-22 已完成：

- `pnpm exec vitest run tests/unit/chat-layout.test.tsx tests/unit/titlebar-browser-fallback.test.tsx`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "Windows workspace toggle|Windows chat toggle|Windows-friendly scrollbar treatment"`
- `pnpm exec eslint src/components/layout/TitleBar.tsx src/components/layout/ChatSessionHeaderControls.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm run build:vite`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "keeps the global sidebar on the same font stack and applies toned navigation icons|shows a dedicated chats pane on the chat route|toggles chat focus mode from the titlebar session controls" --reporter=dot`
- `pnpm exec eslint src/components/layout/WorkspaceSidebarToggleButton.tsx src/components/layout/Sidebar.tsx src/components/layout/ChatSessionHeaderControls.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`

结果：

- 标题栏左侧聊天带的固定宽度态与收起后左对齐态都通过
- `win32` 下工作台展开/收起态与聊天收起态也已被显式回归锁住
- 多 Agent 场景下新建会话仍能先选 Agent
- QClaw 同款 SVG 图标与整高承载盒模型已经被测试锁住
- 聊天标题栏和全局 Sidebar 现在使用同一颗侧栏切换控件
- `build:vite` 通过，仍保留既有 chunk size / dynamic import 提示
- `typecheck` 通过
