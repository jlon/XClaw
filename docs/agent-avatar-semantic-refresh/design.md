# 智能体头像语义化重构设计

## 背景

当前 XClaw 的智能体头像来自 [src/lib/agent-avatar.ts](/Users/jianglong/workspace/XClaw/src/lib/agent-avatar.ts) 的 `5 x 5` 镜像 identicon。

它满足了三个基础要求：

- 本地生成
- 稳定可重复
- 无网络依赖

但它不满足这次用户真正要的目标：

- 本地智能体头像要更像这个智能体
- 智能体市场里的头像也要和模板定位一致
- 头像气质要和 XClaw 现在的桌面工作台风格一致

真实问题不是“现有头像不够随机”，而是**头像没有语义**。

## 真实证据

### 1. XClaw 当前头像逻辑只依赖 seed，不依赖角色定位

当前实现里：

- 本地智能体卡片、详情页都直接传 `agent.id`
- 市场卡片、详情页传的是 `${item.id}:${item.category}`
- 市场里虽然已有 `avatarSeed` 字段，但当前组件没有使用它

对应代码：

- [src/components/agents/AgentAvatar.tsx](/Users/jianglong/workspace/XClaw/src/components/agents/AgentAvatar.tsx)
- [src/lib/agent-avatar.ts](/Users/jianglong/workspace/XClaw/src/lib/agent-avatar.ts)
- [src/components/agents/AgentCardsPane.tsx](/Users/jianglong/workspace/XClaw/src/components/agents/AgentCardsPane.tsx)
- [src/components/agents/AgentMarketCardsPane.tsx](/Users/jianglong/workspace/XClaw/src/components/agents/AgentMarketCardsPane.tsx)
- [src/components/agents/AgentMarketDetailPane.tsx](/Users/jianglong/workspace/XClaw/src/components/agents/AgentMarketDetailPane.tsx)

这说明现在的头像只是“稳定占位符”，不是“角色识别资产”。

### 2. 本地智能体确实有可用的角色语义源

XClaw 已经有稳定的 `workspace` 文件边界，可以读取：

- `SOUL.md`
- `IDENTITY.md`
- `AGENTS.md`
- `USER.md`

后端已有文件列表和文件读取能力：

- [electron/utils/agent-config.ts](/Users/jianglong/workspace/XClaw/electron/utils/agent-config.ts)
- [electron/api/routes/agents.ts](/Users/jianglong/workspace/XClaw/electron/api/routes/agents.ts)

这证明本地智能体并不是没有语义材料，而是当前头像链路根本没有用这些材料。

### 3. 市场智能体也已有足够的结构化语义

市场 catalogue 已经带有：

- `category`
- `name`
- `role`
- `headline`
- `summary`
- `highlights`
- `detailSections`
- `tags`

对应代码与数据：

- [src/types/agent-market.ts](/Users/jianglong/workspace/XClaw/src/types/agent-market.ts)
- [electron/shared/agent-market-seed.json](/Users/jianglong/workspace/XClaw/electron/shared/agent-market-seed.json)

因此市场模板头像也没有理由继续只靠 `id` 或 `category` 盲猜。

### 4. openclaw-control-center 的头像逻辑可以参考“稳定映射”，不能照搬表现层

我已经核对了本地源码：

- [src/ui/server.ts](/Users/jianglong/workspace/openclaw-control-center/src/ui/server.ts)
- [src/runtime/avatar-preferences.ts](/Users/jianglong/workspace/openclaw-control-center/src/runtime/avatar-preferences.ts)
- [scripts/export-staff-avatars.ts](/Users/jianglong/workspace/openclaw-control-center/scripts/export-staff-avatars.ts)

得到三个事实：

1. 它的 staff 头像不是外部图片，而是内置像素动物精灵。
2. 它的 `deriveAgentAnimalIdentity(agentId)` 主要按 `agentId` 关键词命中动物，没有命中再做稳定哈希回退。
3. `avatar-preferences.ts` 提供的是覆盖层，不是核心生成逻辑。

