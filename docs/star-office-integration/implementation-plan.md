# Star Office 集成实现计划

> **给执行型 agent 的说明：** 必须使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务顺序推进。本文档使用 `- [ ]` 复选框跟踪状态。

**目标：** 在 XClaw 内落地全局只读工作室，包含最小化 vendored runtime、主进程托管 sidecar、主进程状态快照同步，以及 `AGENTS.md` 幂等注入。

**架构：** 实现分三层推进。第一层把 `Star-Office-UI` 裁成可提交到仓库的最小 runtime，并固定运行时与数据目录解析；第二层在主进程新增 `studio` 管理层，负责 Python readiness、sidecar 生命周期、状态快照与提示词注入；第三层在 renderer 新增 `/studio` 页面和标题栏右上角工作室入口。`studioPort` 直接放进 `electron-store`，不再额外引入第二份运行配置文件。

**技术栈：** Electron Main/Preload、React 19、Vite、TypeScript、Python/Flask、electron-store、Vitest

---

## 文件结构

### 新增目录

- `resources/star-office-runtime/`
  - 提交最小化 vendored runtime
  - 包含只读补丁后的 `backend/`、`frontend/` 与必要静态资源
- `electron/studio/`
  - 主进程工作室能力边界
  - 只放路径解析、runtime 管理、状态快照、提示词注入与 service 聚合
- `src/pages/Studio/`
  - `/studio` 页面

### 新增文件

- `/Users/jianglong/workspace/XClaw/scripts/vendor-star-office-runtime.mjs`
- `/Users/jianglong/workspace/XClaw/scripts/star-office-runtime.manifest.json`
- `/Users/jianglong/workspace/XClaw/electron/studio/paths.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/types.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/python-env.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/state-store.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/prompt-injector.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/state-manager.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/runtime-manager.ts`
- `/Users/jianglong/workspace/XClaw/electron/studio/service.ts`
- `/Users/jianglong/workspace/XClaw/electron/api/routes/studio.ts`
- `/Users/jianglong/workspace/XClaw/src/lib/studio.ts`
- `/Users/jianglong/workspace/XClaw/src/pages/Studio/index.tsx`
- `/Users/jianglong/workspace/XClaw/src/types/studio.ts`
- `/Users/jianglong/workspace/XClaw/src/i18n/locales/en/studio.json`
- `/Users/jianglong/workspace/XClaw/src/i18n/locales/zh/studio.json`
- `/Users/jianglong/workspace/XClaw/src/i18n/locales/ja/studio.json`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-paths.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-python-env.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-state-store.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-prompt-injector.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-runtime-manager.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-state-manager.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-routes.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/studio-page.test.tsx`

### 重点修改文件

- `/Users/jianglong/workspace/XClaw/electron/main/index.ts`
- `/Users/jianglong/workspace/XClaw/electron/main/setup-activation.ts`
- `/Users/jianglong/workspace/XClaw/electron/api/context.ts`
- `/Users/jianglong/workspace/XClaw/electron/api/server.ts`
- `/Users/jianglong/workspace/XClaw/electron/api/routes/agents.ts`
- `/Users/jianglong/workspace/XClaw/electron/utils/store.ts`
- `/Users/jianglong/workspace/XClaw/electron/preload/index.ts`
- `/Users/jianglong/workspace/XClaw/src/App.tsx`
- `/Users/jianglong/workspace/XClaw/src/lib/host-events.ts`
- `/Users/jianglong/workspace/XClaw/src/i18n/index.ts`
- `/Users/jianglong/workspace/XClaw/src/pages/Chat/index.tsx`
- `/Users/jianglong/workspace/XClaw/tests/unit/runtime-refresh-routes.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/setup-activation.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/chat-layout.test.tsx`
- `/Users/jianglong/workspace/XClaw/README.md`
- `/Users/jianglong/workspace/XClaw/README.zh-CN.md`
- `/Users/jianglong/workspace/XClaw/README.ja-JP.md`
- `/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`
- `/Users/jianglong/workspace/XClaw/docs/star-office-integration/testing.md`

## 实施约束

- 工作室入口放在标题栏右上角现有工具区，不改原生窗口 chrome。
- `studioPort` 持久化进 `electron-store`，不再新增 `runtime-config.json`。
- renderer 不直接拼 `localhost` 地址，不直接新增裸 `window.electron.ipcRenderer.invoke(...)`。
- 本地 agent 不直接写 `state.json` 或 `agents-state.json`。
- v1 不扩展市场安装、装修入口、单 agent 聚焦模式。

### 任务 1：落地最小 vendored runtime 与路径解析

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/scripts/vendor-star-office-runtime.mjs`
- 新建：`/Users/jianglong/workspace/XClaw/scripts/star-office-runtime.manifest.json`
- 新建：`/Users/jianglong/workspace/XClaw/resources/star-office-runtime/`
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/paths.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-paths.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：先写失败测试，覆盖 dev/packaged 两种模式下 runtime 目录、data 目录与必需文件清单解析。
- [ ] 第 2 步：运行测试，确认先失败。
  - 运行：`pnpm test tests/unit/studio-paths.test.ts`
