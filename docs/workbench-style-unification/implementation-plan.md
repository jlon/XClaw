# Workbench Style Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重排主体业务工作区的前提下，把 `模型 / 智能体 / 频道 / 技能 / 定时任务` 统一到同一套桌面级 `Workbench Header Grammar`，同时减少说明文字、压缩冗余摘要，并让轻图标只承担识别与扫描辅助。

**Architecture:** 先在共享层建立单一的工作台页头 primitive 与统一的 header token，再逐页迁移五个工作台的头部、summary strip 和 utility field。主体业务区不动，页面级差异只保留在内容负载层，不再保留独立 hero、独立 toolbar 或独立 summary 样式。

**Tech Stack:** React 19、TypeScript、Tailwind、shadcn/ui、Vitest、Testing Library、i18next

**补充约束：**

- 同一视口只允许一个主 CTA。页头已经有主创建动作时，空态不得再复制第二颗主按钮。
- `定时任务` 的“新建任务”最终必须支持选择目标智能体，但只有在 `CronJobCreateInput / host route / gateway rpc` 同步透传 `agentId` 后才能实现；在此之前不允许做假选择器。
- 工作台页头默认不显示图标锚点；之前实现过的图标底盘需要逐页撤回，只保留标题块、动作区和 summary strip 的统一 grammar。

---

## 文件结构

### 现有文件

- Modify: `src/components/layout/WorkspacePage.tsx`
  - 保留当前工作台页骨架，但需要为统一页头 primitive 提供稳定插槽
- Modify: `src/pages/Models/components/ModelsWorkbenchHeader.tsx`
  - 从独立 hero 头部降级为共享 primitive 的薄包装
- Modify: `src/pages/Models/index.tsx`
  - 接入统一页头 grammar，移除超大 hero 比例
- Modify: `src/pages/Agents/index.tsx`
  - 接入统一页头，补副标题、图标底盘和 summary 语义
- Modify: `src/pages/Channels/index.tsx`
  - 将当前轻 toolbar 头部提升到统一 grammar，但不动三栏主体
- Modify: `src/pages/Skills/index.tsx`
  - 统一头部、搜索 utility、summary strip
- Modify: `src/pages/Cron/index.tsx`
  - 统一头部、主按钮和 summary strip
- Modify: `src/styles/globals.css`
  - 增加统一页头 token、icon anchor、summary strip、motion 预算 class
- Modify: `src/i18n/locales/zh/*.json`
- Modify: `src/i18n/locales/en/*.json`
- Modify: `src/i18n/locales/ja/*.json`
  - 压缩工作台副标题和 summary 文案
- Modify: `docs/workbench-style-unification/progress.md`
- Modify: `docs/workbench-style-unification/testing.md`

### 新增文件

- Create: `src/components/layout/WorkbenchHeader.tsx`
  - 工作台页头共享 primitive
- Create: `src/components/layout/WorkbenchHeaderIcon.tsx`
  - 统一图标底盘
- Create: `src/components/layout/WorkbenchHeaderTitleBlock.tsx`
  - 标题与副标题块
- Create: `src/components/layout/WorkbenchHeaderActions.tsx`
  - 动作区包装
- Create: `src/components/layout/WorkbenchSummaryStrip.tsx`
  - 轻量摘要条
- Create: `tests/unit/workbench-style-unification.test.tsx`
  - 锁定五个工作台页头结构、文案密度和 motion 预算

## Task 1: 建立共享页头 primitive 与红测

**Files:**
- Create: `src/components/layout/WorkbenchHeader.tsx`
- Create: `src/components/layout/WorkbenchHeaderIcon.tsx`
- Create: `src/components/layout/WorkbenchHeaderTitleBlock.tsx`
- Create: `src/components/layout/WorkbenchHeaderActions.tsx`
- Create: `src/components/layout/WorkbenchSummaryStrip.tsx`
- Test: `tests/unit/workbench-style-unification.test.tsx`

- [ ] **Step 1: 写结构红测**

覆盖：
- 五个工作台最终都应依赖 `WorkbenchHeader` 级共享 primitive
- `WorkbenchSummaryStrip` 成为唯一 summary strip 语法来源
- 不允许继续存在每页独有的大 hero / 轻 toolbar 结构

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx --reporter=dot`
Expected: FAIL，提示共享 primitive 不存在或页面尚未接入

- [ ] **Step 3: 实现最小共享 primitive**

实现：
- 统一左锚点、标题块、动作区、summary strip 结构
- 保持 API 足够薄，不承担业务逻辑
- 不在 primitive 内写页面专属条件分支

- [ ] **Step 4: 重新运行红测**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx --reporter=dot`
Expected: 仍有部分 FAIL，但失败应转为“页面未迁移”，不再是组件不存在

