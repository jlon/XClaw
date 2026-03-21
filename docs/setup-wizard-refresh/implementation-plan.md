# Setup 引导页重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `Setup` 从当前“大卡片式设置页”重构为标准桌面引导页，统一 `fresh / takeover` 的向导骨架与动作契约，并在不破坏现有 host/runtime 逻辑的前提下交付可用的 mac / Windows 首次引导体验。

**Architecture:** 保留 `src/pages/Setup/index.tsx` 作为状态容器和 host 交互入口，把布局壳层、被动步骤轨、底部操作栏和四个阶段内容拆到 `src/components/setup/`。步骤模型改成统一的四阶段语义，并将现有 `provider review / installing / complete` 重新映射到新的阶段状态，确保 `completeSetupSession` 只在最终完成按钮触发，同时去掉当前全局 `Skip Setup` 直通完成语义。关闭窗口、退出引导和“应用变更中”阶段的中断行为也要纳入同一动作契约，不能在完成前偷偷写入 `setupComplete`。

**Tech Stack:** React 19、TypeScript、Framer Motion、Tailwind、Vitest、ESLint、现有 Zustand stores 与 host API

---

## 文件结构

### 新增文件

- `src/components/setup/SetupShell.tsx`
- `src/components/setup/SetupStepRail.tsx`
- `src/components/setup/SetupFooter.tsx`
- `src/components/setup/SetupStartStage.tsx`
- `src/components/setup/SetupPreparationStage.tsx`
- `src/components/setup/SetupProviderStage.tsx`
- `src/components/setup/SetupCompleteStage.tsx`
- `src/components/setup/types.ts`
- `src/components/setup/stage-utils.ts`
- `src/components/setup/SetupExitGuard.tsx`
- `tests/unit/setup-wizard-layout.test.tsx`
- `tests/unit/setup-wizard-flow.test.ts`

### 修改文件

- `src/pages/Setup/index.tsx`
- `docs/setup-wizard-refresh/progress.md`
- `docs/setup-wizard-refresh/testing.md`
- `docs/global-theme-refresh/progress.md`
- `docs/global-theme-refresh/testing.md`

## Task 1：统一四阶段模型、完成阶段子状态与激活时机

**Files:**

- Create: `src/components/setup/types.ts`
- Create: `src/components/setup/stage-utils.ts`
- Modify: `src/pages/Setup/index.tsx`
- Test: `tests/unit/setup-wizard-flow.test.ts`

- [ ] **Step 1: 写失败测试，锁定四阶段骨架与激活时机**

```ts
import { describe, expect, it } from 'vitest';
import { mapSetupStateToStage, canActivateSetup } from '@/components/setup/stage-utils';

describe('setup wizard flow model', () => {
  it('maps both fresh and takeover into the same four top-level stage semantics', () => {
    expect(mapSetupStateToStage({ mode: 'fresh', stepId: 'runtime' })).toBe('preparation');
    expect(mapSetupStateToStage({ mode: 'takeover', stepId: 'providerReview' })).toBe('provider');
  });

  it('allows activation only from the final completion summary state', () => {
    expect(canActivateSetup({ stage: 'complete', phase: 'applying' })).toBe(false);
    expect(canActivateSetup({ stage: 'complete', phase: 'summary' })).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts`

Expected: FAIL with missing helper module or missing exports

- [ ] **Step 3: 实现最小步骤模型与激活判定**

```ts
export type SetupStage = 'start' | 'preparation' | 'provider' | 'complete';
export type CompletePhase = 'applying' | 'summary';

export const mapSetupStateToStage = ({ mode, stepId }: { mode: 'fresh' | 'takeover'; stepId: string }): SetupStage => {
  if (stepId === 'takeover' || stepId === 'welcome') return 'start';
  if (stepId === 'runtime') return 'preparation';
  if (stepId === 'provider' || stepId === 'providerReview') return 'provider';
  return 'complete';
};

export const canActivateSetup = ({ stage, phase }: { stage: SetupStage; phase?: CompletePhase }) => (
  stage === 'complete' && phase === 'summary'
);
```

- [ ] **Step 4: 将 `Setup` 页切换到统一四阶段派生模型**

要求：

- 保留当前 host / gateway / provider 调用逻辑
- 不再让顶层向导骨架因为 `fresh / takeover` 断裂
- `takeover` 可以跳过人工配置，但仍要映射到同一阶段语义
- `completeSetupSession` 只允许在最终完成按钮触发
- `Installing` 进入 `complete.applying` 子状态，而不是独立顶层步骤
- 删除当前全局 `Skip Setup -> completeSetupSession` 直通语义

