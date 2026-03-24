# 失败测试修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复当前单元测试失败，优先处理已确认根因的实现回归与测试契约漂移。

**Architecture:** 先按失败聚类锁定根因，再用现有失败测试作为红灯，做最小改动恢复既有契约。优先修复公共入口与核心路由问题，最后处理 UI 结构类回归并做分组回归。

**Tech Stack:** Vitest、React 19、Electron、TypeScript

---

### 任务 1：修复高置信实现回归

**Files:**
- Modify: `src/components/layout/TitleBar.tsx`
- Modify: `electron/api/routes/logs.ts`
- Test: `tests/unit/setup-page-i18n.test.tsx`
- Test: `tests/unit/setup-takeover.test.tsx`
- Test: `tests/unit/log-routes.test.ts`

- [ ] 使用现有失败测试确认 `TitleBar` 与 `logs` 路由问题仍可复现
- [ ] 修改 `TitleBar`，在无 Router 上下文时提供安全回退
- [ ] 修改 `logs` 路由，恢复与测试 mock 一致的 `fs/promises` 调用方式
- [ ] 回归对应测试子集，确认失败已转绿

### 任务 2：修复 setup/app 路由测试 mock 漂移

**Files:**
- Modify: `tests/unit/app-routes.test.ts`
- Modify: `tests/unit/setup-activation.test.ts`
- Test: `tests/unit/app-routes.test.ts`
- Test: `tests/unit/setup-activation.test.ts`

- [ ] 使用现有失败测试确认 mock 缺口与新依赖一致
- [ ] 为 `buildSetupPlan`、`getAllSettings`、`replaceAllSettings` 补齐最小 mock
- [ ] 回归 setup/app 测试子集

### 任务 3：统一 recipient hint 契约

**Files:**
- Modify: `tests/unit/channel-config.test.ts`
- Modify: `tests/unit/channel-routes.test.ts`
- Modify: `tests/unit/cron-agent-targeting.test.tsx`
- Test: `tests/unit/channel-config.test.ts`
- Test: `tests/unit/channel-routes.test.ts`
- Test: `tests/unit/cron-agent-targeting.test.tsx`

- [ ] 对照 `electron/utils/channel-config.ts` 与 `src/pages/Cron/index.tsx` 确认当前契约
- [ ] 将过期测试从旧字段 `pairingAllowFrom/pairingRecipientId` 更新为当前 `hint.reason/recipientId`
- [ ] 回归 channel 与 cron 定向测试

### 任务 4：处理剩余 UI 结构类失败

**Files:**
- Modify: `tests/unit/chat-slash-actions.test.tsx`
- Modify: `tests/unit/chat-render-stability.test.tsx`
- Modify: `tests/unit/workbench-style-unification.test.tsx`
- Modify: `tests/unit/theme-second-wave-pages.test.ts`
- Modify: `src/pages/Cron/index.tsx`
- Test: 对应测试文件

- [ ] 逐个确认是实现回归还是测试断言过时
- [ ] 保持当前产品行为前提下修复最小范围断言或缺失标记
- [ ] 回归 UI 相关测试子集

### 任务 5：最终验证

**Files:**
- Test: `pnpm exec vitest run ...`
- Test: `pnpm test`

- [ ] 先跑受影响测试子集
- [ ] 再跑全量测试，确认没有新增回归
