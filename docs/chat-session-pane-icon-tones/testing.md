# 聊天侧栏图标低饱和主题色验证

## 已执行

- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "applies low-saturation theme tones to chat session pane icons without tinting the labels" --reporter=dot`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "keeps the global sidebar on the same font stack and applies toned navigation icons" --reporter=dot`
- `pnpm exec eslint src/components/layout/ChatSessionsPane.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint src/components/layout/Sidebar.tsx src/components/layout/ChatSessionsPane.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`

## 结果

- 新增的主题色图标约束用例通过
- 主 Sidebar 的字体栈和导航 tone 用例通过
- `Sidebar.tsx`、`ChatSessionsPane.tsx` 与对应测试文件 ESLint 通过

## 额外观察

- 全量 `tests/unit/chat-layout.test.tsx` 仍有一条旧断言失败，和本次图标色彩改动无关