- [ ] **Step 5: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/setup/types.ts src/components/setup/stage-utils.ts src/pages/Setup/index.tsx tests/unit/setup-wizard-flow.test.ts
git commit -m "feat: normalize setup wizard stage model"
```

## Task 2：建立标准桌面向导壳层与动作契约

**Files:**

- Create: `src/components/setup/SetupShell.tsx`
- Create: `src/components/setup/SetupStepRail.tsx`
- Create: `src/components/setup/SetupFooter.tsx`
- Create: `src/components/setup/SetupExitGuard.tsx`
- Modify: `src/pages/Setup/index.tsx`
- Test: `tests/unit/setup-wizard-layout.test.tsx`

- [ ] **Step 1: 写失败测试，锁定桌面向导壳层**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupShell } from '@/components/setup/SetupShell';

it('renders a passive stage rail, content region, and footer actions', () => {
  render(
    <SetupShell
      rail={<div data-testid="rail" />}
      footer={<div data-testid="footer" />}
    >
      <div data-testid="content" />
    </SetupShell>,
  );

  expect(screen.getByTestId('rail')).toBeInTheDocument();
  expect(screen.getByTestId('content')).toBeInTheDocument();
  expect(screen.getByTestId('footer')).toBeInTheDocument();
});

it('keeps the passive rail non-interactive', async () => {
  const onRailSelect = vi.fn();
  const user = userEvent.setup();

  render(
    <SetupStepRail
      stages={[
        { id: 'start', label: '开始', status: 'current' },
        { id: 'preparation', label: '准备', status: 'upcoming' },
      ]}
      onSelect={onRailSelect}
    />,
  );

  await user.click(screen.getByText('准备'));
  expect(onRailSelect).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx`

Expected: FAIL with missing component

- [ ] **Step 3: 实现壳层与导航组件**

要求：

- 左侧固定被动步骤轨，右侧内容区，底部固定操作栏
- 左侧步骤轨默认只读，不支持点击跳步
- 继续使用现有桌面主题 token 和 `TitleBar`
- 默认窗口宽度下布局必须成立，不能靠用户手动拉宽
- 在 footer 中写死动作契约：开始/准备/模型与接入/完成.applying/完成.summary 的按钮语义各自明确
- 完成前退出、关闭窗口和 `complete.applying` 中断都要走统一退出守卫

- [ ] **Step 4: 将 `src/pages/Setup/index.tsx` 接到新壳层**

要求：

- loading / error / normal 三种状态都走统一壳层逻辑
- 只保留一个稳定的页面根布局
- 不再使用“进度点 + 中央大卡片 + 下方按钮”的旧结构
- 完成前退出不得写入 `setupComplete`

- [ ] **Step 5: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/setup/SetupShell.tsx src/components/setup/SetupStepRail.tsx src/components/setup/SetupFooter.tsx src/pages/Setup/index.tsx tests/unit/setup-wizard-layout.test.tsx
git commit -m "feat: add desktop setup wizard shell"
```

## Task 3：拆分开始与准备阶段

**Files:**

- Create: `src/components/setup/SetupStartStage.tsx`
- Create: `src/components/setup/SetupPreparationStage.tsx`
- Modify: `src/pages/Setup/index.tsx`
- Test: `tests/unit/setup-wizard-layout.test.tsx`

- [ ] **Step 1: 写失败测试，锁定开始与准备阶段边界**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Setup } from '@/pages/Setup';

it('does not start takeover import from the start stage CTA', async () => {
  const user = userEvent.setup();
  render(<Setup />);

  await user.click(await screen.findByRole('button', { name: '继续' }));

  expect(startTakeoverImportMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx`

Expected: FAIL because stage components are not wired

- [ ] **Step 3: 拆出开始阶段**

要求：

- 欢迎说明与接管/全新开始选择统一进入 `SetupStartStage`
- `takeover` 检测摘要只作为开始阶段内容，不再独立撑起整个流程
- 不在开始阶段执行重操作

- [ ] **Step 4: 拆出准备阶段**

要求：

- `fresh` 的工作目录、端口、环境准备集中在准备阶段
- `takeover` 的导入影响摘要、警告和冲突也集中在准备阶段
- `takeover` 的真正导入触发从旧的开始阶段移到准备阶段尾部
- 日志和高级诊断折叠到次级区域
- 中途退出只允许中断，不允许完成 setup

