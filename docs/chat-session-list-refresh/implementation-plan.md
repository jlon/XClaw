# 聊天列表去网页感改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将聊天左侧会话列表从网页卡片流收成更像桌面应用的 source list，同时保持 XClaw 必要的多 Agent 可辨识度。

**Architecture:** 保持现有 `ChatSessionsPane` 行为链不变，只改会话列表的结构、分组策略和层级样式。搜索仍然留在侧栏内，但视觉从厚表单输入框压成轻筛选器；时间信息从主列表移出，改由分组承担主要时间定位职责；聊天列表默认回到单行 source list，只有在标签重复时再以内联弱后缀补最小 Agent 区分。

**Tech Stack:** React 19、TypeScript、Tailwind utility classes、现有 `globals.css` 主题层、Vitest、ESLint

---

### Task 1: 更新侧栏会话列表设计文档

**Files:**
- Modify: `docs/chat-session-list-refresh/design.md`
- Modify: `docs/chat-session-list-refresh/issues.md`
- Modify: `docs/chat-session-list-refresh/progress.md`
- Modify: `docs/chat-session-list-refresh/testing.md`
- Modify: `docs/chat-session-list-refresh/implementation-plan.md`

- [ ] 记录 QClaw 证据、XClaw 保留项和验收标准
- [ ] 明确“不照抄弹层搜索、不为模仿而保留副标题/身份章”的边界

### Task 2: 收紧列表结构与分组

**Files:**
- Modify: `src/components/layout/ChatSessionsPane.tsx`
- Test: `tests/unit/chat-layout.test.tsx`

- [ ] 将侧栏宽度收紧到更克制的一档
- [ ] 将时间分组从细时间桶收敛为 `今天 / 本周 / 本月 / 更早`
- [ ] 去掉主列表每行时间展示
- [ ] 收平会话项 hover / active 层级
- [ ] 保持新建、切换、删除、搜索行为不变

### Task 3: 去 AI 化聊天列表身份表达

**Files:**
- Modify: `src/components/layout/ChatSessionsPane.tsx`
- Modify: `src/styles/globals.css`

- [ ] 让聊天列表默认退出身份章显示
- [ ] 仅在必要时保留最小 Agent 文本区分
- [ ] 不引入新的头像系统或外部资源

### Task 4: 收平搜索区和列表样式

**Files:**
- Modify: `src/components/layout/ChatSessionsPane.tsx`
- Modify: `src/styles/globals.css`

- [ ] 将搜索框压平为轻筛选器
- [ ] 分组标题降成更轻的系统分段标签
- [ ] 会话项改成更像桌面列表行，而不是网页卡片
- [ ] 将本地 pane 标题从聊天列表里退出

### Task 5: 补齐回归与验收

**Files:**
- Modify: `tests/unit/chat-layout.test.tsx`
- Modify: `src/i18n/locales/zh/chat.json`
- Modify: `src/i18n/locales/en/chat.json`
- Modify: `src/i18n/locales/ja/chat.json`
- Modify: `docs/chat-session-list-refresh/progress.md`
- Modify: `docs/chat-session-list-refresh/testing.md`

- [ ] 更新测试，锁定分组、时间移除、宽度、空状态、搜索行为和同名标签区分策略
- [ ] 运行 `vitest / eslint / typecheck`
- [ ] 更新文档中的落地结果与剩余观察项
