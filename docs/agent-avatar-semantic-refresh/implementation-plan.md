# 智能体头像语义化重构实现计划

> **给执行型 agent 的说明：** 本次实现直接在当前会话推进，不启用 TDD；用户已明确要求“不需要 TDD，直接开发”。本文档使用 `- [ ]` 复选框跟踪状态。

**目标：** 把 XClaw 的本地智能体与市场模板头像从无语义 identicon 升级为基于角色定位的本地生成头像，同时保持离线、稳定和与现有工作台气质一致。

**架构：** 实现分三层推进。第一层新增共享语义画像层，把本地智能体和市场模板都规整成同一套 `AgentAvatarProfile`。第二层在 Electron 侧补本地智能体资料富化和市场 catalogue 富化，把 profile 进入 API 合同。第三层把 renderer 中的 `AgentAvatar` 切换到 DiceBear 本地渲染，并保留旧 identicon 作为兜底回退。

**技术栈：** React 19、Vite、Electron、TypeScript、DiceBear JS Library、Vitest

---

## 文件结构

### 新增文件

- `/Users/jianglong/workspace/XClaw/shared/agent-avatar-persona.ts`
- `/Users/jianglong/workspace/XClaw/docs/agent-avatar-semantic-refresh/implementation-plan.md`

### 重点修改文件

- `/Users/jianglong/workspace/XClaw/package.json`
- `/Users/jianglong/workspace/XClaw/src/lib/agent-avatar.ts`
- `/Users/jianglong/workspace/XClaw/src/components/agents/AgentAvatar.tsx`
- `/Users/jianglong/workspace/XClaw/src/types/agent.ts`
- `/Users/jianglong/workspace/XClaw/src/types/agent-market.ts`
- `/Users/jianglong/workspace/XClaw/electron/utils/agent-config.ts`
- `/Users/jianglong/workspace/XClaw/electron/utils/agent-market.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/agent-avatar.test.tsx`
- `/Users/jianglong/workspace/XClaw/tests/unit/agent-config.test.ts`
- `/Users/jianglong/workspace/XClaw/tests/unit/agent-market.test.ts`
- `/Users/jianglong/workspace/XClaw/docs/agent-avatar-semantic-refresh/progress.md`
- `/Users/jianglong/workspace/XClaw/docs/agent-avatar-semantic-refresh/testing.md`

## 实施约束

- 不引入远程头像 API。
- 不复刻 `openclaw-control-center` 的像素动物表现层。
- 不把完整 `SOUL.md` 内容暴露给 renderer。
- 不碰聊天页头像系统。
- 保留旧 identicon 作为渲染兜底。
- 只改本地智能体与市场模板头像链路。

### 任务 1：接入 DiceBear 依赖并落地共享语义模块

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/shared/agent-avatar-persona.ts`
- 修改：`/Users/jianglong/workspace/XClaw/package.json`
- 修改：`/Users/jianglong/workspace/XClaw/tsconfig.node.json`

- [x] 第 1 步：给 `package.json` 增加 DiceBear 本地库依赖。
- [x] 第 2 步：确认现有编译链可直接消费 `shared/`，未额外改动 `tsconfig.node.json`。
- [x] 第 3 步：在 `shared/agent-avatar-persona.ts` 定义：
  - `AgentAvatarSemanticInput`
  - `AgentAvatarProfile`
  - archetype 枚举
  - 关键词词典
  - profile 纯函数生成器
- [x] 第 4 步：把 profile 设计锁成“小而稳”的合同，不在这里引入 UI 或 DiceBear 细节。

### 任务 2：重写 renderer 头像渲染层

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/src/lib/agent-avatar.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/components/agents/AgentAvatar.tsx`

- [x] 第 1 步：把现有 identicon 逻辑从“默认主路径”降级为 fallback。
- [x] 第 2 步：新增 `AgentAvatarProfile -> DiceBear options -> dataUri` 的渲染逻辑。
- [x] 第 3 步：固定 `bottts-neutral` 风格与 archetype 到视觉 token 的映射。
- [x] 第 4 步：保留组件 API 的可迁移性，避免一次性把所有调用点都打碎。
- [x] 第 5 步：确保渲染失败时自动回退到旧 identicon。