这套方案适合它自己的像素控制中心，不适合直接搬进 XClaw。

原因很直接：

- XClaw 当前 UI 已经是精致桌面工作台语法，不是像素控制台
- 直接换成像素动物会破坏视觉一致性
- 它的判定核心仍然偏 `agentId`，不满足“头像符合智能体定位”

### 5. DiceBear 官方库满足我们要的技术边界

DiceBear 官方文档已经明确：

- JS Library 可在浏览器和 Node.js 18+ 运行
- 同一个 `seed` 会稳定生成相同头像
- `createAvatar(...).toDataUri()` 可直接用于 `<img src>`
- `bottts-neutral` 是面向 tech platforms 的极简机器人风格

来源：

- <https://www.dicebear.com/how-to-use/js-library/>
- <https://www.dicebear.com/styles/bottts-neutral/>

这和 XClaw 当前的产品气质是匹配的。

## 设计目标

把本地智能体和市场智能体头像都升级成**语义驱动、离线可生成、视觉统一**的角色头像系统。

必须满足：

1. 头像风格符合 XClaw 的桌面工作台气质
2. 本地与市场使用同一套语义判定逻辑
3. 同类角色应当有相近视觉倾向，但不同实例仍能稳定区分
4. 头像生成必须完全离线，不依赖远程 API
5. 不引入大模型、不引入在线分类、不引入不可信推断链

## 非目标

- 不照搬 `openclaw-control-center` 的像素动物精灵
- 不调用 DiceBear 远程 HTTP API
- 不在本轮做用户上传头像
- 不在本轮改聊天页头像系统
- 不在本轮做 AI 生图或 LLM 语义分类

## 方案比较

### 方案 A：直接复刻 control-center 的像素动物头像

优点：

- 已有参考实现
- 稳定、离线、可重复

缺点：

- 风格和 XClaw 当前工作台不一致
- 判定核心主要还是 `agentId`，不是角色定位
- 引入一整套像素精灵和 canvas 渲染，迁移成本高

结论：

- 不采用

### 方案 B：继续保留自研 identicon，只增强 seed

优点：

- 改动最小
- 无新增依赖

缺点：

- 视觉上仍然像占位符
- 即使 seed 改成 `name + role`，结果依旧不是“角色头像”
- 难以建立市场模板和本地智能体的职业气质差异

结论：

- 不采用

### 方案 C：DiceBear 本地库 + `bottts-neutral` + 语义映射层

优点：

- 离线、稳定、跨平台
- 风格更适合 XClaw
- 可以用少量结构化规则把“定位”映射进头像
- 不需要维护大批手绘素材

缺点：

- 需要新增依赖
- 需要补一层本地/市场统一的语义解析模块

结论：

- 采用

## 视觉方向

头像风格定为：

- `bottts-neutral`
- 低噪声
- 中性机械感
- 柔和背景
- 不做像素化
- 不做真人社交头像感

视觉原则：

- 像“专业 AI 工具里的角色资产”
- 不像默认 identicon
- 也不像聊天社交 app 的夸张卡通人物

## 核心设计

### 1. 引入统一的头像语义层

新增一个共享模块，负责把不同来源的智能体资料规整成同一类输入，然后输出紧凑的头像画像结果。

建议位置：

- [shared/](/Users/jianglong/workspace/XClaw/shared)

原因：

- 当前 renderer `src/` 和 Node 侧 `electron/` 都需要这套纯函数
- 放在 `shared/` 比分别复制到两端更符合 DRY

建议新增：

- `shared/agent-avatar-persona.ts`

### 2. 统一输入模型

为本地智能体和市场模板定义统一输入：

```ts
interface AgentAvatarSemanticInput {
  id: string;
  name: string;
  category?: string;
  headline?: string;
  summary?: string;
  role?: string;
  tags?: string[];
  sourceText?: string;
  source: 'local' | 'market';
}
```

说明：

