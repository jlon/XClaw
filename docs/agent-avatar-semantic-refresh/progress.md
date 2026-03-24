# 智能体头像语义化重构进度

## 当前状态

- `2026-03-24` 已完成实现、定向验证和文档回写
- 本地智能体与市场模板头像都已切换到“语义画像 + 本地 DiceBear 渲染”链路
- 旧 identicon 已降级为兜底回退，不再作为默认主路径
- 聊天页消息、流式 typing 和 tool-processing 状态已复用对应 agent 头像
- 聊天侧边栏的 session 行已显示对应 agent 头像
- 没有引入远程头像服务

## 已完成内容

### 调研与决策

- 已定位 XClaw 当前头像实现和调用点
- 已定位市场模板的头像元数据现状
- 已定位本地智能体可用的 `SOUL.md / IDENTITY.md` 数据入口
- 已核对 `openclaw-control-center` 的真实实现边界
- 已确认 DiceBear 官方 JS Library 和 `bottts-neutral` 可满足离线、本地、稳定生成需求

### 代码实现

- 已新增共享语义模块 `shared/agent-avatar-persona.ts`
- 已定义统一 `AgentAvatarProfile` 合同和 9 类 archetype
- 已把本地智能体快照扩展为包含 `avatarProfile`
- 已把市场 catalogue 扩展为包含 `avatarProfile`
- 已把 `AgentAvatar` 重写为：
  - `profile.source === semantic` 时走 DiceBear `bottts-neutral`
  - 语义不足或渲染异常时回退旧 identicon
- 已把 DiceBear 表情候选统一收口到开心态，不再出现严肃嘴型或冷脸
- 已把本地列表、本地详情、市场列表、市场详情统一切到同一头像合同
- 已把聊天页从旧字母圆点头像切到同一 agent 头像合同
- 已把聊天侧边栏 session 行切到同一 agent 头像合同
- 已保持前端类型兼容，旧测试夹具不需要全量补字段

### 测试补充

- 已补充头像渲染测试，覆盖 semantic 主路径与 fallback 路径
- 已补充本地 agent snapshot 含 `avatarProfile` 的测试
- 已补充市场 catalogue 含 `avatarProfile` 的测试
- 已补充聊天消息行渲染真实 agent 头像的测试

## 已执行验证

- `pnpm exec vitest run tests/unit/agent-avatar.test.tsx tests/unit/agent-config.test.ts tests/unit/agent-market.test.ts`
- `pnpm exec vitest run tests/unit/agent-avatar.test.tsx tests/unit/chat-message.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-slash-actions.test.tsx tests/unit/chat-render-stability.test.tsx tests/unit/chat-skill-draft.test.tsx`
- `pnpm exec eslint src/components/agents/AgentAvatar.tsx src/components/agents/AgentCardsPane.tsx src/components/agents/AgentListPane.tsx src/components/agents/AgentLocalDetailPane.tsx src/components/agents/AgentMarketCardsPane.tsx src/components/agents/AgentMarketDetailPane.tsx src/lib/agent-avatar.ts src/types/agent.ts src/types/agent-market.ts shared/agent-avatar-persona.ts electron/utils/agent-config.ts electron/utils/agent-market.ts tests/unit/agent-avatar.test.tsx tests/unit/agent-config.test.ts tests/unit/agent-market.test.ts --max-warnings=0`
- `pnpm exec eslint src/lib/agent-avatar.ts src/pages/Chat/ChatMessage.tsx src/pages/Chat/index.tsx tests/unit/chat-message.test.tsx tests/unit/agent-avatar.test.tsx --max-warnings=0`
- `pnpm exec tsc --noEmit --pretty false`
- `pnpm run build:vite`

## 剩余风险

- archetype 仍然基于规则词典，复杂或模糊角色只能做到“方向正确”，不能保证细粒度人格表达
- 本地智能体目前只读取 `SOUL.md / IDENTITY.md / AGENTS.md` 其中首个可用文件，没有做跨文件合并
- 如果后续市场模板字段质量明显提升，可以再考虑细化关键词词典，但当前不建议继续扩张规则表
- “全部开心表情”会压缩 archetype 间的情绪差异，后续若想增强职业感，只能更多依赖色调和结构差异

## 结论

- 这次改动已经把头像从“稳定占位图”升级成“稳定且符合角色定位的工作台头像”
- 风格保持在 XClaw 当前产品语境内，没有引入像素动物或社交头像感
- Agents 页和聊天页现在使用的是同一套头像语义，不再各自维护两套表现
