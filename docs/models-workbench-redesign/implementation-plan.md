# 模型工作台二次收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/models` 从“首屏大 KPI + usage dashboard + provider 过滤器”改成 `Provider First` 的桌面工作台：先看 provider 资源入口，单击卡片直接进入配置聚焦态，并让下方分析区自动联动过滤。

**Architecture:** 保留现有 provider store、usage 数据源、runtime provider key 映射和 inspector 编辑链路，只重排 `/models` 的首屏优先级与工作台模式。默认态展示轻页头 + Provider Board + 次级 Token Intelligence；进入聚焦态后，普通宽度把完整 Board 折叠为当前 provider 头部，超宽态才保留左侧 provider rail。Token Intelligence 顶部固定为“紧凑摘要带 + 主指标切换 + 时间窗口”，图表继续使用轻量 SVG，但弱化网页报表式大数字和大卡片。

**Tech Stack:** React 19、TypeScript、Zustand、hostApiFetch、ResizeObserver、轻量 SVG、Vitest、ESLint

---

## 文件结构

### 重点修改文件

- `src/pages/Models/index.tsx`
  - `/models` 顶层状态机、默认态/聚焦态/超宽态切换、usage 过滤和布局编排
- `src/pages/Models/workbench-layout.ts`
  - 内容容器宽度到布局模式、Provider Board 展示形态、Token Intelligence 布局的纯函数
- `src/pages/Models/components/ModelsWorkbenchHeader.tsx`
  - 轻页头，只保留标题、短副标题和主动作
- `src/pages/Models/components/ProviderBoard.tsx`
  - 默认态资源入口板；聚焦态下的头部/rail 结构要由这里或同级轻组件承接
- `src/pages/Models/components/ProviderBoardCard.tsx`
  - Provider 卡片的信息密度、主点击行为、次级动作
- `src/pages/Models/components/ProviderInspector.tsx`
  - 查看态/编辑态承载不变，但需要对接新的聚焦态容器
- `src/pages/Models/components/UsageKpiStrip.tsx`
  - 从“大号 KPI 卡”改成紧凑摘要带
- `src/pages/Models/components/UsageMetricToggle.tsx`
  - 紧凑化，和摘要带/时间窗口组成同一条顶部 chrome
- `src/pages/Models/components/UsageTrendChart.tsx`
  - 去掉默认柱顶大数字，改为克制趋势图
- `src/pages/Models/components/UsageBreakdownChart.tsx`
  - 全局态看 provider，聚焦态看 model/request；保持 pane 语法
- `src/pages/Models/components/UsageRecentRequests.tsx`
  - 明细面板继续承接反向跳转，但语义改成次级面板
- `tests/unit/models-page.test.tsx`
  - 布局模式、首屏顺序、聚焦态转场、provider card 主行为
- `tests/unit/models-workbench-render.test.tsx`
  - `/models` 渲染骨架与工作台模式 smoke
- `tests/unit/models-charts.test.tsx`
  - Token Intelligence 顶部 chrome、主图表达约束、breakdown 维度
- `docs/models-workbench-redesign/design.md`
- `docs/models-workbench-redesign/testing.md`
- `docs/models-workbench-redesign/issues.md`
- `docs/models-workbench-redesign/progress.md`

### 约束

- 不新增图表库
- 不重写 provider store / host-api
- 不把 inspector 再做回卡片内联表单
- 不保留首屏大 KPI 卡

## Task 1: 锁定 `Provider First` 与聚焦态转场测试

**Files:**
- Modify: `tests/unit/models-page.test.tsx`
- Modify: `tests/unit/models-workbench-render.test.tsx`
- Modify: `tests/unit/models-charts.test.tsx`

- [ ] **Step 1: 为“provider 首屏优先”写失败测试**

```tsx
render(<Models />)
expect(screen.getByTestId('models-provider-board')).toBeInTheDocument()
expect(screen.queryByTestId('models-usage-kpis-grid')).not.toBeInTheDocument()
expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-max-visible-rows', '2')
```