- [ ] 第 3 步：写 `star-office-runtime.manifest.json`，明确允许进入仓库的上游文件清单。
- [ ] 第 4 步：实现 `vendor-star-office-runtime.mjs`，从 `/Users/jianglong/workspace/Star-Office-UI` 导入 allowlist 资源到 `resources/star-office-runtime/`，并执行一次导入后把结果提交进仓库。
- [ ] 第 5 步：实现 `electron/studio/paths.ts`，只负责解析只读 runtime 路径、用户数据目录、快照目录与 `last-known-good` 目录。
- [ ] 第 6 步：再次运行测试，确认通过。
  - 运行：`pnpm test tests/unit/studio-paths.test.ts`
- [ ] 第 7 步：更新 `progress.md` 并提交。
  - 提交：`git commit -m "chore: vendor star office runtime"`

### 任务 2：实现 Python readiness 分层判定与 runtime 管理器

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/types.ts`
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/python-env.ts`
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/runtime-manager.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/utils/store.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/main/index.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-python-env.test.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-runtime-manager.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：先写失败测试，覆盖三层 readiness、`studioPort` 复用与冲突回退、`runtimeInstanceId` 刷新和非阻塞启动。
- [ ] 第 2 步：运行测试，确认先失败。
  - 运行：`pnpm test tests/unit/studio-python-env.test.ts tests/unit/studio-runtime-manager.test.ts`
- [ ] 第 3 步：在 `store.ts` 增加 `studioPort` 设置项、默认值与兼容迁移，不向 renderer 公开端口选择逻辑。
- [ ] 第 4 步：实现 `python-env.ts`，拆出解释器检测、依赖安装检测、readonly smoke test 三层判断。
- [ ] 第 5 步：实现 `runtime-manager.ts`，负责端口探测、启动 Flask sidecar、健康检查、重试、停止、快照生成与 `runtimeInstanceId` 更新。
- [ ] 第 6 步：在 `electron/main/index.ts` 中接入 runtime manager，要求 setup 完成后后台启动，但不得阻塞主窗口 ready。
- [ ] 第 7 步：再次运行测试，确认通过。
  - 运行：`pnpm test tests/unit/studio-python-env.test.ts tests/unit/studio-runtime-manager.test.ts`
- [ ] 第 8 步：更新 `progress.md` 并提交。
  - 提交：`git commit -m "feat: add studio runtime manager"`

### 任务 3：实现共享快照 schema、原子写入与回退

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/state-store.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/studio/types.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-state-store.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：先写失败测试，覆盖 `state.json`、`agents-state.json`、`manifest.json` 的同代提交、schema 校验与 `last-known-good` 回退。
- [ ] 第 2 步：运行测试，确认先失败。
  - 运行：`pnpm test tests/unit/studio-state-store.test.ts`
- [ ] 第 3 步：在 `types.ts` 中固化 v1 schema、状态枚举、`detailSource` 枚举和 runtime 快照类型。
- [ ] 第 4 步：实现 `state-store.ts`，提供读取、提交、校验、回退和 generation 递增能力，禁止混读不同代文件。
- [ ] 第 5 步：再次运行测试，确认通过。
  - 运行：`pnpm test tests/unit/studio-state-store.test.ts`
- [ ] 第 6 步：更新 `progress.md` 并提交。
  - 提交：`git commit -m "feat: add studio snapshot store"`

### 任务 4：实现 `AGENTS.md` 注入器并接入 setup / 新建 agent

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/prompt-injector.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/main/setup-activation.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/api/routes/agents.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/stores/agents.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/pages/Agents/index.tsx`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-prompt-injector.test.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/setup-activation.test.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/runtime-refresh-routes.test.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/agent-create-warning.test.tsx`
- 文档：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：先写失败测试，覆盖完整标记块跳过、缺失块注入、单边标记报损坏，以及 fresh setup、takeover、工作台新增 agent 三条链路复用同一注入器。
- [ ] 第 2 步：运行测试，确认先失败。
  - 运行：`pnpm test tests/unit/studio-prompt-injector.test.ts tests/unit/setup-activation.test.ts tests/unit/runtime-refresh-routes.test.ts`
