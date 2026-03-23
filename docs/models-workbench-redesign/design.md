# 模型工作台重构设计

## 背景

改造前的 `/models` 页面本质上是两块内容的简单纵向拼接：

- 上半部分直接复用 `ProvidersSettings`
- 下半部分展示 token usage 历史、分组条形图和分页明细

这条实现链真实可用，但信息架构有两个根本问题：

- 它更像“设置页 + 报表页”叠在一起，不像桌面应用里的统一工作台
- `ProvidersSettings` 仍然是纵向表单思维，provider 列表、编辑、空态、添加动作全部沿着网页设置页语法展开

如果继续在当前骨架上微调阴影、圆角和卡片样式，只会得到一个“更漂亮的网页设置页”，不会得到用户想要的 QClaw 式桌面工作台。

## 2026-03-23 二次收敛结论

用户已经明确否定当前 `/models` 首屏的优先级和视觉表达。虽然页面已经具备：

- Provider Board
- Provider Inspector
- 独立 Add Provider Dialog
- Token Intelligence

但当前实现仍保留三个根本问题：

- 首屏先看到的是大号 KPI 和图表，而不是 provider 资源入口
- KPI 和图表偏向网页 dashboard 语法，不像桌面工作台 pane
- provider 更像 usage 的过滤器，而不是页面主对象

因此这份设计文档以下述二次收敛方案为准：`Provider First + 聚焦工作区 + 次级分析区`。当前实现只能视为已有功能基础，不能视为最终信息架构。

## 改造前 Review

### 改造前页面真实结构

参考代码：

- `src/pages/Models/index.tsx`
- `src/components/settings/ProvidersSettings.tsx`
- `src/pages/Models/usage-history.ts`

可以确认：

- 页面标题之后直接挂 `ProvidersSettings`
- token usage 区和 provider 区没有共享状态，只有视觉上的先后顺序
- provider 编辑通过卡片内联展开完成，编辑态会把整个列表向下撑长
- token 图表当时还是轻量自绘 `UsageBarChart`，只支持简单的按模型 / 按天分组条形图

### 改造前页面的关键问题

#### 1. 页面职责模糊

用户来到这里，到底是：

- 管理 provider、API Key、默认模型
- 看 token / cost 消耗
- 还是对照 provider 和消耗来做路由决策

当前实现没有给出统一答案，所以页面自然长成“上面配、下面看”的纵向拼接。

#### 2. Provider 列表不是工作台卡片，而是设置项列表

`ProvidersSettings` 现在虽然叫 `ProviderCard`，但结构仍然是：

- 标题
- 摘要
- hover 动作
- 点击后内联展开整段表单

这不是桌面工作台卡片，而是网页 settings row。它的问题是：

- 编辑态会破坏列表密度
- provider 卡片无法承担全局筛选 / 状态概览 / 快速切换职责
- 自适应窗口时只能继续纵向堆，不适合 `2 / 3 / 4` 列卡片板

#### 3. Token 区缺少“桌面分析面板”质感

当前 token 区只有：

- 时间窗口切换
- 按模型 / 按天切换
- 一个轻量 stacked bar
- 一组分页明细

这更像报表组件，不像桌面工作台里的分析区。主要缺口：

- 没有 KPI 摘要带
- 没有 provider 维度和 model 维度的并行观察
- 没有 cost / tokens 的主指标切换
- 明细和图表之间没有上下文联动

#### 4. Provider 与 Token 没有协同关系

这是最核心的问题。当前页面只是把两块内容放在一个路由里，但两者没有共享心智：

- 点击 provider 不会影响 token 视图
- token 图里看见某个 provider / model 的高消耗后，不能自然回到 provider 配置
- 页面没有形成“先看谁在花，再改谁的配置”的闭环

## 设计目标

- 把 `/models` 重构为单一职责明确的“模型工作台”
- provider 列表改成桌面化卡片板，并按内容容器宽度自适应列数
- token 消耗升级成更像桌面分析面板的图表和指标区
- provider 与 token 两块内容通过共享选择态和共享时间窗口形成闭环
- 保持现有 provider store、usage 数据源和 host-api 链路可复用
- 明确以 `Provider First` 作为首屏原则
- 吸收 `Channels / Skills` 已验证过的桌面化设计语法，而不是继续微调 dashboard 皮相

## 非目标

