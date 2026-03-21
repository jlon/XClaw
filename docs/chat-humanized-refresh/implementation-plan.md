# 聊天区域人性化设计优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将聊天区域从“功能已齐但节奏离散”的 AI 控制台观感，收敛成更像桌面工作区的消息阅读与快捷操作体验。

**Architecture:** 保留现有 `Chat / ChatMessage / ChatInput` 的数据链和第一阶段修好的滚动契约，只在消息表现层和动作层做收敛。优先统一 `meta row + process rail + bubble hierarchy` 三条线，不引入新的 runtime 协议、消息结构或假闭环动作。

**Tech Stack:** React 19、TypeScript、Vite、Electron、Tailwind、Vitest、ESLint、现有 Zustand 聊天 store、i18next

---

## 文件结构

### 预计修改

- `src/pages/Chat/ChatMessage.tsx`
- `src/pages/Chat/index.tsx`
- `src/pages/Chat/ChatInput.tsx`
- `src/styles/globals.css`
- `tests/unit/chat-message.test.tsx`
- `tests/unit/chat-humanized-actions.test.tsx`
- `tests/unit/chat-theme-shell.test.ts`
- `tests/unit/chat-input.test.tsx`

### 文档同步

- `docs/chat-humanized-refresh/design.md`
- `docs/chat-humanized-refresh/issues.md`
- `docs/chat-humanized-refresh/progress.md`
- `docs/chat-humanized-refresh/testing.md`

## Task 1：统一消息动作层与 meta row

**Files:**

- Modify: `src/pages/Chat/ChatMessage.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-message.test.tsx`

- [ ] **Step 1: 补消息动作层测试**

覆盖：

- 用户消息与助手消息都存在统一 meta row
- 复制按钮仍然可用
- streaming 尾标不会把 meta row 打断

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx --reporter=dot`

- [ ] **Step 3: 实现 meta row 收敛**

要求：

- 时间与复制统一归入轻元信息行
- 默认弱化，hover 时增强
- 不新增新的消息工具条

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/ChatMessage.tsx src/styles/globals.css tests/unit/chat-message.test.tsx
git commit -m "feat: refine chat message meta row"
```

## Task 2：统一 thinking / tool / streaming 的过程轨语义

**Files:**

- Modify: `src/pages/Chat/ChatMessage.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-message.test.tsx`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补过程轨语义测试**

覆盖：

- `thinking`、tool 状态、流式状态不会再表现为多套厚卡片
- 运行中 / 完成 / 错误仍可区分
- 不影响现有展开与 streaming 指示器

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现过程轨收敛**

要求：

- `thinking` 与 `tool` 使用统一的轻过程轨语义
- 仅通过轻点、轻图标、轻背景区分状态
- 不改变 `extractThinking / extractToolUse` 数据链

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/ChatMessage.tsx src/styles/globals.css tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts
git commit -m "feat: align chat process rails"
```

## Task 3：收平用户/助手消息主视觉层级

**Files:**

- Modify: `src/pages/Chat/ChatMessage.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-message.test.tsx`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补主视觉层级测试**

覆盖：

- 助手消息继续保持文稿流
- 用户消息维持轻 tint，不再显得像重品牌块
- 图片、文件、代码块仍按现有结构渲染

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现主视觉层级收平**

要求：

- 只调整视觉权重，不改消息内容分支结构
- 正文比附件、代码块、图片卡更显主
- 不重新引入厚 glow、厚边框、厚卡片

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/ChatMessage.tsx src/styles/globals.css tests/unit/chat-message.test.tsx tests/unit/chat-theme-shell.test.ts
git commit -m "feat: refine chat message hierarchy"
```

## Task 4：收紧快捷操作默认权重

**Files:**

- Modify: `src/pages/Chat/index.tsx`
- Modify: `src/pages/Chat/ChatInput.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/chat-humanized-actions.test.tsx`
- Test: `tests/unit/chat-theme-shell.test.ts`

- [ ] **Step 1: 补快捷操作测试**

覆盖：

- 回到底部按钮继续可用
- 模型切换入口继续可见且不抢正文
- `@` 入口继续可用

- [ ] **Step 2: 运行测试确认基线**

Run: `pnpm exec vitest run tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 3: 实现快捷操作默认弱化**

要求：

- 默认态下，快捷动作不比正文更抢眼
- hover、异常、离底状态下再增强
- 不新增新的动作入口

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/styles/globals.css tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts
git commit -m "feat: soften chat action affordances"
```

## Task 5：文档与验收收口

**Files:**

- Modify: `docs/chat-humanized-refresh/design.md`
- Modify: `docs/chat-humanized-refresh/issues.md`
- Modify: `docs/chat-humanized-refresh/progress.md`
- Modify: `docs/chat-humanized-refresh/testing.md`

- [ ] **Step 1: 同步已实现范围**

要求：

- 删除未做或被裁掉的设计项
- 记录真实通过的自动化命令
- 更新当前阶段是否已闭环

- [ ] **Step 2: 执行定向回归**

Run: `pnpm exec vitest run tests/unit/chat-message.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx --reporter=dot`

- [ ] **Step 3: 执行静态校验**

Run: `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-message.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx --max-warnings=0`

- [ ] **Step 4: 提交**

```bash
git add docs/chat-humanized-refresh
git commit -m "docs: update chat humanized refresh status"
```
