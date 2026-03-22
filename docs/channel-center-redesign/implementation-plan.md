# 频道中心入口板重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将频道页默认模式从“默认两栏工作台”切换为“入口卡片板”，并在选中频道后进入聚焦编辑态，只有超宽工作区才升级为完整三栏，同时保持现有保存、验证、默认账号、绑定 Agent 与高级字段链路不回退。

**Architecture:** 保留现有 `host-api -> electron routes -> channel-config` 主链和 `editor-values` 回填链，不新造后端协议。前端新增一层纯布局契约，先用容器宽度和当前上下文计算 `board / focus / workbench` 三种模式，再拆出入口卡片板、聚焦编辑态和超宽三栏骨架，复用同一套账号列表与编辑器组件。

**Tech Stack:** React 19、TypeScript、Vite、Electron、Vitest、Playwright、ESLint、i18next、现有 `host-api` / `channel-registry` / `channel-config` 工具链

---

## 文件结构

### 预计新增

- `src/lib/channel-center-layout.ts`
- `src/components/channels/ChannelEntryBoard.tsx`
- `src/components/channels/ChannelEntryCard.tsx`
- `src/components/channels/ChannelFocusWorkspace.tsx`
- `src/components/channels/ChannelAccountList.tsx`
- `src/components/channels/ChannelConfigEditor.tsx`
- `tests/unit/channel-center-layout.test.ts`

### 预计修改

- `src/pages/Channels/index.tsx`
- `tests/unit/channels-page.test.tsx`
- `tests/e2e/channels.spec.ts`
- `docs/channel-center-redesign/progress.md`
- `docs/channel-center-redesign/testing.md`
- `docs/channel-center-redesign/issues.md`

## Task 1：锁定布局状态机与断点契约

**Files:**

- Create: `src/lib/channel-center-layout.ts`
- Test: `tests/unit/channel-center-layout.test.ts`
- Modify: `docs/channel-center-redesign/design.md`

- [ ] **Step 1: 写布局契约失败测试**

覆盖：

- `board` 模式下的 `1 / 2 / 3 / 4` 列卡片断点
- 卡片最小可读宽度 `264px`
- 没有选中上下文时，超宽也不自动跳入三栏
- 已有选中上下文时，约 `1600px+` 才进入 `workbench`
- 从宽到窄时优先退到 `focus`，不直接丢回 `board`

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channel-center-layout.test.ts`

- [ ] **Step 3: 实现纯布局契约**

要求：

- 只做纯函数，不读 DOM，不耦合 React
- 显式导出布局模式、列数和阈值常量
- 不把断点散落到组件里硬编码

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channel-center-layout.test.ts`

- [ ] **Step 5: 提交**

```bash
git add src/lib/channel-center-layout.ts tests/unit/channel-center-layout.test.ts docs/channel-center-redesign/design.md
git commit -m "feat: add channel center layout contract"
```

## Task 2：把频道页首屏切到入口卡片板

**Files:**

- Create: `src/components/channels/ChannelEntryBoard.tsx`
- Create: `src/components/channels/ChannelEntryCard.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 写入口板失败测试**

覆盖：

- 首次进入频道页时默认显示入口卡片板
- 默认窗口下不自动钻进任一频道编辑态
- 已配置和待添加分组同时存在
- 单个频道卡片显示名称、品牌图标、主动作、摘要状态、呼吸灯
- 点击卡片主动作后进入该频道

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx -t "entry board|default board mode"`

- [ ] **Step 3: 实现入口卡片板**

要求：

- 入口板由独立组件承载，不继续把卡片 UI 写回 `index.tsx`
- 卡片摘要只显示聚合信息，不塞账号编辑细节
- 已配置卡片主状态为 `已配置`
- 未配置卡片显示最关键接入方式，例如 `二维码`、`令牌`、`Webhook`
- 最右侧状态呼吸灯必须保留

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx -t "entry board|default board mode"`

- [ ] **Step 5: 提交**

```bash
git add src/components/channels/ChannelEntryBoard.tsx src/components/channels/ChannelEntryCard.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: add channel entry board"
```

## Task 3：抽出聚焦编辑态骨架

**Files:**

- Create: `src/components/channels/ChannelFocusWorkspace.tsx`
- Create: `src/components/channels/ChannelAccountList.tsx`
- Create: `src/components/channels/ChannelConfigEditor.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 写聚焦编辑态失败测试**

覆盖：

- 从入口板进入频道后显示“返回全部频道”
- 左侧只显示当前频道的账号列表
- 右侧继续显示基础配置、通用行为、高级分组
- 未保存修改时切换账号仍会拦截
- 新增账号后仍自动落到新账号

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx -t "focus workspace|returns to board|unsaved changes"`

- [ ] **Step 3: 实现聚焦编辑态与组件抽取**

要求：

- 先抽出当前 `index.tsx` 里的账号列表和编辑器，不改保存协议
- `focus` 模式优先保证编辑区宽度，不继续保留全量频道导航
- 复用现有 `channel-registry`、`editor-values`、默认账号、绑定 Agent 逻辑
- 不因为抽组件而改坏微信、飞书、企微等已有专属流程

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx -t "focus workspace|returns to board|unsaved changes"`

- [ ] **Step 5: 提交**

