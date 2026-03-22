# 微信登录 QClaw 对齐实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将微信二维码登录改成与 QClaw 同模型的 `start / poll / cancel` 流程，消除当前事件推送链路带来的二维码乱跳与网关误重启问题。

**Architecture:** 主进程直接请求 `ilink` 二维码接口并维护登录会话，前端只负责展示二维码与轮询状态，不再依赖 `xclaw.weixin.login.start / wait` 的后台阻塞式桥接。登录成功后主进程按官方插件状态文件格式写入账号凭据，再刷新 Gateway 让官方插件消费最终状态。

**Tech Stack:** Electron Main、Host API、React 19、Vitest、官方微信插件状态文件格式

---

### Task 1: 固化新协议测试

**Files:**
- Modify: `tests/unit/weixin-login.test.ts`
- Modify: `tests/unit/channel-routes.test.ts`
- Modify: `tests/unit/channel-config-modal.test.tsx`

- [ ] **Step 1: 写失败测试**

覆盖三件事：

1. `weixinLoginManager.start()` 立即返回 `qrcodeUrl + sessionKey`
2. `weixinLoginManager.poll()` 返回 `wait / scaned / confirmed / expired`
3. `ChannelConfigModal` 对微信走 `/start -> /poll -> /cancel`，不再订阅 `channel:weixin-*`

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/weixin-login.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-config-modal.test.tsx`

Expected: FAIL，失败点明确指向旧事件流与旧返回结构。

### Task 2: 重写主进程微信登录服务

**Files:**
- Modify: `electron/utils/weixin-login.ts`
- Modify: `electron/api/routes/channels.ts`

- [ ] **Step 1: 用最小实现替换旧后台 wait 模型**

主进程提供：

1. `start(ctx, { accountId?, force? })`
2. `poll(ctx, { sessionKey })`
3. `stop(sessionKey?)`

要求：

1. `start` 直接拉取二维码并返回，不阻塞等待扫码
2. `poll` 只查当前二维码状态
3. `confirmed` 后落盘账号状态并刷新 Gateway

- [ ] **Step 2: 运行主进程相关测试**

Run: `pnpm test tests/unit/weixin-login.test.ts tests/unit/channel-routes.test.ts`

Expected: PASS

### Task 3: 重构微信弹窗交互

**Files:**
- Modify: `src/components/channels/ChannelConfigModal.tsx`

- [ ] **Step 1: 改为本地轮询模型**

要求：

1. 微信不再订阅 `channel:weixin-*`
2. 点击按钮调用 `/api/channels/weixin/start`
3. 保存 `sessionKey` 并定时调用 `/api/channels/weixin/poll`
4. `expired` 时重新发起 `start`
5. 关闭弹窗时调用 `/api/channels/weixin/cancel`

- [ ] **Step 2: 运行前端相关测试**

Run: `pnpm test tests/unit/channel-config-modal.test.tsx`

Expected: PASS

### Task 4: 文档与回归验证

**Files:**
- Modify: `docs/weixin-channel/design.md`
- Modify: `docs/weixin-channel/issues.md`
- Modify: `docs/weixin-channel/progress.md`
- Modify: `docs/weixin-channel/testing.md`

- [ ] **Step 1: 更新文档**

把“微信登录桥接”从旧的 Gateway method + host event 描述，更新成 QClaw 对齐的主进程直连 `ilink` + 前端轮询模型。

- [ ] **Step 2: 运行回归验证**

Run: `pnpm test tests/unit/weixin-login.test.ts tests/unit/channel-routes.test.ts tests/unit/channel-config-modal.test.tsx`

Run: `pnpm run build:vite`

Expected: 全部通过
