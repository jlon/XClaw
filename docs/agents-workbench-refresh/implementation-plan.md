# Agent 工作台重构实施计划

## 实施原则

- 先重建信息架构，再迁移旧能力
- 先做桌面级布局骨架，再补细节质感
- 发现面和编辑面分层，不混写
- 头像必须本地 deterministic，不依赖联网
- 不为追求“统一入口”假做 duplicate

## 阶段拆分

### 阶段一：双模式骨架

目标：

- 把 `Agents` 改成双模式工作台：
  - `我的 Agents`
  - `Agent 市场`

交付：

- 顶部模式切换
- 浏览区
- 右侧 detail workbench

涉及文件：

- `src/pages/Agents/index.tsx`
- 新增：
  - `src/components/agents/AgentModeSwitch.tsx`
  - `src/components/agents/AgentCardsPane.tsx`
  - `src/components/agents/AgentMarketCardsPane.tsx`
  - `src/components/agents/AgentLocalDetailPane.tsx`
  - `src/components/agents/AgentMarketDetailPane.tsx`

完成标准：

- 页面主结构不再是 source list
- `我的 Agents` 与 `Agent 市场` 视觉和语义清楚分开

### 阶段二：我的 Agents 自适应卡片浏览区

目标：

- 用自适应卡片浏览区承载本地 Agent 浏览与选择

交付：

- 搜索
- 卡片布局
- `1 / 2 / 3` 列自适应规则
- 浏览区与 detail pane 比例规则
- 默认窗口 `1200 x 800` 下优先 `2` 列
- 名称 / 当前模型 / 绑定频道数量 / 默认或继承标记
- 若存在可信摘要，再显示一行角色摘要
- hover 轻操作

完成标准：

- 卡片第一眼像“角色卡”，不是后台条目
- 选择卡片后右侧 detail 同步
- 默认窗口下不再是一行一个智能体
- `<980px` 时 detail 改成覆盖式/切换式承接

### 阶段三：右侧 detail workbench

目标：

- 承接当前 Agent 的深度编辑

交付：

- Header
- `概览 / 人格文件 / 绑定与运行`
- 文件切换与编辑区

完成标准：

- 人格文件编辑区成为真正主工作区
- 不再依赖 modal/窄 pane 承接主任务

### 阶段四：市场卡片墙

目标：

- 把市场独立成发现与安装界面

交付：

- 搜索
- 类别筛选
- 卡片墙
- 右侧详情
- 一键安装
- `localeKey` 驱动的壳层文案与章节标题
- 内容层继续允许源语言可信回退

完成标准：

- 市场卡片与本地 Agent 卡片共享同一 substrate
- 安装后自动切回本地 Agent 区并选中

### 阶段五：头像系统

目标：

- 引入本地 deterministic 头像体系

交付：

- 本地 Agent 头像
- 市场 Agent 头像
- `agent.id` 为主的 seed 规则
- 类别/角色配色映射

完成标准：

- 同 Agent 多次生成结果一致
- 不同 Agent 具有足够区分度
- 不联网
- 不额外引入头像外部依赖

### 阶段六：旧能力迁移与收口

迁移内容：

- CRUD
- 频道绑定摘要与跳转
- `workspace` 文件编辑
- 市场安装
- 回滚与 runtime refresh

完成标准：

- 旧能力不回退
- 新布局不新增假功能

## 明确暂缓

- duplicate
- 开放社区市场
- 在线头像生成
- 评论、评分、社交能力
- `agentDir` runtime 文件编辑