- [ ] **Step 5: 提交**

```bash
git add src/components/layout/WorkbenchHeader.tsx src/components/layout/WorkbenchHeaderIcon.tsx src/components/layout/WorkbenchHeaderTitleBlock.tsx src/components/layout/WorkbenchHeaderActions.tsx src/components/layout/WorkbenchSummaryStrip.tsx tests/unit/workbench-style-unification.test.tsx
git commit -m "feat: add shared workbench header primitives"
```

## Task 2: 统一 header token 与桌面 motion 预算

**Files:**
- Modify: `src/styles/globals.css`
- Test: `tests/unit/workbench-style-unification.test.tsx`

- [ ] **Step 1: 写样式红测**

覆盖：
- icon anchor 尺寸固定为统一 budget
- 主按钮 / 次按钮 / 图标按钮高度分级固定
- summary strip 使用单一 class 语法
- 工作台页头不允许新增页面专属 keyframes

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx -t "locks shared workbench header tokens and motion budget" --reporter=dot`
Expected: FAIL，提示统一 token 或断言缺失

- [ ] **Step 3: 在全局样式里加入统一 token**

实现：
- `app-workbench-header`
- `app-workbench-header-icon`
- `app-workbench-header-title`
- `app-workbench-header-subtitle`
- `app-workbench-header-actions`
- `app-workbench-summary-strip`
- `app-workbench-summary-item`

- [ ] **Step 4: 重跑红测确认通过**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx -t "locks shared workbench header tokens and motion budget" --reporter=dot`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/styles/globals.css tests/unit/workbench-style-unification.test.tsx
git commit -m "feat: add workbench header style tokens"
```

## Task 3: 迁移 Models 与 Agents

**Files:**
- Modify: `src/pages/Models/components/ModelsWorkbenchHeader.tsx`
- Modify: `src/pages/Models/index.tsx`
- Modify: `src/pages/Agents/index.tsx`
- Modify: `src/i18n/locales/zh/agents.json`
- Modify: `src/i18n/locales/en/agents.json`
- Modify: `src/i18n/locales/ja/agents.json`
- Test: `tests/unit/workbench-style-unification.test.tsx`

- [ ] **Step 1: 写页级红测**

覆盖：
- `模型` 不再保留超大 hero 比例
- `智能体` 获得统一图标锚点和副标题
- 两页都接入共享 primitive

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx -t "normalizes models and agents into the shared workbench header grammar" --reporter=dot`
Expected: FAIL

- [ ] **Step 3: 迁移 Models**

实现：
- 保留 `ModelsWorkbenchHeader` 文件，但改成共享 primitive 薄包装
- 标题降级为统一尺寸
- 保留动作区，但退出 billboard hero

- [ ] **Step 4: 迁移 Agents**

实现：
- 增加统一 icon anchor
- 补齐副标题
- 保留 mode switch 在动作区

- [ ] **Step 5: 压缩副标题文案**

要求：
- 默认一行
- 说明句只保留工作台用途，不重复标题

- [ ] **Step 6: 重跑页级测试**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx -t "normalizes models and agents into the shared workbench header grammar" --reporter=dot`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/pages/Models/components/ModelsWorkbenchHeader.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/i18n/locales/zh/agents.json src/i18n/locales/en/agents.json src/i18n/locales/ja/agents.json tests/unit/workbench-style-unification.test.tsx
git commit -m "feat: unify models and agents workbench headers"
```

## Task 4: 迁移 Channels 与 Skills

**Files:**
- Modify: `src/pages/Channels/index.tsx`
- Modify: `src/pages/Skills/index.tsx`
- Modify: `src/i18n/locales/zh/channels.json`
- Modify: `src/i18n/locales/en/channels.json`
- Modify: `src/i18n/locales/ja/channels.json`
- Modify: `src/i18n/locales/zh/skills.json`
- Modify: `src/i18n/locales/en/skills.json`
- Modify: `src/i18n/locales/ja/skills.json`
- Test: `tests/unit/workbench-style-unification.test.tsx`
- Test: `tests/unit/skills-page-layout.test.tsx`

- [ ] **Step 1: 写页级红测**