- 不把这个页面重构成新的全局 Settings
- 不引入重量级图表库，只为了“看起来高级”
- 不在 v1 中支持任意复杂 BI 能力，例如自由钻取、导出、自定义指标
- 不把 provider 编辑继续做成全屏向导

## QClaw 借鉴边界

这轮会借鉴 QClaw 的桌面美学，但不会宣称像素级复刻。当前拿到的有效证据主要来自：

- 本机 QClaw 的顶栏 / 频道入口 / 工作区 chrome 语法
- QClaw 明显偏好的浅层层级、卡片入口板、轻量 inspector 和低噪声桌面 chrome

当前还没有从 QClaw 打包产物里定位到一份可直接一比一映射的“模型工作台”页面源码。因此本轮只能借其设计语法，不做虚假的“完全照抄”承诺。

可以确定要吸收的是：

- 轻页头，不做大段 hero
- 卡片板承担入口和概览，不承担整段纵向表单
- 编辑动作进入独立 inspector，而不是在卡片内联把列表撑爆
- 图表区是工作台的一个稳定面板，不是页面底部长报表

## 设计结论

### 0. 本轮借鉴边界

这次不再从“报表页”找灵感，而是直接借鉴仓库里已经被验证过的两套桌面工作台语法：

- `Channels`：入口板先行、选中后进入聚焦态、右侧 inspector 连续属性面板
- `Skills`：卡片承担资源识别与状态，操作降级为次级层，不用大按钮轰炸

因此 `/models` 要吸收的是：

- 轻页头
- Provider 入口板优先
- 选中后进入聚焦态
- inspector 语法
- 克制的统计与图表 pane

而不是继续保留“hero 页头 + 大 KPI 卡 + 首屏报表”的网页感结构。

### 1. 页面重新定义为“模型控制台”

页面主任务定义为：

- 管理 provider 栈
- 理解 token / cost 由谁消耗
- 基于消耗结果调整 provider 和模型路由

因此页面不是“设置 + 报表”，而是一个完整控制台。

### 1.1 模式契约

这一页必须像频道中心那样先写死模式契约，不能只写 section 结构。

模型工作台分三种模式：

- 默认态：Provider 入口板 + 首屏分析
- 聚焦态：已选 provider 的配置聚焦态，分析区只作为该 provider 的上下文
- 超宽态：带常驻 inspector 的增强工作台

如果没有这层契约，最终实现会自然滑回“网页式纵向分段页”。

### 1.2 工作台铁律映射

`/models` 这条线后续实现统一按 `workbench-style-unification` 的 `WU-01 ~ WU-07` 执行，不再用“看起来更好看”替代结构判断：

- `WU-01`：默认态主任务是“浏览并选择 provider”；聚焦态主任务是“配置当前 provider，并观察该 provider 的分析上下文”
- `WU-02`：首屏主层只允许 `轻页头 / Provider Browse Pane / Detail Workbench`
- `WU-03`：Token Intelligence 的摘要带、主指标切换、时间窗口必须共用一条工具带语法
- `WU-04`：provider 卡片和 inspector 都先删重复事实，再决定是否补 icon / badge
- `WU-05`：清晰度来自边界、字重、节奏；provider icon 不再靠彩色壳体制造存在感
- `WU-06`：页级主 CTA 永远只有 `添加提供商`
- `WU-07`：路径、来源、危险动作不进入首层；首层只展示身份、接入、回退、凭证这些真实工作事实

### 2. 顶层骨架

`/models` 页面采用三段式结构：

#### 2.1 极简页头

页头实际只保留：

- 页面标题
- 一句极短副标题
- 主动作：`添加提供商`

页头不再承担大块说明，也不再把 provider 设置区的标题重复写一遍。当前实现中的 hero 标题被视为错误方向，后续实现必须删除。

#### 2.2 Provider Board 先于分析区

首屏第一块必须是 Provider Board，而不是 KPI 或图表。其职责是：

- 告诉用户当前配了哪些 provider
- 哪些是默认 / 可用 / 异常
- 最近窗口下大概是谁在消耗
- 提供进入配置聚焦态的主入口

Provider Board 必须满足：

- `2 / 3 / 4` 列自适应
- 卡片是资源入口，不是设置表单
- 单击卡片直接进入配置聚焦态，并联动过滤下方分析区
- “全部提供商”不是主角，不应再做成抢首屏的总览卡片

#### 2.3 Token Intelligence 是次级分析区

