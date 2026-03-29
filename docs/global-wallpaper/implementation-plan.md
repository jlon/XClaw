# 全局壁纸统一壳层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有全局壁纸功能基础上，把 XClaw 所有桌面页收敛到一套统一壳层材质，并修复标题栏交互与壁纸分层问题。

**Architecture:** 保留现有主进程壁纸托管与设置链路，不重复改动上传接口；Renderer 侧把 `MainLayout`、`TitleBar`、`Sidebar`、`WorkspacePage` 和全局 CSS 收敛为单一桌面壳层材质系统，让“有壁纸”和“无壁纸”只共享一套结构与 token，差异仅体现在底层场景图层输入。

**Tech Stack:** Electron、React 19、Vite、TypeScript、electron-store、现有 Host API

---

### Task 1: 收敛需求与文档基线

**Files:**
- Modify: `docs/global-wallpaper/implementation-plan.md`
- Modify: `docs/global-wallpaper/issues.md`
- Modify: `docs/global-wallpaper/progress.md`

- [x] 记录当前已完成的首版能力，避免重复改主进程导入链路
- [x] 补充本轮要解决的体验问题：右上角按钮失效、顶部/底部分层、侧栏遮挡、整体玻璃感不统一
- [x] 明确本轮覆盖范围为所有桌面页，不包含 setup

### Task 2: 先写失败测试锁住交互和材质约束

**Files:**
- Modify: `tests/unit/global-titlebar-utilities.test.tsx`
- Modify: `tests/unit/global-wallpaper-layout.test.tsx`
- Modify: `tests/unit/global-wallpaper-material-contract.test.ts`
- Modify: `tests/unit/sidebar-chrome-surfaces.test.tsx`
- Modify: `tests/unit/workspace-page-layout.test.tsx`

- [x] 为 mac 标题栏工具按钮补失败测试，确保交互控件落在 `no-drag` 区域
- [x] 为统一壳层材质补失败测试，确保不再依赖分离的标题栏/侧栏背板造成色阶断层
- [x] 为桌面页共享材质结构补失败测试，确保侧栏和工作区都透出同一底层场景

### Task 3: 重构标题栏交互边界

**Files:**
- Modify: `src/components/layout/TitleBar.tsx`
- Modify: `src/pages/Chat/ChatToolbar.tsx`
- Modify: `src/components/layout/GlobalTitleBarUtilities.tsx`
- Modify: `src/styles/globals.css`

- [x] 去掉会覆盖右上角控制区的独立 mac drag bar 方案
- [x] 把真正可拖动区域限制在空白壳层，不覆盖交互按钮
- [x] 给标题栏右侧工具按钮和聊天页工具按钮统一补足 `no-drag` 语义与共享样式类

### Task 4: 收敛整窗材质层级

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/ChatSessionsPane.tsx`
- Modify: `src/components/layout/WorkspacePage.tsx`
- Modify: `src/styles/globals.css`

- [x] 保留全局壁纸底层，但把标题栏、侧栏、工作区收敛到同一套 shell material
- [x] 去掉造成顶部和底部两段色阶的重复背板或渐层叠加
- [x] 让左侧边栏和聊天会话栏不再自带实底遮住壁纸
- [x] 统一“有壁纸”和“无壁纸”两种状态下的玻璃 token、边界光和前景面板透明度

### Task 5: 验证

**Files:**
- Modify: `docs/global-wallpaper/testing.md`
- Modify: `docs/global-wallpaper/progress.md`

- [x] 运行与标题栏、壳层、壁纸相关的单测
- [x] 运行 `pnpm run typecheck`
- [x] 记录本轮修复结果、剩余风险和手工验证重点
