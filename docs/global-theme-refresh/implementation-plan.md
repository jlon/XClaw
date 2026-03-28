# 全局主题重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 XClaw 从当前偏 AI SaaS/web 的混合主题，重构为统一品牌的桌面应用视觉系统，并以 `Chat + Channels` 作为第一批试点页面完成可见落地。

**Architecture:** 先收口全局语义 token 与主题入口，再统一应用外壳和共享控件，最后让 `Chat / Channels` 消费新的共享层。平台差异只允许存在于应用外壳、滚动条、边框强度和材质强度，不拆成两套独立主题。

**Tech Stack:** React 19、TypeScript、Vite、Electron、Tailwind、Vitest、ESLint、现有 Zustand 主题设置链

---

## 当前执行批次（2026-03-27）

本轮不再继续铺开全站“顺手修一点”的做法，而是严格收敛到 `design-v3.md` 里当前偏差最大的两条主线：

1. `桌面壳层`：去掉工作区的网页定宽居中壳，收口全局滚动条、焦点和动效语法，让窗口层级更接近 `nexu`。
2. `Chat 工作区`：把聊天页从“网页居中内容区 + 胶囊输入框 + 半套 IM 气泡”改回真正的桌面工作台。

本轮明确不处理：

- `Setup / Studio / Agents / Skills / Models / Settings / Cron` 的大范围去网页化
- 全量 primitive 体系重做
- 新增功能或交互路径改造

本轮交付的完成标准：

- `WorkspacePage` 不再使用 `mx-auto + max-width` 作为默认工作区壳
- `Chat` 线程画布与 composer 不再使用网页式居中卡片节奏
- 聊天气泡、工具状态、会话搜索框回到统一桌面语法
- 回归测试能锁住上述结构，避免下一轮再次回退

本轮新增的结构级强制项：

- `MainLayout` 必须具备共享 `sidebarWidth`、真实 `resize handle` 与 `workspace tint`
- `TitleBar` 在 mac 下必须使用固定 `window-drag-bar`，不能继续依赖整片 `drag-region/no-drag`
- `Chat` 必须维持单主滚动层，composer 只能作为 footer dock 存在

本轮已补充完成的收口点：

- mac 标题栏左上交互区已固定为 control rail，workspace sidebar toggle 与聊天 pane 切换不再挂靠 sidebar slot 居中逻辑
- `Chat` 的 typing row、tool chip 状态和 Markdown 代码块继续向 `nexu` 语法对齐，避免在最后一层细节重新长回网页味

---

## 文件结构

### 第一批核心修改

- `src/styles/globals.css`
- `src/App.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/TitleBar.tsx`
- `src/components/layout/WorkspacePage.tsx`
- `src/components/layout/ChatSessionsPane.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/switch.tsx`
- `src/pages/Chat/index.tsx`
- `src/pages/Chat/ChatToolbar.tsx`
- `src/pages/Chat/ChatInput.tsx`
- `src/pages/Chat/ChatMessage.tsx`
- `src/pages/Channels/index.tsx`

### 第一批测试修改 / 新增

- `tests/unit/workspace-page-layout.test.tsx`
- `tests/unit/chat-layout.test.tsx`
- `tests/unit/chat-theme-shell.test.ts`
- `tests/unit/chat-input.test.tsx`
- `tests/unit/chat-message.test.tsx`
- `tests/unit/channels-page.test.tsx`
- `tests/unit/ui-primitives-theme.test.tsx`
- `tests/unit/theme-application.test.tsx`

### 第一批文档同步

- `docs/global-theme-refresh/design.md`
- `docs/global-theme-refresh/issues.md`
- `docs/global-theme-refresh/progress.md`
- `docs/global-theme-refresh/testing.md`

## Task 1：重构主题入口与全局 token

**Files:**

- Modify: `src/styles/globals.css`
- Modify: `src/App.tsx`
- Test: `tests/unit/theme-application.test.tsx`

- [ ] **Step 1: 写失败测试，锁定主题入口与 class 应用语义**

覆盖：

- `light / dark / system` 仍然通过根节点 class 切换
- 深浅主题共用同一套语义 token 命名
- 新扩展 token 至少包含 `surface / chrome / border / glow / motion` 基础层

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/theme-application.test.tsx`

- [ ] **Step 3: 重构 `globals.css` 与主题入口**

要求：

- 将浅色主题正式切到 `瓷白灰 + 深红铜`
- 将深色主题正式切到 `石墨黑 + 深红铜`
- 去掉默认蓝作为长期主色
- 保持现有 `theme=light|dark|system` 切换逻辑不变
- 所有新语义先进入共享 token 层，不直接在页面写死

- [ ] **Step 4: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/theme-application.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/styles/globals.css src/App.tsx tests/unit/theme-application.test.tsx
git commit -m "feat: add desktop theme token system"
```