- [ ] **Step 2: 为“点击卡片进入配置聚焦态”写失败测试**

```tsx
await user.click(screen.getByTestId('models-provider-card-select-openai'))
expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'focused')
expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-mode', 'view')
expect(screen.getByTestId('models-provider-focus-header')).toBeInTheDocument()
```

- [ ] **Step 3: 为“默认宽度折叠 board / 超宽保留 rail”写失败测试**

```tsx
expect(screen.queryByTestId('models-provider-rail')).not.toBeInTheDocument()
expect(screen.getByTestId('models-provider-focus-header')).toBeInTheDocument()
```

```tsx
resizeContainer(1720)
await user.click(screen.getByTestId('models-provider-card-select-openai'))
expect(screen.getByTestId('models-provider-rail')).toBeInTheDocument()
```

- [ ] **Step 4: 为 Token Intelligence 顶部 chrome 写失败测试**

```tsx
expect(screen.getByTestId('models-token-summary-strip')).toBeInTheDocument()
expect(screen.getByTestId('models-usage-metric-toggle')).toBeInTheDocument()
expect(screen.getByTestId('models-usage-window-toggle')).toBeInTheDocument()
```

- [ ] **Step 5: 为共享过滤映射与反向驱动聚焦态写失败测试**

```tsx
await user.click(screen.getByTestId('usage-breakdown-row'))
expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'focused')
expect(screen.getByTestId('models-provider-focus-header')).toHaveTextContent('OpenAI')
expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-mode', 'view')
```

```tsx
await user.click(screen.getByTestId('models-recent-request-provider-openai'))
expect(screen.getByTestId('models-provider-focus-header')).toHaveTextContent('OpenAI')
```

- [ ] **Step 6: 为窗口与首屏高度硬约束写失败测试**

```tsx
expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-overflow-mode', 'clamp')
expect(screen.getByTestId('models-token-intelligence')).toHaveAttribute('data-primary-chart-visible', 'true')
```

```tsx
await user.click(screen.getByRole('button', { name: /30d/i }))
expect(screen.getByTestId('models-provider-card-openai')).toHaveTextContent('30d')
```

- [ ] **Step 7: 为 `all` 桶策略和列数 contract 写失败测试**

```tsx
await user.click(screen.getByRole('button', { name: /all/i }))
expect(screen.getByTestId('models-trend-chart')).toHaveAttribute('data-window', 'all')
expect(screen.getByTestId('models-trend-chart')).toHaveAttribute('data-bucket-strategy', 'month')
```

```tsx
expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-columns', '3')
expect(screen.queryByTestId('models-provider-board-all-card')).not.toBeInTheDocument()
```

```ts
expect(getProviderBoardColumns({ contentWidth: 759, inspectorPinned: false })).toBe(1)
expect(getProviderBoardColumns({ contentWidth: 760, inspectorPinned: false })).toBe(2)
expect(getProviderBoardColumns({ contentWidth: 1160, inspectorPinned: false })).toBe(3)
expect(getProviderBoardColumns({ contentWidth: 1520, inspectorPinned: false })).toBe(4)
expect(getProviderBoardColumns({ contentWidth: 1520, inspectorPinned: true })).toBe(3)
```

