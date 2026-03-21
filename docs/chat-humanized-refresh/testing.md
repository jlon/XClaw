# 聊天区域人性化设计优化测试

## 目标

确认第二阶段改造后，聊天区域在以下方面更像成熟桌面工作区：

1. 正文优先，次级动作不打断阅读。
2. 快捷操作更顺手，但默认不吵。
3. `thinking / tool / status / error` 具备统一语义。
4. 不破坏第一阶段的滚动、流式、复制和输入链路。

## 自动化测试

### 需要补或更新

1. 消息 meta row 测试
   - 用户消息复制与时间
   - 助手消息复制与时间
   - streaming 尾标不打断 meta row
   - 代码块与非图片附件仍走原有内容分支
2. 过程轨语义测试
   - thinking 展开收起
   - tool 运行中 / 完成 / 错误
   - 请求错误气泡仍贴近输入区
   - 连续 assistant 输出时，重复身份 chrome 会被压低
   - 连续 assistant 输出时，段落间距会比角色切换更紧
3. 快捷操作层测试
   - 回到底部按钮仍可用
   - 模型切换提示仍可用
   - @ 目标选择器仍可用
   - 默认态弱化、激活态增强

## 手工验证

1. 打开已有长会话，确认消息区阅读节奏更平。
2. hover 消息，确认复制入口容易发现但不过度抢眼。
3. 检查 thinking/tool/status，确认它们看起来属于同一套过程轨。
4. 发送用户消息，确认用户气泡仍然轻、清晰、可读。
5. 触发一次请求错误，确认错误提示仍贴近输入区。
6. 在 mac / Windows 上检查快捷操作不会因 hover 或浮层调整而漂移。
7. 观察连续 assistant 输出或长 tool 过程，确认不会重复抬起头像和身份 chrome。
8. 打开空态首页，确认欢迎区更像启动工作区，而不是 landing page。
9. 打开长会话，确认 meta row 和过程轨已经降低存在感，但 hover 仍然可发现。
10. 检查代码块、附件卡和图片卡，确认它们已经更服从正文，不会重新抢走主视觉。
8. 观察连续 assistant 输出，确认它们之间的间距比 user/assistant 切换更紧，不会仍然像独立大卡片一样断开。

## 命令

### 定向测试

```bash
pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-input.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-render-stability.test.tsx --reporter=dot
```

### 静态校验

```bash
pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-message.test.tsx tests/unit/chat-input.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-render-stability.test.tsx --max-warnings=0
```

### 类型检查

```bash
pnpm run typecheck
```

## 通过标准

1. 定向测试通过。
2. 聊天正文可读性提升，动作层不打断阅读。
3. 真实 `dev` 环境下，至少验证 1 条已有长会话和 1 条流式会话，确认：
   - meta row 不掉层
   - 过程轨不打断正文
   - 回到底部、复制、模型切换仍可用
4. 未引入第一阶段已修复问题的回归。
5. 至少 1 轮定向验证需要覆盖：
   - `chat-message + chat-theme-shell`
   - `chat-input + chat-theme-shell`
6. 如果继续收正文块级元素，还要补看：
   - 代码块不回退成重品牌卡
   - 附件卡/图片卡不丢现有预览与打开链路
7. 如果继续收连续 assistant 输出分组，还要补看：
   - 用户消息后新的 assistant 输出会重新抬起身份头像
   - streaming / tool processing 不会伪造时间戳
   - 连续 assistant 输出的段距明显小于角色切换后的段距
8. 如果继续收空态与次级信息密度，还要补看：
   - 欢迎态标题和动作没有回退成 marketing hero
   - meta row 默认弱化后仍能在 hover 时稳定抬起
   - 过程轨压缩后不会丢状态辨识度
9. 如果继续收正文块级元素，还要补看：
   - 代码块边界收平后仍保留清晰的代码容器感
   - 附件卡和图片卡弱化后不影响预览与打开
   - 正文仍然是消息里的第一视觉焦点