- [ ] 第 3 步：实现 `prompt-injector.ts`，只处理 `AGENTS.md`，不碰 `SOUL.md`，不自动覆盖完整块。
- [ ] 第 4 步：在 `runSetupActivationSideEffects` 中接入主工作区注入，fresh 与 takeover 共用同一入口。
- [ ] 第 5 步：在 `/api/agents` 创建成功后接入新 agent 工作区注入；如果注入失败，agent 仍创建成功，但接口必须返回可显示的 warning，便于工作台给出明确提示。
- [ ] 第 6 步：调整 `src/stores/agents.ts` 与 `src/pages/Agents/index.tsx`，让新增 agent 的 warning 能以 toast 或页内提示显式呈现。
- [ ] 第 7 步：再次运行测试，确认通过。
  - 运行：`pnpm test tests/unit/studio-prompt-injector.test.ts tests/unit/setup-activation.test.ts tests/unit/runtime-refresh-routes.test.ts`
- [ ] 第 8 步：补充 warning UI 单测，确认工作台不会静默吞掉注入失败。
  - 运行：`pnpm test tests/unit/agent-create-warning.test.tsx`
- [ ] 第 9 步：更新 `progress.md` 并提交。
  - 提交：`git commit -m "feat: inject studio prompt on setup and agent create"`

### 任务 5：实现主进程 StudioService、状态映射与 host-api 路由

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/state-manager.ts`
- 新建：`/Users/jianglong/workspace/XClaw/electron/studio/service.ts`
- 新建：`/Users/jianglong/workspace/XClaw/electron/api/routes/studio.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/api/context.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/api/server.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/api/routes/agents.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/main/index.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/main/setup-activation.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/preload/index.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/lib/host-events.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-state-manager.test.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-routes.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：先写失败测试，覆盖状态优先级、活动窗口回落、detail 回退顺序、agent 清单刷新、`getStudioRuntimeSnapshot()` 和 `studioRuntimeChanged` 广播。
- [ ] 第 2 步：运行测试，确认先失败。
  - 运行：`pnpm test tests/unit/studio-state-manager.test.ts tests/unit/studio-routes.test.ts`
- [ ] 第 3 步：实现 `state-manager.ts`，从 `gatewayManager` 的 `status`、`notification`、`chat:message` 事件中推导 `writing / researching / executing / syncing / error / idle`，并把主智能体与本地 agent 落到共享快照。
- [ ] 第 4 步：实现 `service.ts`，聚合 runtime manager 与 state manager，统一暴露 `start`、`retryRuntime`、`getRuntimeSnapshot`、`refreshAgentInventory` 和事件广播。
- [ ] 第 5 步：新增 `electron/api/routes/studio.ts`，提供 `GET /api/studio/runtime` 与 `POST /api/studio/runtime/retry`。
- [ ] 第 6 步：在 `context.ts`、`server.ts`、`main/index.ts` 中接入 StudioService，并把 `studioRuntimeChanged` 同时广播到 host event bus 和 renderer IPC。
- [ ] 第 7 步：在 `agents.ts` 与 `setup-activation.ts` 中接入 `refreshAgentInventory()`，确保 fresh setup、takeover、新建 agent、删除 agent 后工作室清单立即同步。
- [ ] 第 8 步：在 `preload/index.ts` 与 `src/lib/host-events.ts` 注册 `studioRuntimeChanged` 对应通道。
- [ ] 第 9 步：再次运行测试，确认通过。
  - 运行：`pnpm test tests/unit/studio-state-manager.test.ts tests/unit/studio-routes.test.ts`
- [ ] 第 10 步：更新 `progress.md` 并提交。
  - 提交：`git commit -m "feat: add studio service and routes"`

### 任务 6：实现 `/studio` 页面、只读 `webview` 和标题栏入口

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/src/types/studio.ts`
- 新建：`/Users/jianglong/workspace/XClaw/src/lib/studio.ts`
- 新建：`/Users/jianglong/workspace/XClaw/src/pages/Studio/index.tsx`
- 新建：`/Users/jianglong/workspace/XClaw/src/i18n/locales/en/studio.json`
- 新建：`/Users/jianglong/workspace/XClaw/src/i18n/locales/zh/studio.json`
- 新建：`/Users/jianglong/workspace/XClaw/src/i18n/locales/ja/studio.json`
- 修改：`/Users/jianglong/workspace/XClaw/src/i18n/index.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/App.tsx`
- 修改：`/Users/jianglong/workspace/XClaw/src/pages/Chat/index.tsx`
- 修改：`/Users/jianglong/workspace/XClaw/electron/main/index.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/chat-layout.test.tsx`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/studio-page.test.tsx`
- 文档：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：先写失败测试，覆盖标题栏入口、`/studio` 路由、ready 与错误态渲染、`runtimeInstanceId` 变化时重建 `webview`。
- [ ] 第 2 步：运行测试，确认先失败。
  - 运行：`pnpm test tests/unit/chat-layout.test.tsx tests/unit/studio-page.test.tsx`