- [ ] **Step 8: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-charts.test.tsx -t "provider first|focused provider|provider rail|summary strip|runtime key|breakdown select|recent request select|bucket strategy|board clamp"`

Expected: FAIL，当前实现仍然先渲染大 KPI，且未提供聚焦态头部/rail 转场。

- [ ] **Step 9: 提交测试基线**

```bash
git add tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-charts.test.tsx
git commit -m "test: lock models provider-first workbench"
```

## Task 2: 重排 `/models` 首屏与 Provider 聚焦工作区

**Files:**
- Modify: `src/pages/Models/index.tsx`
- Modify: `src/pages/Models/workbench-layout.ts`
- Modify: `src/pages/Models/components/ModelsWorkbenchHeader.tsx`
- Modify: `src/pages/Models/components/ProviderBoard.tsx`
- Modify: `src/pages/Models/components/ProviderBoardCard.tsx`
- Modify: `src/pages/Models/components/ProviderInspector.tsx`

- [ ] **Step 1: 在 `workbench-layout.ts` 为聚焦态展示形态写最小纯函数**

```ts
export type ProviderFocusPresentation = 'board' | 'header' | 'rail'
export function getProviderFocusPresentation(input: {
  contentWidth: number
  hasSelection: boolean
}): ProviderFocusPresentation
```

- [ ] **Step 2: 在 `index.tsx` 中实现新的顶层顺序**

```tsx
<ModelsWorkbenchHeader ... />
<ProviderBoard ... />
<section data-testid="models-token-intelligence">...</section>
```

要求：
- 删除首屏大 KPI 卡区域
- 默认态首屏先渲染 Provider Board
- `models-page-root` 暴露 `data-workbench-mode`
- 保持 `selectedProviderAccountId + runtimeProviderKey` 双层映射，不允许直接拿 `account.id` 去过滤 usage

- [ ] **Step 3: 在 `ProviderBoard` 中实现三种展示形态**

```tsx
data-presentation="board" | "header" | "rail"
```

要求：
- 默认态：完整卡片板
- 聚焦态普通宽度：只显示当前 provider 头部 `models-provider-focus-header`
- 超宽态：显示左侧 `models-provider-rail`
- 默认态最多展示 2 行，超出部分必须走内部滚动或折叠
- “全部提供商”降级为轻 scope 入口，不再保留抢首屏的总览卡

- [ ] **Step 4: 将卡片主点击改成“进入聚焦态 + 联动过滤”**

要求：
- 卡片主点击只做一件事：进入当前 provider 的配置聚焦态
- `Edit` 不再是进入聚焦态的唯一入口
- 删除/设默认仍为次级动作
- breakdown / 最近请求里的 provider 点击也必须走同一条聚焦链路

- [ ] **Step 5: 调整 Inspector 挂载位置**

要求：
- 默认宽度：`ProviderFocusHeader -> ProviderInspector -> TokenIntelligence`
- 超宽宽度：`ProviderRail | Inspector + TokenIntelligence`

- [ ] **Step 6: 让 Provider Board 与窗口联动**

要求：
- `7d / 30d / all` 切换后，卡片上的 usage 摘要同步更新
- `all` 视图不允许无限按天展开
- Provider Board 列数严格走 `1 / 2 / 3 / 4` 阈值，并在 inspector 常驻时回退到 `3`

- [ ] **Step 7: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx -t "provider first|focused provider|provider rail|breakdown select|recent request select|board clamp"`

Expected: PASS

- [ ] **Step 8: 提交工作台骨架**

```bash
git add src/pages/Models/index.tsx src/pages/Models/workbench-layout.ts src/pages/Models/components/ModelsWorkbenchHeader.tsx src/pages/Models/components/ProviderBoard.tsx src/pages/Models/components/ProviderBoardCard.tsx src/pages/Models/components/ProviderInspector.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx
git commit -m "feat: add provider-first models workspace"
```

## Task 3: 将 Token Intelligence 收敛成次级分析区

**Files:**
- Modify: `src/pages/Models/components/UsageKpiStrip.tsx`
- Modify: `src/pages/Models/components/UsageMetricToggle.tsx`
- Modify: `src/pages/Models/components/UsageTrendChart.tsx`
- Modify: `src/pages/Models/components/UsageBreakdownChart.tsx`
- Modify: `src/pages/Models/components/UsageRecentRequests.tsx`
- Modify: `src/pages/Models/index.tsx`
- Modify: `tests/unit/models-charts.test.tsx`
- Modify: `tests/unit/models-page.test.tsx`

- [ ] **Step 1: 将 `UsageKpiStrip` 改成紧凑摘要带**

要求：
- 不再渲染 4 张大卡
- 输出单条紧凑 strip
- 暴露 `data-testid="models-token-summary-strip"`

