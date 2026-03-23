# 工作台风格统一测试

## 测试目标

确认 `模型 / 智能体 / 频道 / 技能 / 定时任务` 已经进入同一套桌面工作台语法，而不是：

- 只有颜色接近
- 只有页头接近
- 只有局部组件接近

本轮重点验证“桌面工作台质感合同”是否被执行。  
所有验收项都必须能映射回 `WU-01` 到 `WU-07`，否则不算铁律。

## 自动化验证

### 必跑命令

- `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx --reporter=dot`
- `pnpm exec eslint src/components/layout/WorkbenchHeader.tsx src/components/layout/WorkbenchSummaryStrip.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/pages/Channels/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx tests/unit/workbench-style-unification.test.tsx --max-warnings=0`
- `pnpm run typecheck`

### 结构断言

- `WU-01`：工作台页当前 mode 只有一个主任务路径
- `WU-02`：浏览区和 detail pane 不出现第三层大摘要板
- `WU-03`：搜索、切换、主动作属于同一条工具带 grammar
- `WU-04`：hero 区不再塞大事实卡和长说明
- `WU-06`：空态不再复制第二个主 CTA
- `WU-07`：市场详情不再把来源证据抬到第一视觉层
- `WU-03`：header subtitle 与 summary strip 不得默认共存
- `WU-06`：每个页面、每个 mode、每个空/非空状态，页级主 CTA 数量必须恰好为 `1`

### 密度断言

- `WU-05`：标题、说明、元信息存在稳定的三级对比
- `WU-03`：utility field / segmented control / action button 高度预算一致
- `WU-02`：不允许某一页重新长回松散 hero
- `WU-02`：不允许某一页把浏览区做回后台列表或目录树
- `WU-05`：工作台首屏必须能区分 `workspace substrate / pane surface / field-or-selected-row`
- `WU-03`：页级工具带不得使用 `rounded-full` 营销 pill 语法

## 状态矩阵

每个工作台至少覆盖下面状态；缺任一状态，视为验收不完整：

- 空数据
- 已选中
- 空搜索
- 加载中
- 错误/断连
- 危险操作确认
- 操作完成后回到稳定态

验收视口固定为：

- `1280 x 800`
- `1440 x 900`

不允许只在超宽屏或全屏下验通过。

其中 `智能体 / 本地`、`智能体 / 市场`、`频道` 还必须额外覆盖：

- 默认窗口宽度
- 长文本标题
- 来源证据展开
- 主 CTA 可执行但次级动作收起

## 手工验收

### 1. 跨页切换

依次切换：

- 模型
- 智能体
- 频道
- 技能
- 定时任务

确认：

- 五个页面都存在同一套 `页头 / 工具带 / 浏览区 / detail pane` 骨架
- 任一页面都不会突然多出第三层大摘要板
- 同一窗口尺寸下，五页的页头和工具带使用同一类控件高度与留白

### 2. 浏览区

确认：

- 搜索框像 utility field，不像网页表单
- 分段切换像桌面 segmented control，不像标签页
- 卡片/列表项默认稳、hover 清楚、选中明确
- 浏览区不会因为说明文字过多而膨胀成摘要墙
- 浏览项最多只保留 `标题 + 1 行元信息`

### 3. detail pane

确认：

- hero 只表达身份、状态、主动作
- 事实区不会重复 hero 已经表达的内容
- 编辑区像工作区，不像后台表单
- 绑定区像操作 pane，不像监控面板
- 路径、来源路径、删除入口不会默认出现在第一视觉层

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

## 证据要求

- `progress.md` 中的 `[x]` 只能表示“已实现 + 已验证”
- 每次勾选完成项，至少要附：
  - 对应规则编号
  - 跑过的自动化命令
  - 至少一个对应状态的真实窗口截图或明确的手工验收结论

## 需要补齐的自动化回归

- 页面级唯一主 CTA 断言
- `header subtitle` 与 `summary strip` 不共存断言
- `detail pane` 首屏不得出现 `source/path/runtime block` 断言
- 工作台首屏不得出现第二条 summary wall 断言
- 关键工作台在 `1280x800` 与 `1440x900` 的视觉回归截图

## 高风险回退点

- 把去网页感误做成去层级
- 把桌面感误做成大卡片、大摘要、大留白
- 为了“更精致”继续加 badge、图标和说明
- 为了“更统一”把所有页面压成同一张模板皮
- 让 `智能体` 页重新长回后台 inspector
