# 工作台风格统一测试

## 测试目标

确认 `模型 / 智能体 / 频道 / 技能 / 定时任务` 已经进入同一套桌面工作台语法，而不是：

- 只有颜色接近
- 只有页头接近
- 只有局部组件接近

本轮重点验证“桌面工作台质感合同”是否被执行。  
所有验收项都必须能映射回 `WU-01` 到 `WU-08`，否则不算铁律。
如果是 `/models`，还必须额外映射到 `MW-01` 到 `MW-05`。

## 自动化验证

### 必跑命令

- `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx --reporter=dot`
- `pnpm exec eslint src/components/layout/WorkbenchHeader.tsx src/components/layout/WorkbenchSummaryStrip.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/pages/Channels/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx tests/unit/workbench-style-unification.test.tsx --max-warnings=0`
- `pnpm run typecheck`
- `git diff --check -- src/pages/Cron/index.tsx src/stores/cron.ts src/types/cron.ts electron/api/routes/cron.ts electron/main/ipc-handlers.ts src/i18n/locales/zh/cron.json src/i18n/locales/en/cron.json src/i18n/locales/ja/cron.json docs/workbench-style-unification/progress.md docs/workbench-style-unification/testing.md`

### 结构断言

- `WU-01`：工作台页当前 mode 只有一个主任务路径
- `WU-02`：浏览区和 detail pane 不出现第三层大摘要板
- `WU-03`：搜索、切换、主动作属于同一条工具带 grammar
- `WU-03`：搜索框属于固定工具域，不得回退成全宽网页横幅
- `WU-04`：hero 区不再塞大事实卡和长说明
- `WU-06`：空态不再复制第二个主 CTA
- `WU-07`：市场详情不再把来源证据抬到第一视觉层
- `WU-08`：默认基线视口下，主 pane / 主模态不依赖内部滚动条完成主任务
- `WU-03`：header subtitle 与 summary strip 不得默认共存
- `WU-06`：每个页面、每个 mode、每个空/非空状态，页级主 CTA 数量必须恰好为 `1`
- `WU-05`：`定时任务` 创建链必须显式指定 `执行智能体 + 绑定频道账号 + 目标会话 ID`
- `WU-05`：当前智能体没有绑定频道账号时，弹窗必须明确提示，并禁用保存
- `WU-05`：手动触发任务必须按真实返回值反馈，不能把 `already-running` 误报成成功
- `MW-01`：`Provider Board` 卡片不得再出现 `docs / footer 操作 / viewing 文案`
- `MW-02`：未选中 provider 时，Token Intelligence 默认只允许轻分析态
- `MW-04`：`Add Provider` 顶部 provider 选择区必须是小 tile 网格，不得退回大卡片选择器

### 密度断言

- `WU-05`：标题、说明、元信息存在稳定的三级对比
- `WU-03`：utility field / segmented control / action button 高度预算一致
- `WU-02`：不允许某一页重新长回松散 hero
- `WU-02`：不允许某一页把浏览区做回后台列表或目录树
- `WU-05`：工作台首屏必须能区分 `workspace substrate / pane surface / field-or-selected-row`
- `WU-03`：页级工具带不得使用 `rounded-full` 营销 pill 语法
- `WU-05`：页头、工具带、通知条、空态、卡片/列表与模态必须共享同一条内容宽度轨道
- `WU-05`：单项卡片场景不得出现半列空轨或横向拖满整窗
- `WU-08`：默认视口下不得通过增加模态内部滚动条来掩盖布局失控
- `MW-03`：`/models` provider 图标只能是“官方彩色”或“中性单色”，不得出现粉壳、伪彩色和字母占位
- `MW-05`：`Breakdown / Recent Requests` 必须是资源行语法，不得重新长回报表卡片和彩色 chip 墙

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
- 页头、工具带、通知条、空态与正文容器不会各走各的宽度轨道

### 2. 浏览区

确认：

- 搜索框像 utility field，不像网页表单
- 搜索框宽度稳定，不能因为页面变宽就长成横幅
- 分段切换像桌面 segmented control，不像标签页
- 卡片/列表项默认稳、hover 清楚、选中明确
- 浏览区不会因为说明文字过多而膨胀成摘要墙
- 浏览项最多只保留 `标题 + 1 行元信息`
- `/models` 的 Provider Board 单卡不得再有 footer utility row
- 单项卡片场景仍保持 pane 感，不会出现半页空白或整窗拉伸