- [ ] **Step 2: 把摘要带、主指标切换、时间窗口收进同一条顶部 chrome**

```tsx
<div data-testid="models-token-intelligence-header">
  <UsageKpiStrip ... />
  <UsageMetricToggle ... />
  <div data-testid="models-usage-window-toggle">...</div>
</div>
```

要求：
- 时间窗口驱动 provider 卡片摘要与分析区共用同一套窗口状态
- 顶部 chrome 不能再退回 hero + KPI 大卡

- [ ] **Step 3: 收敛 `UsageTrendChart` 表达**

要求：
- 默认不再给每根柱子渲染大号顶部数值
- 仍保留可读的趋势和 stacked 结构
- 空态和 cost 缺口降级不回退
- `all` 视图明确输出月/周级 bucket 策略标识，避免无限按天展开

- [ ] **Step 4: 收敛 `UsageBreakdownChart` 语义**

要求：
- 全局态：provider breakdown
- 聚焦态：model / request breakdown
- 保留点击回写过滤，但不抢主画布
- provider ranking 只允许出现在全局态

- [ ] **Step 5: 收口 `UsageRecentRequests` 的反向跳转**

要求：
- 点击最近请求里的 provider 时，进入同一条 provider 聚焦链路
- 不允许只改过滤、不进聚焦态

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/models-charts.test.tsx tests/unit/models-page.test.tsx -t "summary strip|usage window toggle|trend chart|breakdown dimension|bucket strategy|recent request select"`

Expected: PASS

- [ ] **Step 7: 提交分析区改造**

```bash
git add src/pages/Models/components/UsageKpiStrip.tsx src/pages/Models/components/UsageMetricToggle.tsx src/pages/Models/components/UsageTrendChart.tsx src/pages/Models/components/UsageBreakdownChart.tsx src/pages/Models/components/UsageRecentRequests.tsx src/pages/Models/index.tsx tests/unit/models-charts.test.tsx tests/unit/models-page.test.tsx
git commit -m "feat: refine models token intelligence panes"
```

## Task 4: 收口文档、回归与整体验证

**Files:**
- Modify: `docs/models-workbench-redesign/design.md`
- Modify: `docs/models-workbench-redesign/testing.md`
- Modify: `docs/models-workbench-redesign/issues.md`
- Modify: `docs/models-workbench-redesign/progress.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`

- [ ] **Step 1: 同步 feature docs**

要求：
- 进度改成实现中/已完成的真实状态
- 测试文档记录本轮新增断言
- 问题文档记录“首屏优先级纠偏”已闭环

- [ ] **Step 2: 运行完整定向验证**

Run:

```bash
pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-charts.test.tsx tests/unit/models-usage-history.test.ts tests/unit/provider-account-form-sections.test.tsx tests/unit/token-usage.test.ts tests/unit/usage-routes.test.ts
pnpm exec eslint src/pages/Models/index.tsx src/pages/Models/workbench-layout.ts src/pages/Models/components/ModelsWorkbenchHeader.tsx src/pages/Models/components/ProviderBoard.tsx src/pages/Models/components/ProviderBoardCard.tsx src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/UsageKpiStrip.tsx src/pages/Models/components/UsageMetricToggle.tsx src/pages/Models/components/UsageTrendChart.tsx src/pages/Models/components/UsageBreakdownChart.tsx src/pages/Models/components/UsageRecentRequests.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-charts.test.tsx --max-warnings=0
pnpm run typecheck
pnpm run build:vite
```

Expected:
- 所有定向单测通过
- eslint 0 warnings
- typecheck 通过
- vite 构建通过

- [ ] **Step 3: 提交收口**

```bash
git add docs/models-workbench-redesign/design.md docs/models-workbench-redesign/testing.md docs/models-workbench-redesign/issues.md docs/models-workbench-redesign/progress.md README.md README.zh-CN.md README.ja-JP.md
git commit -m "docs: finalize models workbench redesign"
```
