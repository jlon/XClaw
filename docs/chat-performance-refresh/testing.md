# 聊天性能与流畅度优化测试

## 目标

确认第一阶段改造后，聊天页在以下方面更稳定：

1. 首屏进入不再空白后跳动。
2. 长消息和富内容消息不再出现正文与 meta 掉层。
3. 滚动到底部、离底后回到底部、输入区高度变化三条链仍然可用。

## 自动化测试

### 需要补或更新

1. 首屏滚动初始化测试
   - 切换 session 时不再依赖 `visibility: hidden`
   - 首屏消息容器直接可见
2. 消息宽度与 meta 对齐测试
   - 用户消息
   - 助手消息
   - 长文本
   - markdown
3. 长会话滚动 affordance 测试
   - 离底显示回到底部按钮
   - 输入区高度变化后按钮不漂
4. 富内容次级层测试
   - thinking
   - tool
   - 图片
   - 文件

### 已完成

1. 已新增约束：
   - 首屏滚动初始化不能再隐藏主滚动区
   - 消息组件不能继续使用组件内硬编码双宽度策略
   - 聊天图片必须懒加载
   - 次级块和代码块必须具备内容可见性提示
   - `use-stick-to-bottom-instant` 必须有真实行为测试
   - 现有消息在父组件无关重渲时不能整片重渲
2. 已验证：
   - `chat-render-stability`
   - `chat-theme-shell`
   - `chat-message`
   - `chat-humanized-actions`
   - `chat-layout`
   - `use-stick-to-bottom-instant`

## 手工验证

1. 打开已有长会话，确认首屏不再先空一下。
2. 滚动到中段，确认滚动不再明显抖动。
3. 发送长文本和 markdown，确认复制/时间不掉到异常位置。
4. 检查用户截图中同类消息，确认截断问题不再出现。
5. 确认 mac / Windows 都不会因输入区高度变化导致回到底部按钮错位。
6. 确认“回到底部”按钮不再在聊天区与输入区之间额外占一整行空白。

## 命令

### 定向测试

```bash
pnpm exec vitest run tests/unit/chat-render-stability.test.tsx tests/unit/use-stick-to-bottom-instant.test.tsx tests/unit/chat-layout.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-message.test.tsx
```

### 静态校验

```bash
pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatMessage.tsx src/hooks/use-stick-to-bottom-instant.ts tests/unit/chat-render-stability.test.tsx tests/unit/use-stick-to-bottom-instant.test.tsx tests/unit/chat-layout.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-message.test.tsx --max-warnings=0
```

### 类型检查

```bash
pnpm run typecheck
```

## 通过标准

1. 上述定向测试通过。
2. 聊天页真实滚动和首屏进入无明显跳闪。
3. 用户已反馈的消息截断问题在本地复现路径上消失。