Provider Board 之后才进入 Token Intelligence。这里必须降级为“分析上下文”，不是新的页面主角。

当前实现里那 4 张大号 KPI 卡已经被明确否定，后续实现必须改为图表区头部的一条紧凑摘要带，默认只保留：

- tokens
- cost
- requests
- active models

#### 2.4 主工作区

主工作区不再按“上半段 / 下半段”描述，而是明确拆成三个层：

- Scope 选择层：Provider Board
- 分析主画布：Token Intelligence
- 次级详情层：Provider Inspector

三层共享：

- 当前时间窗口
- 当前 provider 过滤态
- 当前主指标视角

这不是文案差异，而是硬约束：实现时不能再退回“先一段 provider，再一段 token”的 section 纵向拼接。

同时要加首屏高度约束：

- 默认窗口下，`页头 + Provider Board` 不能吃满首屏
- Token Intelligence 主图必须首屏可见
- Provider Board 默认最多展示 2 行卡片；超出部分走内部滚动或折叠，不允许继续无限向下推

同时必须明确转场规则：

- 默认态：完整 Provider Board 可见
- 进入聚焦态后：普通宽度下完整 Board 折叠为当前 provider 头部，不再继续占据首屏
- 只有超宽态才保留左侧 provider rail，作为同级 provider 的快速切换入口

### 3. Provider Board

#### 3.1 为什么 provider 区必须先重写

用户要求把 provider 列表改成卡片式，这个方向是对的；但如果只是把现有 `ProviderCard` 套上更大圆角，它仍然是网页设置项，不是工作台卡片。

正确做法是：

- 卡片只负责概览、选中、快速动作
- 完整编辑退出卡片，进入 inspector
- 卡片板本身成为这个页面的入口板和筛选器

#### 3.2 卡片信息层级

每张 provider 卡片展示：

- 品牌图标
- 提供商名称
- 默认标记
- 凭证状态
- 最近窗口下的轻量 usage 信号，例如 `7d tokens / 7d cost`
- 轻动作：设为默认、编辑、删除、文档

卡片不再内联展开长表单，也不承载配置字段摘要墙。`baseUrl / model / auth` 这类配置详情进入 inspector 查看态，不继续堆在卡片正面。

#### 3.3 卡片行为

卡片主点击行为已经由用户确认：

- 单击卡片，直接进入配置聚焦态
- Token Intelligence 自动过滤到该 provider
- 卡片进入选中态
- inspector 默认进入查看态；显式点击 `编辑` 后才进入编辑态

次级动作才保留在卡片内：

- 设为默认
- 更多操作
- 删除

点击 ranking / 明细里的 provider，也允许切换到该 provider 的聚焦态，而不是只改图表过滤。

如果用户再次点“全部”，则退出 provider 过滤态，图表回到全局视角。

#### 3.4 自适应规则

provider 卡片板按内容容器宽度自适应，不靠抽象窗口宽度，也不靠硬写固定列数。

建议阈值：

- 容器 `< 760px`：1 列
- 容器 `760px - 1159px`：2 列
- 容器 `1160px - 1519px`：3 列
- 容器 `>= 1520px`：4 列

补充约束：

- `272px` 只是 absolute minimum，不是舒适宽度
- 默认应用窗口加上展开侧栏后，应以 `2` 列为常态预期
- 当 inspector 常驻出现时，board 上限应回退到 `3` 列；`4` 列只在 board 拿到完整宽度时成立

宽度不足时优先减列，不继续硬缩卡片内容。

### 4. Provider Inspector

#### 4.0 聚焦态必须像频道中心，而不是网页侧栏表单

用户已经明确要求参考 `Channels` 的设计思路，因此 provider 一旦被选中，就必须进入“聚焦工作区”而不是继续把所有内容摊平在一个长页面里。

布局原则：

- 默认窗口：完整 Provider Board 收起为当前 provider 头部，随后是 inspector + analytics 的纵向连续 pane
- 超宽窗口：左侧 provider rail，右侧 inspector + analytics
- 不允许继续保留“首屏就展开所有 provider 配置”的旧模式

#### 4.1 不再内联展开

现有 `ProvidersSettings` 的最大问题不是样式，而是编辑交互模型。内联展开会直接导致：

- 列表高度失控
- 自适应网格被破坏
- 页面变成“卡片里嵌表单”的网页设置页

因此 v1 改为：

- 宽屏下：右侧常驻 inspector pane
- 非超宽宽度：桌面模态 inspector

