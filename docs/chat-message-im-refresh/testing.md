# 聊天消息区桌面 IM 质感对齐测试

## 计划验证

1. `tests/unit/chat-message.test.tsx`
   - 用户与助手消息拥有新的主消息壳层
   - 用户气泡圆角与结构调整生效
2. `tests/unit/chat-theme-shell.test.ts`
   - 源码中存在新的 `app-chat-message-primary`
   - 用户/助手列宽与气泡参数按新目标对齐
   - 消息画布存在 `app-chat-thread-canvas`
   - 消息图片区不再使用固定方块裁切
   - 助手消息存在反馈区 rail、feedback panel 与反馈按钮尺寸约束
   - fallback typing / tool-processing 使用独立 `app-chat-typing-*` 结构
3. `eslint`
4. `typecheck`

## 执行结果

1. `pnpm exec vitest run tests/unit/chat-message.test.tsx --reporter=dot`
   - 通过
2. `pnpm exec vitest run tests/unit/chat-theme-shell.test.ts --reporter=dot`
   - 通过
3. `pnpm exec vitest run tests/unit/chat-render-stability.test.tsx tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`
   - 通过
4. `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --max-warnings=0`
   - 通过
5. `pnpm run typecheck`
   - 通过
6. `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`
   - 通过
7. `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-render-stability.test.tsx tests/unit/chat-humanized-actions.test.tsx --reporter=dot`
   - 通过
8. `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-render-stability.test.tsx --max-warnings=0`
   - 通过
9. `pnpm run typecheck`
   - 通过