- [ ] 第 3 步：实现 `src/lib/studio.ts`，只通过 `hostApiFetch` 暴露 runtime 快照读取与 retry 行为。
- [ ] 第 4 步：在标题栏右上角工具区接入 `工作室 / 对话` 入口，进入工作室时把当前聊天路由写入返回状态。
- [ ] 第 5 步：在 `App.tsx` 增加 `/studio` 路由，在 `Studio/index.tsx` 中完成 ready、starting、python-missing、runtime-error 四态 UI。
- [ ] 第 6 步：在 `Studio/index.tsx` 中接入只读 `webview`，并处理 `runtimeInstanceId` 变化、加载失败、重试按钮和 Python 准备入口。
- [ ] 第 7 步：在 `electron/main/index.ts` 中追加 `will-attach-webview` 安全收口，只允许工作室 `resolvedUrl` 同源加载，拒绝外部导航、`new-window` 和下载。
- [ ] 第 8 步：再次运行测试，确认通过。
  - 运行：`pnpm test tests/unit/chat-layout.test.tsx tests/unit/studio-page.test.tsx`
- [ ] 第 9 步：更新 `progress.md` 并提交。
  - 提交：`git commit -m "feat: add studio page and entry button"`

### 任务 7：补齐只读补丁、文档同步与整体验证

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/resources/star-office-runtime/backend/app.py`
- 修改：`/Users/jianglong/workspace/XClaw/resources/star-office-runtime/backend/store_utils.py`
- 修改：`/Users/jianglong/workspace/XClaw/resources/star-office-runtime/frontend/electron-standalone.html`
- 修改：`/Users/jianglong/workspace/XClaw/README.md`
- 修改：`/Users/jianglong/workspace/XClaw/README.zh-CN.md`
- 修改：`/Users/jianglong/workspace/XClaw/README.ja-JP.md`
- 修改：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/testing.md`
- 修改：`/Users/jianglong/workspace/XClaw/docs/star-office-integration/progress.md`

- [ ] 第 1 步：对 vendored frontend 做 `embedded=1&readonly=1` 补丁，隐藏控制栏、资产抽屉、装修与访客动作。
- [ ] 第 2 步：对 vendored backend 做只读禁写补丁，统一拒绝所有写接口，只保留健康检查与展示必需读接口。
- [ ] 第 3 步：运行本功能涉及的单测集合。
  - 运行：`pnpm test tests/unit/studio-paths.test.ts tests/unit/studio-python-env.test.ts tests/unit/studio-state-store.test.ts tests/unit/studio-prompt-injector.test.ts tests/unit/studio-runtime-manager.test.ts tests/unit/studio-state-manager.test.ts tests/unit/studio-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/chat-layout.test.tsx tests/unit/studio-page.test.tsx`
- [ ] 第 4 步：运行全量单测与类型检查。
  - 运行：`pnpm test`
  - 运行：`pnpm run typecheck`
- [ ] 第 5 步：由于本次改动接入了 runtime 事件分发和 host event 广播，补跑通信回归。
  - 运行：`pnpm run comms:replay`
  - 运行：`pnpm run comms:compare`
- [ ] 第 6 步：更新 `testing.md`、`progress.md` 和三份 README，补充工作室入口、Python 依赖与只读范围说明。
- [ ] 第 7 步：提交收尾。
  - 提交：`git commit -m "docs: finalize star office integration plan and verification"`

## 交付后检查

- `resources/star-office-runtime/` 中不应包含 `desktop-pet/`、`docs/`、`dist/`、`join.html`、`invite.html`、字体压缩包等非必要内容。
- 工作室 sidecar 失败时，聊天、设置、智能体工作台必须照常工作。
- `AGENTS.md` 注入必须对 fresh setup、takeover、新建 agent 三条链路全部生效，且不重复。
- `/studio` 只允许主进程下发的受控 URL，renderer 不得出现手写 `http://127.0.0.1:${...}`。