### 任务 3：本地智能体资料富化并进入快照合同

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/electron/utils/agent-config.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/types/agent.ts`

- [x] 第 1 步：在 `AgentSummary` 中增加 `avatarProfile`。
- [x] 第 2 步：在 `agent-config.ts` 中新增本地语义材料提取逻辑，优先 `SOUL.md`，其次 `IDENTITY.md`，最后回退 `name + id`。
- [x] 第 3 步：控制文本读取长度，只提取头像判定需要的受控内容。
- [x] 第 4 步：在 `listAgentsSnapshot()` 构建阶段生成本地 agent 的 `avatarProfile`。
- [x] 第 5 步：保证缺文件、不合法内容、空文本都不会中断整个快照返回。

### 任务 4：市场模板资料富化并进入 catalogue 合同

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/electron/utils/agent-market.ts`
- 修改：`/Users/jianglong/workspace/XClaw/src/types/agent-market.ts`

- [x] 第 1 步：在市场 item 类型中增加 `avatarProfile`。
- [x] 第 2 步：使用 `category / name / headline / summary / role / tags / avatarSeed` 生成统一语义输入。
- [x] 第 3 步：在 `listAgentMarketCatalog()` 返回前补齐每个模板的 `avatarProfile`。
- [x] 第 4 步：保留原有 `avatarSeed` 字段，但降级为 profile 的 seed 辅助输入。

### 任务 5：把本地与市场调用点全部切到新头像合同

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/src/components/agents/AgentCardsPane.tsx`
- 修改：`/Users/jianglong/workspace/XClaw/src/components/agents/AgentLocalDetailPane.tsx`
- 修改：`/Users/jianglong/workspace/XClaw/src/components/agents/AgentMarketCardsPane.tsx`
- 修改：`/Users/jianglong/workspace/XClaw/src/components/agents/AgentMarketDetailPane.tsx`

- [x] 第 1 步：本地智能体相关组件改为消费 `agent.avatarProfile`。
- [x] 第 2 步：市场组件改为消费 `item.avatarProfile`。
- [x] 第 3 步：去掉市场里当前 `${item.id}:${item.category}` 这种临时 seed 拼接路径。
- [x] 第 4 步：确保列表与详情页使用同一头像合同，不再各自推导。

### 任务 6：补测试并更新功能文档

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/tests/unit/agent-avatar.test.tsx`
- 修改：`/Users/jianglong/workspace/XClaw/tests/unit/agent-config.test.ts`
- 修改：`/Users/jianglong/workspace/XClaw/tests/unit/agent-market.test.ts`
- 修改：`/Users/jianglong/workspace/XClaw/docs/agent-avatar-semantic-refresh/progress.md`
- 修改：`/Users/jianglong/workspace/XClaw/docs/agent-avatar-semantic-refresh/testing.md`

- [x] 第 1 步：补 profile 纯函数的稳定性与 archetype 命中测试。
- [x] 第 2 步：补本地 agent snapshot 含 `avatarProfile` 的测试。
- [x] 第 3 步：补市场 catalogue 含 `avatarProfile` 的测试。
- [x] 第 4 步：更新 `agent-avatar.test.tsx`，覆盖 DiceBear 主路径与 identicon fallback。
- [x] 第 5 步：回写 `progress.md` 和 `testing.md`，记录真实落地状态与验证命令。

### 任务 7：执行验证并收口

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/docs/agent-avatar-semantic-refresh/progress.md`

- [x] 第 1 步：运行定向单测。
  - 运行：`pnpm exec vitest run tests/unit/agent-avatar.test.tsx tests/unit/agent-config.test.ts tests/unit/agent-market.test.ts`
- [x] 第 2 步：运行定向 lint。
  - 运行：`pnpm exec eslint src/components/agents/AgentAvatar.tsx src/lib/agent-avatar.ts shared/agent-avatar-persona.ts electron/utils/agent-config.ts electron/utils/agent-market.ts --max-warnings=0`
- [x] 第 3 步：运行 `typecheck`。
  - 运行：`pnpm run typecheck`
- [x] 第 4 步：运行前端构建。
  - 运行：`pnpm run build:vite`
- [x] 第 5 步：把验证结果和剩余风险回写到 `progress.md`。