## Task 2：统一应用外壳与平台 overlay

**Files:**

- Modify: `src/components/layout/MainLayout.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/TitleBar.tsx`
- Modify: `src/components/layout/WorkspacePage.tsx`
- Test: `tests/unit/workspace-page-layout.test.tsx`

- [ ] **Step 1: 写失败测试，锁定应用外壳约束**

覆盖：

- `MainLayout / Sidebar / TitleBar / WorkspacePage` 共享统一外壳语义
- 不再依赖页面各自发明背景和边框逻辑
- mac / Windows 差异只保留轻度 overlay，不出现双主题分叉

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx`

- [ ] **Step 3: 实现应用外壳重构**

要求：

- `Sidebar` 变成稳定的应用外壳而不是普通网页侧栏
- `TitleBar` 明确桌面应用层级
- `WorkspacePage` 负责统一内容区背景、滚动和容器节奏
- 平台差异只调整材质、边框和滚动条强度

- [ ] **Step 4: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/MainLayout.tsx src/components/layout/Sidebar.tsx src/components/layout/TitleBar.tsx src/components/layout/WorkspacePage.tsx tests/unit/workspace-page-layout.test.tsx
git commit -m "feat: refine desktop app shell surfaces"
```

## Task 3：收敛共享 primitive 视觉规则

**Files:**

- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/switch.tsx`
- Test: `tests/unit/ui-primitives-theme.test.tsx`

- [ ] **Step 1: 写失败测试，锁定 shared primitive 主题约束**

覆盖：

- `Button / Input / Select` 吃新的语义 token
- 不继续保留 shadcn 默认蓝按钮 / 默认输入框表现
- 控件在深浅主题下都保持桌面应用气质

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/ui-primitives-theme.test.tsx`

- [ ] **Step 3: 实现共享控件视觉收敛**

要求：

- 主按钮允许轻度铜红高光，但必须克制
- 次级按钮、输入框、下拉框、徽标卡片全部改吃共享 token
- 不允许在控件内部写死平台分叉逻辑
- `Select / Input / Button` 优先完成，其他 primitive 跟随收敛

- [ ] **Step 4: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/ui-primitives-theme.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx src/components/ui/card.tsx src/components/ui/switch.tsx tests/unit/ui-primitives-theme.test.tsx
git commit -m "feat: align shared primitives with desktop theme"
```

## Task 4：落地 Chat 第一批试点

**Files:**

- Modify: `src/pages/Chat/index.tsx`
- Modify: `src/pages/Chat/ChatToolbar.tsx`
- Modify: `src/components/layout/ChatSessionsPane.tsx`
- Test: `tests/unit/chat-layout.test.tsx`

- [ ] **Step 1: 写失败测试，锁定 Chat 页的第一批视觉约束**

覆盖：

- 欢迎页、消息区、输入区吃新的共享 surface
- 不再依赖旧的网页式底色和边框
- 页面仍保持当前交互与状态逻辑

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/chat-layout.test.tsx`

- [ ] **Step 3: 实现 Chat 页视觉试点**

要求：

- 保持聊天交互逻辑不变
- 让欢迎页、工具栏、消息容器、输入区统一进入新主题体系
- 不新增新的页面级长期颜色 hardcode

- [ ] **Step 4: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/chat-layout.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Chat/index.tsx src/pages/Chat/ChatToolbar.tsx src/components/layout/ChatSessionsPane.tsx tests/unit/chat-layout.test.tsx
git commit -m "feat: refresh chat page theme"
```

## Task 5：落地 Channels 第一批试点

**Files:**

- Modify: `src/pages/Channels/index.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 写失败测试，锁定频道页的第一批视觉约束**

覆盖：

- 三段式响应布局继续保留
- 三栏/两栏工作台吃新的共享 surface 和控件语义
- 状态点、卡片、表单控件进入统一主题规则

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 3: 实现频道页视觉试点**

要求：

- 不破坏已有频道中心功能闭环
- 不退回固定暖色和网页式卡片
- 右栏表单、左栏卡片、状态点全部与新主题对齐

