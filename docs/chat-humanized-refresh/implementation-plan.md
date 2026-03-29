# 聊天区域人性化设计优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏全局壁纸能力和 `macOS / Windows` 窗口结构的前提下，把聊天区域从“功能已齐但节奏离散”的 AI 控制台观感，收敛成更像 `QClaw` 的桌面阅读工作区。

**Architecture:** 保留现有 `Chat / ChatMessage / ChatInput / ChatSessionsPane` 的数据链和第一阶段修好的滚动契约，只在聊天局部表现层做收敛。优先统一 `main reading veil + session pane contrast + composer dock + process rail` 四条线，不引入新的 runtime 协议、消息结构或假闭环动作，也不改全局壁纸导入链路。

**Tech Stack:** React 19、TypeScript、Vite、Electron、Tailwind、Vitest、ESLint、现有 Zustand 聊天 store、i18next

---

## 文件结构

### 预计修改

- `src/pages/Chat/ChatMessage.tsx`
- `src/pages/Chat/index.tsx`
- `src/pages/Chat/ChatInput.tsx`
- `src/components/layout/ChatSessionsPane.tsx`
- `src/styles/globals.css`
- `tests/unit/chat-message.test.tsx`
- `tests/unit/chat-layout.test.tsx`
- `tests/unit/chat-theme-shell.test.ts`
- `tests/unit/chat-input.test.tsx`

### 文档同步

- `docs/chat-humanized-refresh/design.md`
- `docs/chat-humanized-refresh/issues.md`
- `docs/chat-humanized-refresh/progress.md`
- `docs/chat-humanized-refresh/testing.md`
- `docs/global-wallpaper/progress.md`
- `docs/global-wallpaper/testing.md`
- `docs/global-wallpaper/issues.md`

## Task 1：去掉主区矩形底板，改成无边界阅读 veil

**Files:**

- Modify: `src/pages/Chat/index.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补主区阅读 veil 测试**

覆盖：

- 聊天主区不再使用带内缩边界的 `reading card`
- 主区仍然比侧栏略亮
- 不重新引入额外的局部 blur 卡片边界

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现无边界阅读 veil**

要求：

- 聊天主区改为无边界轻 veil，而不是局部玻璃卡片
- 主区和顶部、主区和 composer 之间不能出现矩形切缝
- 有壁纸和无壁纸时都保持同一层级关系

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/index.tsx src/styles/globals.css tests/unit/chat-theme-shell.test.ts
git commit -m "feat: flatten chat reading veil"
```

## Task 2：拉开侧栏与主区的明暗关系

**Files:**

- Modify: `src/components/layout/ChatSessionsPane.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-layout.test.tsx`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补侧栏层级测试**

覆盖：

- 会话侧栏比主区更安静
- 搜索框和会话行不再像网页表单 / 卡片
- 不破坏现有搜索、切换和标题栏控制

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现侧栏对齐**

要求：

- 侧栏比主区略暗且更克制
- 搜索、会话行、底部入口向 source list 靠拢
- 不改会话数据模型和路由行为

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/ChatSessionsPane.tsx src/styles/globals.css tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts
git commit -m "feat: align chat session pane contrast"
```

## Task 3：把 composer 并入阅读流末端

**Files:**

- Modify: `src/pages/Chat/ChatInput.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-input.test.tsx`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补 composer 层级测试**

覆盖：

- composer 继续可发送、可切模型、可选 @agent
- composer 默认不再像独立玻璃控制台
- 深浅色与 `macOS / Windows` 都不破坏输入可读性

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-input.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现 composer 收平**

要求：

- 保留现有工具与发送链路
- 默认态更轻，激活态再增强
- 和主区视觉连成一体，不再形成上下两块板

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-input.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/ChatInput.tsx src/styles/globals.css tests/unit/chat-input.test.tsx tests/unit/chat-theme-shell.test.ts
git commit -m "feat: soften chat composer chrome"
```

## Task 4：继续收消息和过程轨到 qclaw 语义

**Files:**

- Modify: `src/pages/Chat/ChatMessage.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-message.test.tsx`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补消息与过程轨测试**

覆盖：

- 助手消息继续保持文稿流
- 用户消息维持轻 tint
- `thinking / tool / status` 继续保持统一轻时间线
- 不影响代码块、附件、图片与复制链路

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现消息与过程轨收口**

要求：

- 保持正文优先，过程轨后退
- 不回退成厚卡片或厚 chip
- 不改消息解析与内容分支结构

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/ChatMessage.tsx src/styles/globals.css tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts
git commit -m "feat: align chat reading hierarchy"
```

## Task 5：文档与验收收口

**Files:**

- Modify: `docs/chat-humanized-refresh/design.md`
- Modify: `docs/chat-humanized-refresh/issues.md`
- Modify: `docs/chat-humanized-refresh/progress.md`
- Modify: `docs/chat-humanized-refresh/testing.md`
- Modify: `docs/global-wallpaper/progress.md`
- Modify: `docs/global-wallpaper/testing.md`
- Modify: `docs/global-wallpaper/issues.md`

- [ ] **Step 1: 同步已实现范围**

要求：

- 删除未做或被裁掉的设计项
- 记录真实通过的自动化命令
- 更新当前阶段是否已闭环
- 明确这轮是“聊天主区对齐 `QClaw` 但不破坏壁纸”的局部实现

- [ ] **Step 2: 执行定向回归**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-input.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx tests/unit/chat-render-stability.test.tsx --reporter=dot`

- [ ] **Step 3: 执行静态校验**

Run: `pnpm exec eslint src/components/layout/ChatSessionsPane.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-message.test.tsx tests/unit/chat-input.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx tests/unit/chat-render-stability.test.tsx --max-warnings=0`

- [ ] **Step 4: 提交**

```bash
git add docs/chat-humanized-refresh
git commit -m "docs: update chat humanized refresh status"
```
