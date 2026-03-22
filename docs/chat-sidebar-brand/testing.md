# 聊天左栏品牌位测试

## 本轮验证

- `pnpm exec vitest run tests/unit/chat-layout.test.tsx`
- `pnpm exec eslint src/components/layout/AppBrandLockup.tsx src/components/layout/Sidebar.tsx src/components/layout/ChatSessionsPane.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm run build:vite`
- `pnpm run typecheck`

## 预期

- 聊天左栏显示 `logo + XClaw`
- 品牌位位于搜索框上方
- 工作台 `Sidebar` 继续显示相同的品牌结构
- 不影响聊天页标题栏按钮与搜索交互

## 实际结果

2026-03-22：

- 已新增聊天页品牌位
- 已将工作台 `Sidebar` 切换到共享品牌组件
- 已用单测锁住聊天页品牌位在搜索框上方
- `build:vite` 通过
- `typecheck` 通过