- 本地智能体的 `sourceText` 来自 `SOUL.md / IDENTITY.md` 的受控摘录
- 市场模板的 `sourceText` 来自 `headline / summary / role / highlights / detailSections`

### 3. 语义判定不使用 AI，只使用确定性关键词打分

这条必须锁死。

本轮不使用：

- LLM 分类
- Embedding
- 在线推理

原因：

- 没有必要
- 不稳定
- 离线能力会被破坏
- 很难给出可靠测试

采用的方案是：

- 维护少量 `archetype`
- 用受控关键词词典和字段权重做得分
- 平分时再按稳定哈希回退

建议 archetype：

- `builder`
- `analyst`
- `operator`
- `guardian`
- `researcher`
- `communicator`
- `creative`
- `strategist`
- `support`

### 4. 字段权重设计

不同来源字段的重要性不能一样。

建议权重：

- `category`：高
- `role`：高
- `headline`：中高
- `summary`：中高
- `tags`：中
- `sourceText`：中
- `id`：低，仅作补充和回退

本地智能体额外规则：

- `SOUL.md` 中 `Identity / Role / Responsibilities / Capabilities / Personality` 段落优先
- 若 `SOUL.md` 缺失或过短，再读 `IDENTITY.md`
- `AGENTS.md` 只作为最后补充，不做主依据

### 5. 输出不是 SVG，而是稳定的头像画像配置

语义层输出不直接吐 SVG，避免职责混乱。

建议输出：

```ts
interface AgentAvatarProfile {
  seed: string;
  archetype: AgentAvatarArchetype;
  mood: 'calm' | 'focused' | 'energetic' | 'guarded';
  tone: 'slate' | 'teal' | 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
  source: 'semantic' | 'fallback';
}
```

这样分层更清楚：

- 语义层决定“像什么类型的智能体”
- 渲染层决定“怎么把它画出来”

### 6. DiceBear 渲染层只负责把 profile 转成头像

新增渲染模块，接收 `AgentAvatarProfile`，输出 `data:image/svg+xml`。

建议位置：

- `src/lib/agent-avatar.ts`

当前文件里的 identicon 逻辑将被替换为：

- `profile -> DiceBear options -> dataUri`

使用方式：

- `createAvatar(botttsNeutral, options).toDataUri()`

这和官方文档一致。

### 7. archetype 到 DiceBear options 的映射要固定、少量、可测试

这一层不要做成无限制调色板编辑器。

建议每个 archetype 固定映射：

- 背景色组
- `eyes` 候选集
- `mouth` 候选集
- `radius`
- `backgroundType`

示例方向：

- `builder`：偏蓝绿、结构化、干净
- `analyst`：偏冷蓝、聚焦、克制
- `operator`：偏石墨灰、秩序感
- `guardian`：偏深绿或深蓝、稳重
- `creative`：偏暖橙或玫瑰，但仍压低饱和度

同一 archetype 下再根据 `seed` 做小差异：

- 背景色从候选集里稳定选
- `eyes` 从候选集中稳定选
- `mouth` 从候选集中稳定选

这样既像同类角色，又不会所有头像完全一样。

### 8. 本地智能体需要在后端补一层轻量资料富化

当前 [electron/utils/agent-config.ts](/Users/jianglong/workspace/XClaw/electron/utils/agent-config.ts) 返回的 `AgentSummary` 不包含角色语义。

为了让本地智能体卡片列表直接拿到头像配置，建议在后端补充：

- 读取 `SOUL.md`
- 截取受控长度的文本
- 在 Node 侧生成 `AgentAvatarProfile`
- 把 profile 直接挂到 `AgentSummary`

建议新增字段：

```ts
interface AgentSummary {
  ...
  avatarProfile: AgentAvatarProfile;
}
```

这样做的好处：

- 不卡在 renderer 再去异步逐个读文件
- 首屏卡片列表拿到数据即可渲染
- 不把完整 `SOUL.md` 暴露给前端

### 9. 市场模板也走同一 profile 合同

市场模板已经有足够语义，不需要额外读文件。

