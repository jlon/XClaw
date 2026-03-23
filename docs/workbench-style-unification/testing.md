# 工作台风格统一测试

## 测试目标

确认 `模型 / 智能体 / 频道 / 技能 / 定时任务` 已经进入同一套桌面工作台语法，而不是：

- 只有颜色接近
- 只有页头接近
- 只有局部组件接近

本轮重点验证“桌面工作台质感合同”是否被执行。

## 自动化验证

### 必跑命令

- `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx --reporter=dot`
- `pnpm exec eslint src/components/layout/WorkbenchHeader.tsx src/components/layout/WorkbenchSummaryStrip.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/pages/Channels/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx tests/unit/workbench-style-unification.test.tsx --max-warnings=0`
- `pnpm run typecheck`

### 结构断言

- 工作台页只有一个主任务路径
- 搜索、切换、主动作属于同一条工具带 grammar
- 浏览区和 detail pane 不出现第三层大摘要板
- hero 区不再塞大事实卡和长说明
- 市场详情不再把来源证据抬到第一视觉层
- 空态不再复制第二个主 CTA

### 密度断言

- 标题、说明、元信息存在稳定的三级对比
- utility field / segmented control / action button 高度预算一致
- 不允许某一页重新长回松散 hero
- 不允许某一页把浏览区做回后台列表或目录树

## 手工验收

### 1. 跨页切换

依次切换：

- 模型
- 智能体
- 频道
- 技能
- 定时任务

确认：

- 感觉是在同一个产品里切页，不是在切五种风格
- 每页都存在清晰的浏览区与工作区关系
- 页头和工具带都是同一种桌面语法

### 2. 浏览区

确认：

- 搜索框像 utility field，不像网页表单
- 分段切换像桌面 segmented control，不像标签页
- 卡片/列表项默认稳、hover 清楚、选中明确
- 浏览区不会因为说明文字过多而膨胀成摘要墙

### 3. detail pane

确认：

- hero 只表达身份、状态、主动作
- 事实区不会重复 hero 已经表达的内容
- 编辑区像工作区，不像后台表单
- 绑定区像操作 pane，不像监控面板

### 4. 高清感

确认：

- 页面不发虚、不扁平、不糊
- 白底干净，但不是一整块死白板
- 边界轻但准
- 阴影短而稳
- 字重和字号层次清楚，不靠 `font-medium` 滥堆

### 5. 平台

确认：

- mac 下足够轻、静、克制
- Windows 下边界和控件轮廓足够清楚
- 两端共用同一套工作台语言，没有平台特供布局分叉

## 高风险回退点

- 把去网页感误做成去层级
- 把桌面感误做成大卡片、大摘要、大留白
- 为了“更精致”继续加 badge、图标和说明
- 为了“更统一”把所有页面压成同一张模板皮
- 让 `智能体` 页重新长回后台 inspector