并且 inspector 必须有明确模式边界：

- 默认是查看态，负责展示 provider 详情、健康状态和最近 usage 摘要
- 只有显式点击 `编辑` 后才进入编辑态

如果做成“选中卡片即出现完整编辑表单”，页面仍然会回退成 settings workbench，不符合本轮目标。

#### 4.2 Inspector 分组

provider 编辑区采用桌面 inspector 语法，而不是多层卡片表单，分为：

- 基础信息
- 接入配置
- 回退策略
- 凭证与验证

其中：

- 高频字段优先上方
- 验证和危险动作固定在底部动作区
- 说明文案默认收紧，不再让每个字段都占一整段

### 5. Token Intelligence

#### 5.1 核心原则

token 区不能继续只是“图表 + 列表”，必须是桌面分析面板：

- 图表是主要焦点
- 排名和明细是辅助
- provider 选择和时间窗口会统一驱动它

这里的“桌面级”指的是桌面分析面板，不是通用 BI 系统。当前数据是 usage 离散记录，不是高频流式监控；v1 必须控制图表数量和交互复杂度，不能把页面做成图表动物园。

这也是为什么图表不能继续放在首屏最上面。它是帮助用户决策的上下文，不是页面入口。

#### 5.2 面板结构

Token Intelligence 采用三层结构：

- 顶部：紧凑摘要带 + 主指标切换 + 时间窗口
- 中部：主图表 + 侧边 breakdown
- 底部：最近请求明细

默认态与聚焦态下：

- Token Intelligence 保持单主画布优先
- breakdown 可以下沉到主图下方

只有超宽态才允许把主图和 breakdown 稳定拆成两栏。

#### 5.3 主指标与摘要带

主指标支持：

- `Tokens`
- `Cost`

切换后：

- 紧凑摘要带更新
- 主图表更新
- ranking 更新

避免同时叠多个 Y 轴，保持理解成本可控。

同时要明确：

- `Cost` 视图是可切换能力，不是默认主路径
- `costUsd` 缺失时必须做降级提示，不能伪装成完整成本报表

#### 5.4 图表设计

不引重量级图库。当前仓库没有现成 `echarts / recharts / visx` 依赖，直接上重库违反 KISS，也会引入额外主题和渲染负担。

v1 采用轻量 SVG 组件，自绘以下图表：

- 主趋势图：按天 stacked columns，分 input / output / cache
- 右侧 breakdown：横向排名条
- 卡片内微指标：usage 数值，不强行上 sparkline

同时必须满足新的表达约束：

- 不再默认给每根柱子打大号精确数值标签
- 精确值通过 hover、辅助摘要或次级区域读取
- 默认视图先强调趋势和归因，不强调会计报表式精确读数
- 图表面板本身必须像桌面分析 pane，而不是网页 dashboard 卡片

这样既能保持桌面感，也不至于为了两三个图表引入重型依赖。

进一步的硬约束：

- v1 只保留 2 类真正图表：`主趋势图 + breakdown ranking`
- 紧凑摘要带只做数字摘要，不算图表
- provider 卡片只放 usage 数值摘要，不上 sparkline
- 不做双 Y 轴、不做 line+bar 混搭、不做 zoom / pan / brush
- 动画只允许高度、透明度、transform 级别的轻量过渡

#### 5.5 明细区

明细列表保留，但重新定位为“最近请求面板”：

- 默认只显示当前过滤条件下的最近记录
- 保留 provider / model / agent / timestamp / totalTokens / cost
- 详情内容查看维持开发模式专属

分页仍可保留，但密度要更像工作台列表，不再像长报表卡片。

并且图表永远基于聚合 bucket 渲染，不能把请求级明细直接画进 SVG。

### 6. Provider 与 Token 的协同方式

这是本轮最重要的设计约束。

#### 6.1 共享过滤态

Provider Board 与 Token Intelligence 共用一个 provider 过滤态，但内部实现不能直接拿 `account.id` 去碰 usage 数据。

因此需要明确两层键：

- 视图层选择态：`selectedProviderAccountId`
- usage 聚合过滤键：`runtimeProviderKey`

两者之间通过 provider runtime key 映射层对齐。否则 usage 记录里的 `provider` 字符串和配置页账号主键会错位。

对外描述时仍可以简化成“当前选中的 provider”，但设计文档必须承认这层映射存在。

