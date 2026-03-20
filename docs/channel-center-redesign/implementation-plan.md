# 频道中心重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将频道页重构为统一三栏工作台，并基于 OpenClaw 真实配置契约接入首批已闭环字段。

**Architecture:** 保留现有 host-api 与 `channel-config` 保存链路，先建立“字段 -> OpenClaw 路径 / 路由 / 回填方式”的契约表，再由 registry 驱动字段分层与可见性。默认账号、渠道启停和 Agent 绑定作为通用行为控件处理，不混入普通配置字段 schema；未证明可 round-trip 的结构化高级字段不进入 v1。

**Tech Stack:** React 19、TypeScript、Vite、Electron、Vitest、ESLint、i18next、现有 host-api / channel-config 工具链

---

## 文件结构

### 预计新增

- `src/lib/channel-registry.ts`
- `src/components/channels/ChannelWorkbench.tsx`
- `src/components/channels/ChannelTypeRail.tsx`
- `src/components/channels/ChannelAccountList.tsx`
- `src/components/channels/ChannelConfigEditor.tsx`
- `src/components/channels/ChannelFieldRenderer.tsx`
- `src/components/channels/ChannelAdvancedSection.tsx`
- `tests/unit/channel-registry.test.ts`
- `tests/unit/channels-page.test.tsx`

### 预计修改

- `src/pages/Channels/index.tsx`
- `src/components/channels/ChannelConfigModal.tsx`
- `src/types/channel.ts`
- `src/i18n/locales/zh/channels.json`
- `src/i18n/locales/en/channels.json`
- `src/i18n/locales/ja/channels.json`
- `electron/utils/channel-config.ts`
- `electron/api/routes/channels.ts`
- `tests/unit/channel-config.test.ts`

## Task 1：建立 OpenClaw 字段契约表

**Files:**

- Create: `src/lib/channel-registry.ts`
- Modify: `docs/channel-center-redesign/design.md`
- Test: `tests/unit/channel-registry.test.ts`

- [ ] **Step 1: 写字段契约测试**

覆盖：

- 每个 v1 字段都声明真实 `storagePath` 或动作路由
- 每个字段都声明 `readStrategy` 与 `writeStrategy`
- 行为控件不会混入普通配置字段列表

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channel-registry.test.ts`

- [ ] **Step 3: 实现 registry 契约表**

要求：

- 所有字段必须绑定真实 OpenClaw 配置路径或真实动作接口
- 每个字段必须标注证据来源
- 每个字段必须标注 `evidenceLevel`
- 去掉没有证据的 v1 字段

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channel-registry.test.ts`

- [ ] **Step 5: 提交**

```bash
git add src/lib/channel-registry.ts docs/channel-center-redesign/design.md tests/unit/channel-registry.test.ts
git commit -m "feat: add channel field contract registry"
```

## Task 2：重构字段模型

**Files:**

- Modify: `src/types/channel.ts`
- Test: `tests/unit/channel-registry.test.ts`

- [ ] **Step 1: 写字段分层测试**

覆盖：

- 每个重点渠道都有基础字段
- 已闭环字段和待适配字段不会混用
- 行为控件与普通字段彻底分离

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channel-registry.test.ts`

- [ ] **Step 3: 实现 registry 与类型升级**

要求：

- `ChannelMeta` 支持分层字段模型
- 展示元数据与编辑 schema 解耦
- 字段元数据支持 `secret`、`options`、`visibleWhen`
- 通用行为控件与普通配置字段分离建模
- 只纳入已在契约表中批准的 v1 字段
- `upstream-plugin-only` 字段不能进入 v1 渲染列表

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channel-registry.test.ts`

- [ ] **Step 5: 提交**

```bash
git add src/lib/channel-registry.ts src/types/channel.ts tests/unit/channel-registry.test.ts
git commit -m "feat: add channel config registry"
```

## Task 3：搭建三栏工作台骨架

**Files:**

