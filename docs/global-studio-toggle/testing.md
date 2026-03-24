# 全局工作室入口测试

## 手动检查

- 在 `Chat / Models / Agents / Channels / Skills / Cron / Settings` 页面确认右上角存在工作室入口
- 在 `/studio` 页面确认同一位置显示返回聊天入口
- 在 `/setup` 页面确认右上角不显示工作室入口

## 自动验证

- `pnpm exec vitest run tests/unit/studio-toggle-button.test.tsx tests/unit/chat-toolbar.test.tsx`
- `pnpm exec eslint src/components/layout/StudioToggleButton.tsx src/components/layout/GlobalTitleBarUtilities.tsx src/pages/Chat/ChatToolbar.tsx tests/unit/studio-toggle-button.test.tsx tests/unit/chat-toolbar.test.tsx --max-warnings=0`
- `pnpm exec tsc --noEmit --pretty false`
- `pnpm run build:vite`