- [ ] **Step 5: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx src/pages/Setup/index.tsx tests/unit/setup-wizard-layout.test.tsx
git commit -m "feat: split setup start and preparation stages"
```

## Task 4：拆分模型接入与完成阶段

**Files:**

- Create: `src/components/setup/SetupProviderStage.tsx`
- Create: `src/components/setup/SetupCompleteStage.tsx`
- Modify: `src/pages/Setup/index.tsx`
- Test: `tests/unit/setup-wizard-flow.test.ts`

- [ ] **Step 1: 写失败测试，锁定 provider 与 complete 的新边界**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Setup } from '@/pages/Setup';

it('keeps provider review inside the provider stage and removes global skip-complete behavior', async () => {
  const user = userEvent.setup();
  render(<Setup />);

  expect(screen.queryByRole('button', { name: '跳过设置' })).not.toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: '继续' }));
  expect(screen.getByText('模型与接入')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts`

Expected: FAIL because old installing step is still present

- [ ] **Step 3: 拆出模型接入阶段**

要求：

- provider 选择、字段、OAuth、手动 code 兜底都进入 `SetupProviderStage`
- `providerReview` 合并进同一顶层阶段，不再单独占一个顶层步骤
- `takeover` 在已有可用接入时优先展示“复用已有接入”的确认态
- 校验反馈靠近主 CTA
- OAuth 手动 code、长错误、文档外链等高级信息默认收进次级区域，不打断主路径

- [ ] **Step 4: 拆出完成阶段**

要求：

- `InstallingContent` 改造成 `complete.applying` 子状态
- 完成摘要与最终进入应用按钮进入 `complete.summary`
- 完成阶段统一承接 skills 安装进度和最终摘要
- 只有 `complete.summary` 的主按钮允许触发 `completeSetupSession`
- `complete.applying` 关闭窗口需要二次确认，且确认后也不得写入 `setupComplete`

- [ ] **Step 5: 重新运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/setup/SetupProviderStage.tsx src/components/setup/SetupCompleteStage.tsx src/pages/Setup/index.tsx tests/unit/setup-wizard-flow.test.ts
git commit -m "feat: split setup provider and completion stages"
```

## Task 5：验证与文档收口

**Files:**

- Modify: `docs/setup-wizard-refresh/progress.md`
- Modify: `docs/setup-wizard-refresh/testing.md`
- Modify: `docs/global-theme-refresh/progress.md`
- Modify: `docs/global-theme-refresh/testing.md`
- Test: `tests/unit/setup-wizard-layout.test.tsx`
- Test: `tests/unit/setup-wizard-flow.test.ts`

- [ ] **Step 1: 跑页面重构相关验证**

Run: `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/*.tsx tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts --max-warnings=0`

Expected: PASS

- [ ] **Step 2: 跑阶段与布局测试**

Run: `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts`

Expected: PASS

- [ ] **Step 3: 跑 Setup 现有接管回归**

Run: `pnpm exec vitest run tests/unit/setup-takeover.test.tsx`

Expected: PASS with takeover still forced through completion summary
- [ ] **Step 4: 跑类型检查**

Run: `pnpm run typecheck`

Expected: PASS

- [ ] **Step 5: 跑构建**

Run: `pnpm run build:vite`

Expected: PASS with only pre-existing Vite chunk warnings

- [ ] **Step 6: 记录跨平台手工验收**

要求：

- 记录 mac 下的步骤轨、内容区、底部操作栏是否符合桌面向导感
- 记录 Windows 下边界、按钮层级、窗口缩放时的稳定性
- 记录 `complete.applying` 关闭窗口二次确认行为

- [ ] **Step 7: 同步文档**

要求：

- 更新 `docs/setup-wizard-refresh/progress.md`
- 更新 `docs/setup-wizard-refresh/testing.md`
- 更新 `docs/global-theme-refresh/progress.md`
- 更新 `docs/global-theme-refresh/testing.md`
- 明确 `Setup` 结构级重构是否完成，以及全局主题是否达到收口条件
- 明确 mac / Windows 手工验收是否都完成
- [ ] **Step 8: 提交**

```bash
git add src/pages/Setup/index.tsx src/components/setup/*.tsx tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts docs/setup-wizard-refresh/progress.md docs/setup-wizard-refresh/testing.md docs/global-theme-refresh/progress.md docs/global-theme-refresh/testing.md
git commit -m "feat: rebuild setup as desktop onboarding wizard"
```