建议在 market catalogue 返回前直接补 `avatarProfile`：

- 位置：`electron/utils/agent-market.ts`

这样本地和市场都用：

- `AgentAvatar profile -> DiceBear render`

而不是一边在后端算、一边在前端临时拼。

### 10. 现有 `avatarSeed` 不删除，但语义降级

当前市场 seed 里的 `avatarSeed` 不应直接删除。

它可以保留为：

- profile seed 的组成部分
- 兼容旧数据
- 语义回退时的稳定输入

但不能继续当唯一头像依据。

## 数据流

### 本地智能体

1. `listAgentsSnapshot()` 读取 agent config
2. 后端读取每个 agent 的 `SOUL.md / IDENTITY.md`
3. 生成 `AgentAvatarSemanticInput`
4. 语义层输出 `AgentAvatarProfile`
5. API 返回 `AgentSummary.avatarProfile`
6. renderer 里的 `AgentAvatar` 用 profile 渲染 DiceBear `dataUri`

### 市场智能体

1. `listAgentMarketCatalog()` 读取内置 catalogue
2. 用 `headline / summary / role / tags / category` 生成 `AgentAvatarSemanticInput`
3. 语义层输出 `AgentAvatarProfile`
4. API 返回 `item.avatarProfile`
5. renderer 里的 `AgentAvatar` 用 profile 渲染 DiceBear `dataUri`

## 错误处理与回退

### 1. 本地智能体缺少 `SOUL.md`

回退到：

- `IDENTITY.md`
- 再回退到 `name + id`

### 2. 所有语义字段都不足

回退到：

- 稳定哈希选一个 archetype
- `source = 'fallback'`

### 3. DiceBear 渲染失败

回退到：

- 当前自研 identicon 作为最后兜底

这条非常重要。  
本轮不能把头像系统改成“新库一失败整个卡片没头像”。

## 依赖与工程约束

新增依赖：

- `@dicebear/core`
- `@dicebear/collection`

依据官方文档：

- <https://www.dicebear.com/how-to-use/js-library/>

工程约束：

- 保持离线可用
- 不引入网络请求
- 不把大段原始 `SOUL.md` 直接透给 renderer
- 纯函数语义层必须可单测

## 复杂度评估

复杂度：`中等`

原因：

- UI 改动不大
- 核心工作在于补一层共享语义模块和本地资料富化
- 需要兼顾 renderer / electron 两端合同

不是简单，是因为：

- 本地智能体需要新增后端富化链路
- 市场模板要和本地共用同一套规则
- 需要保留 deterministic 和 fallback

也不算 ambitious，因为：

- 不做在线服务
- 不做用户可配置头像系统
- 不做 AI 分类

## 版本 1 范围

### 必做

- DiceBear 本地库接入
- `bottts-neutral` 风格接入
- 共享语义 profile 模块
- 本地智能体 `avatarProfile` 富化
- 市场 catalogue `avatarProfile` 富化
- `AgentAvatar` 改为 DiceBear 渲染
- 纯函数和 UI 回归测试

### 暂不做

- 用户手动修改头像
- 自定义上传头像
- 聊天页头像统一
- 头像缓存持久化文件
- 头像主题编辑器

## 完成后的产品轮廓

完成后，用户会看到：

- 本地智能体不再只是随机格子块，而是有稳定职业气质的机器人头像
- 市场里同类模板会呈现一致的角色倾向
- 整体风格仍然属于 XClaw，而不是外来像素系统
- 改名不会完全破坏角色感，但不同模板仍有足够区分度

## 结论

这次头像升级的正确方向不是“把 control-center 的像素头像搬过来”，而是：

- 借鉴它的“稳定映射”思想
- 放弃它的像素表现层
- 用 DiceBear 本地库承接渲染
- 用受控语义规则把“智能体定位”真正映射进头像

最终方案锁定为：

- `DiceBear 本地 JS Library`
- `bottts-neutral`
- `共享语义 profile 模块`
- `本地 / 市场统一头像合同`