### 3. detail pane

确认：

- hero 只表达身份、状态、主动作
- 事实区不会重复 hero 已经表达的内容
- 编辑区像工作区，不像后台表单
- 绑定区像操作 pane，不像监控面板
- 路径、来源路径、删除入口不会默认出现在第一视觉层
- `/models` 在未选中 provider 时，分析区不会和 Provider Board 首屏争主任务
- 默认基线视口下，主模态和主 pane 不靠内部滚动条完成主任务
- 创建/编辑模态默认先减字、分栏、下沉说明，再允许出现内部滚动条

### 3.1 模型工作台专项

确认：

- `Provider Board` 卡片只承担资源识别与轻事实
- 未选中 provider 时，只看到摘要带、主趋势图和轻提示
- 选中 provider 后，才看到完整 `breakdown / recent requests`
- `Add Provider` 的 provider 选择区是 `4-5` 列小 tile，而不是大卡片墙
- `Add Provider` 在默认桌面窗口下不允许用内部滚动条解决主流程布局
- provider 图标不出现粉壳、品牌色底板、字母数字占位
- `Breakdown / Recent Requests` 都回到资源行，而不是报表卡片

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

## 本轮已留证据

### 定时任务

- 对应规则：
  - `WU-03`：页头主动作与刷新降到同一工具带高度
  - `WU-04`：副标题、空态、弹窗说明继续减字
  - `WU-05`：任务列表改成卡片网格，单卡改成 `头 / 主消息 / 事实胶囊 / 底栏`
  - `WU-03`：搜索/工具/主 CTA 回到一条桌面工具带语法
  - `WU-05`：页头、通知条、卡片网格、空态与模态收回同一内容宽度轨道
  - `WU-05`：创建链显式绑定 `执行智能体 / 频道账号 / 目标会话 ID`
  - `WU-05`：没有绑定频道账号时禁止保存
  - `WU-05`：手动触发按真实运行状态反馈
- 已跑命令：
  - `pnpm exec eslint src/pages/Cron/index.tsx --max-warnings=0`
  - `node -e "JSON.parse(...cron locale files...)"`
  - `git diff --check -- src/pages/Cron/index.tsx src/stores/cron.ts src/types/cron.ts electron/api/routes/cron.ts electron/main/ipc-handlers.ts src/styles/globals.css src/i18n/locales/zh/cron.json src/i18n/locales/en/cron.json src/i18n/locales/ja/cron.json docs/workbench-style-unification/progress.md docs/workbench-style-unification/testing.md`
- 真实窗口证据：
  - 页头已改成与 `技能` 对齐的 `标题区 + 工具带` 双层结构
  - 任务列表已从横向后台 row 改成 pane 卡片网格，单卡不再拖满整窗
  - 页头摘要已不再使用厚 summary strip，而是轻状态胶囊
  - 创建/编辑模态已收成 pane 化双栏编辑器，并以无滚动为默认基线
  - 创建/编辑模态的主字段已收回固定内容轨道，不再整窗铺开
  - 创建/编辑模态已去掉“左大右小”的错误分栏，上半区为对等双栏，下半区为全宽调度区
  - 创建/编辑模态内容区允许滚动，但默认隐藏滚动条，不再把滚动条直接暴露在 pane 内
  - 当前智能体没有绑定频道账号时，弹窗会直接提示并禁用保存
  - 手动触发若返回 `already-running`，不再误报为成功

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

## 最新验证补充

- 真实配置核对：`feishu / bot2`、`telegram / default` 在 `openclaw.json` 里看起来都缺少唯一默认会话，但 pairing-store `credentials/*-allowFrom.json` 已记录了唯一来源 ID；定时任务必须同时读取配置和 pairing-store，不能只看 `openclaw.json`。
- 交互规则调整：`目标会话 ID` 现在按“配置字段 -> pairing-store -> 手填”三层推导。只有在账号配置或 pairing-store 里能唯一推导时才自动带出；若配置允许任意来源、存在多个候选或根本没有默认目标，弹窗会直接提示原因。
- 结构规则调整：`定时任务` 弹窗已从“左大右小”错误分栏改成“顶部双栏 + 底部全宽调度”，并继续隐藏内部滚动条。