- [ ] **Step 4: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: refresh channel center theme"
```

## Task 6：同步文档与验证收口

**Files:**

- Modify: `docs/global-theme-refresh/design.md`
- Modify: `docs/global-theme-refresh/issues.md`
- Modify: `docs/global-theme-refresh/progress.md`
- Modify: `docs/global-theme-refresh/testing.md`

- [ ] **Step 1: 同步实现结果到文档**

要求：

- 记录实际落地的 token、应用外壳规则、primitive 范围、试点页面结果
- 移除已经关闭的问题，保留真实未决项

- [ ] **Step 2: 运行第一批验证**

Run:

```bash
pnpm exec eslint src/styles/globals.css src/components/layout/MainLayout.tsx src/components/layout/Sidebar.tsx src/components/layout/TitleBar.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/pages/Chat/index.tsx src/pages/Channels/index.tsx --max-warnings=0
pnpm run typecheck
pnpm exec vitest run tests/unit/theme-application.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channels-page.test.tsx
pnpm run build:vite
```

- [ ] **Step 3: 提交**

```bash
git add docs/global-theme-refresh/design.md docs/global-theme-refresh/issues.md docs/global-theme-refresh/progress.md docs/global-theme-refresh/testing.md
git commit -m "docs: sync global theme refresh rollout"
```

## Task 7：推进 Settings / Models 第二波落地

**Files:**

- Modify: `src/pages/Settings/index.tsx`
- Modify: `src/components/settings/ProvidersSettings.tsx`
- Modify: `src/components/settings/UpdateSettings.tsx`
- Modify: `src/pages/Models/index.tsx`

- [ ] **Step 1: 清理页面级固定暖色和网页式按钮/面板**

要求：

- 页面主容器改吃共享 `app-panel-surface` / `app-field-surface`
- 头部操作区、告警区、信息面板不再写死 `bg-[#f3f1e9]`、`border-black/10` 这类旧值
- 不改动业务流程、表单读写和 API 调用

- [ ] **Step 2: 收口列表、卡片、状态带与表单节奏**

要求：

- `Settings` 与 `Models` 保持统一的桌面工作区密度
- 大块说明文案与控件之间不再依赖页面私有间距
- 深浅主题下都保持可读，不回退成网页后台

- [ ] **Step 3: 运行聚焦验证**

Run:

```bash
pnpm exec eslint src/pages/Settings/index.tsx src/components/settings/ProvidersSettings.tsx src/components/settings/UpdateSettings.tsx src/pages/Models/index.tsx --max-warnings=0
pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx
```

## Task 8：推进 Agents / Skills / Cron 第二波落地

**Files:**

- Modify: `src/pages/Agents/index.tsx`
- Modify: `src/pages/Skills/index.tsx`
- Modify: `src/pages/Cron/index.tsx`

- [ ] **Step 1: 替换页面级暖色卡片和旧网页式头部**

要求：

- 统一接入共享外壳与 surface 语义
- 列表、弹层、头部按钮不再依赖旧暖色和固定黑白透明值
- 不改变 Agent / Skill / Cron 的原有交互结构

- [ ] **Step 2: 收口状态、徽标、搜索和表单控件风格**

要求：

- 让状态徽标、搜索输入、右侧详情面板进入统一品牌主题
- 不引入新的页面级颜色 hardcode
- 保持 mac / Windows 共用同一套规则，仅保留共享 overlay

- [ ] **Step 3: 运行聚焦验证**

Run:

```bash
pnpm exec eslint src/pages/Agents/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx --max-warnings=0
pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx
```

## 并行执行边界

为避免互相踩文件，第一轮并行只允许以下两条子任务同时进行：

### 并行任务 A：应用外壳

- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/TitleBar.tsx`
- `src/components/layout/WorkspacePage.tsx`
- `tests/unit/workspace-page-layout.test.tsx`

### 并行任务 B：共享控件

- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/switch.tsx`
- `tests/unit/ui-primitives-theme.test.tsx`

以下文件由主控在本地负责，避免并行冲突：

- `src/styles/globals.css`
- `src/App.tsx`
- `src/pages/Chat/index.tsx`
- `src/pages/Chat/ChatInput.tsx`
- `src/pages/Channels/index.tsx`
- `docs/global-theme-refresh/*`

## 第二轮并行执行边界

### 并行任务 C：Settings / Models

- `src/pages/Settings/index.tsx`
- `src/components/settings/ProvidersSettings.tsx`
- `src/components/settings/UpdateSettings.tsx`
- `src/pages/Models/index.tsx`

### 并行任务 D：Agents / Skills / Cron

- `src/pages/Agents/index.tsx`
- `src/pages/Skills/index.tsx`
- `src/pages/Cron/index.tsx`