覆盖：
- `频道` 从过轻 toolbar 升到统一 grammar
- `技能` 搜索框明确归入 header utility
- `技能` summary strip 改成更轻的桌面状态条

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx tests/unit/skills-page-layout.test.tsx --reporter=dot`
Expected: FAIL

- [ ] **Step 3: 迁移 Channels**

实现：
- 引入 icon anchor
- 标题和副标题提升到统一比例
- 刷新按钮收进统一动作区
- 不动三栏主体和告警带

- [ ] **Step 4: 迁移 Skills**

实现：
- 页头使用共享 primitive
- 搜索作为 header utility
- `添加技能` 保持主按钮
- summary strip 改为轻图标化状态单元

- [ ] **Step 5: 压缩文案**

要求：
- `Skills` 副标题能短则短
- `Channels` 副标题只保留一句用途说明

- [ ] **Step 6: 重跑测试**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx tests/unit/skills-page-layout.test.tsx --reporter=dot`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/pages/Channels/index.tsx src/pages/Skills/index.tsx src/i18n/locales/zh/channels.json src/i18n/locales/en/channels.json src/i18n/locales/ja/channels.json src/i18n/locales/zh/skills.json src/i18n/locales/en/skills.json src/i18n/locales/ja/skills.json tests/unit/workbench-style-unification.test.tsx tests/unit/skills-page-layout.test.tsx
git commit -m "feat: unify channels and skills workbench headers"
```

## Task 5: 迁移 Cron 与摘要 icon 化

**Files:**
- Modify: `src/pages/Cron/index.tsx`
- Modify: `src/i18n/locales/zh/cron.json`
- Modify: `src/i18n/locales/en/cron.json`
- Modify: `src/i18n/locales/ja/cron.json`
- Test: `tests/unit/workbench-style-unification.test.tsx`

- [ ] **Step 1: 写页级红测**

覆盖：
- `定时任务` 页头接入共享 primitive
- 统计条降级为统一 summary strip
- 摘要优先是 `轻图标 + 数字 + 极短标签`
- 同一视口只保留一个创建类主 CTA
- 新建任务流程不得继续隐式吞掉目标智能体语义

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx -t "normalizes cron to the shared summary-strip grammar" --reporter=dot`
Expected: FAIL

- [ ] **Step 3: 迁移 Cron 页头**

实现：
- 接入统一 icon anchor
- 保留新增任务为唯一主按钮
- 刷新动作收为次按钮
- 如果当前创建链尚未支持 `agentId`，先把这件事显式记录为 blocker，不在 UI 做假下拉框

- [ ] **Step 4: 改造统计条**

实现：
- 将当前文字统计条降为统一 summary strip
- 文案更短
- 优先图标化，不使用完整解释句

- [ ] **Step 5: 为后续 agent 绑定补实现前提**

要求：
- 梳理 `CronJobCreateInput`、host route、gateway rpc 当前是否透传 `agentId`
- 如果未透传，记录成下一阶段必须补的结构缺口
- 不把它伪装成“样式统一已完成”

- [ ] **Step 6: 重跑测试**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx -t "normalizes cron to the shared summary-strip grammar" --reporter=dot`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/pages/Cron/index.tsx src/i18n/locales/zh/cron.json src/i18n/locales/en/cron.json src/i18n/locales/ja/cron.json tests/unit/workbench-style-unification.test.tsx
git commit -m "feat: unify cron workbench header and summary"
```

## Task 6: 全量回归与文档同步

**Files:**
- Modify: `docs/workbench-style-unification/progress.md`
- Modify: `docs/workbench-style-unification/testing.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`
- Test: `tests/unit/workbench-style-unification.test.tsx`

- [ ] **Step 1: 跑统一回归**

Run: `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx tests/unit/skills-page-layout.test.tsx --reporter=dot`
Expected: PASS

- [ ] **Step 2: 跑 lint**

Run: `pnpm exec eslint src/components/layout/WorkbenchHeader.tsx src/components/layout/WorkbenchHeaderIcon.tsx src/components/layout/WorkbenchHeaderTitleBlock.tsx src/components/layout/WorkbenchHeaderActions.tsx src/components/layout/WorkbenchSummaryStrip.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/pages/Channels/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx tests/unit/workbench-style-unification.test.tsx --max-warnings=0`
Expected: PASS

- [ ] **Step 3: 跑 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: 同步文档**

更新：
- feature 进度
- feature 测试记录
- 如有对外界面变化，再更新三语 README

- [ ] **Step 5: 提交**

```bash
git add docs/workbench-style-unification/progress.md docs/workbench-style-unification/testing.md README.md README.zh-CN.md README.ja-JP.md
git commit -m "docs: finalize workbench style unification"
```
