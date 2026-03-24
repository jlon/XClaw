# 智能体头像语义化重构测试方案

## 测试目标

确保新版头像系统满足：

- 本地智能体与市场模板都改为语义化头像
- 头像风格和 XClaw 工作台气质一致
- 同一输入稳定生成相同头像
- 不同定位的智能体呈现出可感知差异
- 无网络条件下继续可用
- 缺少 `SOUL.md` 或语义不足时有可靠回退

## 分阶段测试

### 阶段一：语义纯函数

#### 自动化

- 相同输入生成相同 `AgentAvatarProfile`
- 不同 archetype 输入命中不同 archetype
- 本地输入优先使用 `SOUL.md / IDENTITY.md`
- 市场输入优先使用 `category / role / summary / tags`
- 关键词平分时走稳定哈希回退
- 语义不足时 `source` 标记为 `fallback`

#### 手工

1. 准备几个典型角色：
   - 编码类
   - 研究类
   - 安全类
   - 运营类
   - 创意类
2. 观察 profile 是否符合预期 archetype

### 阶段二：DiceBear 渲染

#### 自动化

- 同一 `AgentAvatarProfile` 输出相同 data URI
- 不同 profile 输出不同 SVG
- `bottts-neutral` 选项映射稳定
- 渲染失败时会回退到旧 identicon

#### 手工

1. 在浅色主题下查看头像
2. 在深色主题下查看头像
3. 确认边界、对比度、圆角和卡片视觉一致

### 阶段三：本地智能体链路

#### 自动化

- `listAgentsSnapshot()` 返回 `avatarProfile`
- 存在 `SOUL.md` 时使用语义富化
- 缺少 `SOUL.md` 时回退到 `IDENTITY.md`
- 两者都缺失时回退到 `name + id`
- 不把完整原始 `SOUL.md` 暴露到 renderer 合同

#### 手工

1. 打开 `我的 Agents`
2. 观察左侧卡片头像
3. 打开右侧详情页
4. 确认同一智能体在列表和详情里头像一致
5. 修改某个智能体 `SOUL.md` 为明显不同角色后，刷新页面观察头像是否改变到合理方向

### 阶段四：市场模板链路

#### 自动化

- `listAgentMarketCatalog()` 返回 `avatarProfile`
- 市场卡片和市场详情头像一致
- `avatarSeed` 仍保留但不再是唯一依据
- `summary / headline / role / tags` 共同参与判定

#### 手工

1. 打开 `Agent 市场`
2. 观察不同类别模板头像
3. 比较：
   - `code-reviewer`
   - `threat-monitor`
   - `thumbnail-designer`
   - `morning-briefing`
4. 确认这些模板头像既属于同一视觉体系，又能体现不同职业气质

## 必测边界

- `SOUL.md` 极短或为空
- `SOUL.md` 与 `IDENTITY.md` 信息冲突
- 市场模板 `summary` 缺失
- 市场模板只有 `id/category`
- `avatarProfile` 存在但 DiceBear 渲染抛错
- 深色主题下低对比 archetype 不可读
- 本地 agent 改名后头像仍保持稳定识别，不应完全失真

## 验收标准

- 第一眼看上去已经不是占位 identicon
- 头像风格属于 XClaw，而不是像素游戏或社交卡通
- 本地和市场使用同一套视觉语言
- 同类角色有相近倾向，不同角色有明显差异
- 无网络时完整可用
- 语义链路失败时仍有稳定头像，不出现空白

## 计划验证命令

- `pnpm exec vitest run tests/unit/agent-avatar.test.tsx`
- `pnpm exec vitest run tests/unit/agents-page.test.tsx`
- `pnpm exec vitest run tests/unit/agent-market.test.ts`
- `pnpm exec vitest run tests/unit/agent-market-seed.test.ts`
- `pnpm exec eslint src/components/agents/AgentAvatar.tsx src/lib/agent-avatar.ts shared/agent-avatar-persona.ts electron/utils/agent-config.ts electron/utils/agent-market.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run build:vite`