```bash
git add src/components/channels/ChannelFocusWorkspace.tsx src/components/channels/ChannelAccountList.tsx src/components/channels/ChannelConfigEditor.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: add channel focus workspace"
```

## Task 4：接入超宽三栏模式与上下文保留

**Files:**

- Modify: `src/pages/Channels/index.tsx`
- Modify: `src/components/channels/ChannelFocusWorkspace.tsx`
- Test: `tests/unit/channels-page.test.tsx`
- Test: `tests/unit/channel-center-layout.test.ts`

- [ ] **Step 1: 写超宽三栏失败测试**

覆盖：

- 容器达到阈值且已有选中上下文时，页面切到 `workbench`
- 入口板放大但无选中上下文时，仍停留在 `board`
- 三栏收窄时先回到 `focus`
- 缩放前的选中频道、选中账号和未保存输入不会丢失

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channel-center-layout.test.ts tests/unit/channels-page.test.tsx -t "workbench mode|keeps context on resize"`

- [ ] **Step 3: 实现超宽三栏模式**

要求：

- 容器宽度监听必须集中在页面层，不散落到各个子组件
- 三栏只在 `channel rail + account list + editor` 三块都可读时出现
- `board -> focus -> workbench` 和 `workbench -> focus` 切换都保留当前上下文
- 不依赖窗口是否最大化，不依赖浏览器 zoom 推断布局

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channel-center-layout.test.ts tests/unit/channels-page.test.tsx -t "workbench mode|keeps context on resize"`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Channels/index.tsx src/components/channels/ChannelFocusWorkspace.tsx tests/unit/channel-center-layout.test.ts tests/unit/channels-page.test.tsx
git commit -m "feat: add responsive channel center modes"
```

## Task 5：补齐端到端 smoke 与视觉回归约束

**Files:**

- Modify: `tests/e2e/channels.spec.ts`
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `docs/channel-center-redesign/testing.md`

- [ ] **Step 1: 写端到端与视觉约束失败用例**

覆盖：

- 默认窗口下看到入口卡片板
- 默认窗口下稳定展示 `3-4` 张卡片并排，而不是一列长条
- 点击卡片进入聚焦编辑态
- 超宽时仅在已有上下文下展开三栏
- 共享 Select、状态灯、返回入口板链路不回退

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`
Run: `pnpm run test:e2e -- tests/e2e/channels.spec.ts`

- [ ] **Step 3: 实现最小修正直到通过**

要求：

- 先改测试暴露的问题，再改实现，不一次性同时推太多视觉细节
- Playwright 只锁高价值路径，不把像素级视觉判断塞进 smoke
- 单测继续约束布局模式和关键文案，不靠截图回归

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`
Run: `pnpm run test:e2e -- tests/e2e/channels.spec.ts`

- [ ] **Step 5: 提交**

```bash
git add tests/unit/channels-page.test.tsx tests/e2e/channels.spec.ts docs/channel-center-redesign/testing.md
git commit -m "test: cover channel center entry board flow"
```

## Task 6：收口验证与文档同步

**Files:**

- Modify: `docs/channel-center-redesign/progress.md`
- Modify: `docs/channel-center-redesign/issues.md`
- Modify: `docs/channel-center-redesign/testing.md`

- [ ] **Step 1: 同步文档状态**

要求：

- `progress.md` 标记入口板、聚焦编辑态、三栏切换的真实落地状态
- `issues.md` 关闭已解决的旧“两栏默认态”问题，补充剩余观察项
- `testing.md` 记录实际跑过的命令与手工 smoke 结果

- [ ] **Step 2: 运行完整验证**

Run: `pnpm exec eslint src/pages/Channels/index.tsx src/components/channels/ChannelEntryBoard.tsx src/components/channels/ChannelEntryCard.tsx src/components/channels/ChannelFocusWorkspace.tsx src/components/channels/ChannelAccountList.tsx src/components/channels/ChannelConfigEditor.tsx src/lib/channel-center-layout.ts tests/unit/channel-center-layout.test.ts tests/unit/channels-page.test.tsx tests/e2e/channels.spec.ts --max-warnings=0`
Run: `pnpm run typecheck`
Run: `pnpm exec vitest run tests/unit/channel-center-layout.test.ts tests/unit/channels-page.test.tsx`
Run: `pnpm run build:vite`
Run: `pnpm run test:e2e -- tests/e2e/channels.spec.ts`

- [ ] **Step 3: 记录验证结果**

要求：

- 只记录真实跑过的命令
- 如果某项因为环境原因未跑，必须写明原因和风险

- [ ] **Step 4: 提交**

```bash
git add docs/channel-center-redesign/progress.md docs/channel-center-redesign/issues.md docs/channel-center-redesign/testing.md src/pages/Channels/index.tsx src/components/channels/ChannelEntryBoard.tsx src/components/channels/ChannelEntryCard.tsx src/components/channels/ChannelFocusWorkspace.tsx src/components/channels/ChannelAccountList.tsx src/components/channels/ChannelConfigEditor.tsx src/lib/channel-center-layout.ts tests/unit/channel-center-layout.test.ts tests/unit/channels-page.test.tsx tests/e2e/channels.spec.ts
git commit -m "feat: redesign channel center entry flow"
```