Provider Board 与 Token Intelligence 共用同一套 provider 过滤态：

- 未选中：显示全局数据
- 选中 provider：KPI、图表、明细全部过滤

#### 6.2 共享时间窗口

Token Intelligence 头部的 `7d / 30d / all` 为全局窗口控制，但它驱动的是整页的 provider 摘要和分析数据：

- provider 卡片 usage 摘要使用同一窗口
- token 图表和明细使用同一窗口

窗口聚合还有一条硬约束：

- `7d / 30d` 可以保留逐日 bucket
- `all` 不能继续无限按天展开，必须切成按周 / 按月聚合，或者限制到大约 `60-90` 个柱以内

否则即便 SVG 可行，图表也会在真实数据量下失去可读性。

#### 6.3 反向跳转

在 ranking / 明细中点击某个 provider 时：

- 上方 provider 卡片自动切中
- inspector 保持当前查看态，不自动跳进编辑态

这能形成“看见问题 -> 回到配置”的闭环。

同时要加一条硬边界：

- provider ranking 只在全局视角下出现
- 一旦已经选中某个 provider，breakdown 默认切到 model 或 request 维度

否则页面会同时存在两个 provider 导航面，信息架构会重新打架。

### 7. 布局协调策略

#### 7.1 默认桌面窗口

默认窗口不建议做“左右硬分 50/50”。

原因：

- provider 卡片板需要横向宽度来展示 `3-4` 列
- 图表也需要横向宽度才能像桌面分析面板
- 如果两者左右并列，同一时间两边都会变窄，最终两边都不好看

因此默认桌面窗口采用：

- 上：provider 卡片板
- 下：token intelligence

但它们处于同一个工作台语义下，而不是两个互不相关的 section。

默认窗口还要补一条硬约束：

- 不允许 provider board 在首屏占掉大部分可视高度
- Token 主图必须和 provider board 同时进入首屏视野

#### 7.2 超宽窗口

在超宽窗口下，可以进入增强布局：

- provider board 顶部保持全宽
- token intelligence 内部切成 `8 / 4` 两栏
- 如果 provider inspector 常驻，则在 provider board 右侧增加 detail pane

也就是：超宽时先增强面板内部结构，而不是一上来把整页强切左右大分栏。

这里还要补充最小可读宽度约束：

- 只有主图仍能保住桌面分析面板应有宽度时，Token Intelligence 才允许切 `8 / 4`
- 否则继续上下堆叠
- 常驻 inspector 出现时，要优先保证主图和 provider board 的可读宽度，而不是强行保留过多列数

### 8. 视觉语言

本轮视觉语言要满足三条：

- 更像桌面 pane，不像 marketing dashboard
- 比当前 settings page 更轻，但不做过度扁平化
- 暖色 / 深色主题都能稳定工作

具体约束：

- 页头轻量，退出大标题 hero
- 卡片板使用统一 surface，不叠多层高光
- 图表容器和 ranking 容器都使用 pane 语法
- 按钮层级严格控制，只保留一个主动作
- 所有指标、状态和过滤态都遵守当前 theme token，不写死浅色背景

## 实施建议

### Phase 1

- 重写 `/models` 顶层信息架构
- 把 `ProvidersSettings` 拆成 `ProviderBoard + ProviderInspector`
- 建立共享选择态和共享时间窗口

### Phase 2

- 把 token 区从旧 `UsageBarChart + 明细列表` 升级成 `KPI + 主趋势图 + ranking + 明细`
- provider 卡片接 usage 摘要

### Phase 3

- 做超宽窗口增强布局
- 收口深色主题、Windows/mac 细节、空态与加载态

## 自我批评

### 1. 为什么不直接左右分栏

看起来更像“工作台”，但实际会同时压坏 provider 卡片和图表可读宽度，属于为了像工作台而牺牲实际使用效率，不合理。

### 2. 为什么不继续复用 `ProvidersSettings`

继续复用整个组件只会把旧的网页设置页思维带进新页面。真正可复用的是 store、数据模型和字段编辑逻辑，不是现有页面骨架。

### 3. 为什么不直接上图表库

当前仓库没有现成图表栈，需求也还没复杂到必须引重库。先用轻量 SVG 组件做出桌面感和清晰层级，更符合 KISS。

### 4. 为什么 provider 卡片不直接展开编辑

因为这会立刻破坏卡片板的自适应列数和视觉密度，和“工作台卡片板”的目标正面冲突。