- Create: `src/components/channels/ChannelWorkbench.tsx`
- Create: `src/components/channels/ChannelTypeRail.tsx`
- Create: `src/components/channels/ChannelAccountList.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 写页面联动测试**

覆盖：

- 左栏选择渠道后，中栏和右栏联动
- 中栏选择账号后，编辑器切换对象
- 页面存在统一新增频道入口

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 3: 实现工作台骨架**

要求：

- 页面不再以 modal 为主路径
- 左栏、中栏、右栏职责清晰
- 保持现有状态拉取与 gateway 事件刷新

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Channels/index.tsx src/components/channels/ChannelWorkbench.tsx src/components/channels/ChannelTypeRail.tsx src/components/channels/ChannelAccountList.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: add channel workbench layout"
```

## Task 4：实现右栏编辑器与通用字段渲染

**Files:**

- Create: `src/components/channels/ChannelConfigEditor.tsx`
- Create: `src/components/channels/ChannelFieldRenderer.tsx`
- Create: `src/components/channels/ChannelAdvancedSection.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Modify: `src/i18n/locales/zh/channels.json`
- Modify: `src/i18n/locales/en/channels.json`
- Modify: `src/i18n/locales/ja/channels.json`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 补编辑器交互测试**

覆盖：

- 基础配置默认展开
- 通用高级默认折叠并显示摘要
- 专属高级按分组展开

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 3: 实现编辑器**

要求：

- 通用字段统一渲染
- 高级区折叠
- 策略字段带说明
- 保存区固定在编辑器底部
- 仅渲染契约表批准的已闭环字段

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/components/channels/ChannelConfigEditor.tsx src/components/channels/ChannelFieldRenderer.tsx src/components/channels/ChannelAdvancedSection.tsx src/pages/Channels/index.tsx src/i18n/locales/zh/channels.json src/i18n/locales/en/channels.json src/i18n/locales/ja/channels.json tests/unit/channels-page.test.tsx
git commit -m "feat: add channel config editor"
```

## Task 5：接入保存、验证、默认账号、渠道启停与 Agent 绑定

**Files:**

- Modify: `src/pages/Channels/index.tsx`
- Modify: `electron/api/routes/channels.ts`
- Modify: `electron/utils/channel-config.ts`
- Modify: `tests/unit/channel-config.test.ts`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 写保存链路回归测试**

覆盖：

- 保存配置后刷新回填正确
- 渠道启停切换正确
- 默认账号切换正确
- Agent 绑定变更正确
- 删除账号后选中态回退合理

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx`

- [ ] **Step 3: 接入工作台保存链**

要求：

- 优先复用现有 API
- 不新增大规模后端协议
- 仅在必要处补最小辅助逻辑
- 先接通字符串字段和现有特殊映射字段
- 若某结构化高级字段需要暴露，必须先补 `channel-config.ts` round-trip 适配与测试

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/pages/Channels/index.tsx electron/api/routes/channels.ts electron/utils/channel-config.ts tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx
git commit -m "feat: wire channel workbench actions"
```

## Task 6：将旧 modal 降级为兼容壳

**Files:**

- Modify: `src/components/channels/ChannelConfigModal.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: 写兼容路径测试**

覆盖：

- 页面主流程不再主动打开 modal
- 旧调用路径仍可渲染并完成基础保存

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 3: 收缩 modal 职责**

要求：

- 不再承担主页面新增 / 编辑
- 保留特殊流程或兼容入口

- [ ] **Step 4: 再次运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx`

- [ ] **Step 5: 提交**

```bash
git add src/components/channels/ChannelConfigModal.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "refactor: demote channel config modal"
```

## Task 7：完整验证与文档同步

**Files:**

- Modify: `docs/channel-center-redesign/testing.md`
- Modify: `docs/channel-center-redesign/issues.md`
- Modify: `docs/channel-center-redesign/progress.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`

- [ ] **Step 1: 跑完整验证**

Run:

- `pnpm exec eslint src/pages/Channels/index.tsx src/components/channels/*.tsx src/lib/channel-registry.ts src/types/channel.ts electron/api/routes/channels.ts electron/utils/channel-config.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-config.test.ts`
- `pnpm run build:vite`

- [ ] **Step 2: 更新文档**

要求：

- 补实现结果、残余问题、验证证据
- 如行为有变化，同步三份 README

- [ ] **Step 3: 提交**

```bash
git add docs/channel-center-redesign README.md README.zh-CN.md README.ja-JP.md
git commit -m "docs: finalize channel center redesign"
```
