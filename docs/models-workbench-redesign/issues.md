# 模型工作台重构问题跟踪

## 当前已知问题

### 0. 当前实现的首屏优先级依然错位

虽然 `/models` 已经具备 Provider Board、Inspector 和 Token Intelligence，但用户最新 review 明确指出：

- 首屏先看到大号 KPI 和图表，而不是 provider 资源入口
- Provider Board 被做成了 usage 的附属过滤器
- 整体更像网页 dashboard，不像桌面工作台

本轮处理：

- 设计文档明确改为 `Provider First`
- 单击 provider 卡片直接进入配置聚焦态，并联动过滤分析区
- Token Intelligence 降级为次级分析区，不再抢首屏
- 当前已完成首批实装收口：Provider Board 重新回到首屏前部，Token Intelligence 改成 compact header + 主图 pane，但仍需要继续压缩默认窗口下的留白密度

### 0.1 当前大号 KPI 卡属于错误表达，不是“还可以再优化”的版本

问题不在配色，而在信息密度和位置都错了：

- 四张大卡把最不该先看的信息放在了最上面
- 它们会自然制造 dashboard 感和网页感
- 即使换阴影、字体、圆角，也不会变成桌面 pane

本轮处理：

- 删除“首屏大 KPI 卡”这一表达
- 改成图表区头部的一条紧凑摘要带

### 0.2 当前主图的“柱顶大数值”表达噪声过高

用户真正关心的是：

- 最近有没有异常波动
- 哪个 provider / model 在承担主要消耗
- 接下来该回去改哪个 provider

而不是默认就看每一天的精确柱顶大数字。

本轮处理：

- 主图默认强调趋势和归因
- 精确值降级到 hover、辅助摘要或次级区域
- 图表继续保留轻量 SVG，不引重库

### 1. 继续复用整个 `ProvidersSettings` 会把旧信息架构带进新页面

这不是样式问题，而是交互模型问题。旧组件默认假设：

- provider 列表就是设置列表
- 编辑在卡片里内联展开
- 页面纵向滚动是主要工作方式

本轮处理：

- 只复用 store、数据模型和部分表单字段逻辑
- 页面骨架拆成 `ProviderBoard + ProviderInspector`

### 2. Provider 卡片和编辑器的职责边界必须切清

如果卡片承担太多字段，会重新长成小表单；如果承担太少，又失去工作台概览价值。

本轮处理：

- 卡片只放概览、状态、usage 摘要和轻动作
- 完整编辑全部进入 inspector

### 3. 图表如果直接引入重量级库，性价比不足

当前仓库没有现成图表依赖，当前需求也只需要：

- 一个主趋势图
- 一个 breakdown ranking
- 若干 KPI

本轮处理：

- v1 先用轻量 SVG 自绘
- 只有当需求进入多轴、多层交互、导出等复杂阶段时，才评估引库

### 4. Provider 与 Token 的协同如果只做到“视觉并列”，会继续失败

这轮真正的设计风险不是排版，而是两块内容没有共享状态。

本轮处理：

- 建立 `selectedProviderAccountId + runtimeProviderKey` 双层键
- 建立全局 `usageWindow`
- 卡片、图表、明细都走同一套过滤态

### 5. 默认窗口下整页左右大分栏会同时压坏卡片板和图表

用户要求完整工作台，这个方向是对的；但如果直接把 provider 区和 token 区做成 `50 / 50` 并排，会出现两个直接问题：

- provider 卡片列数不够，只能退回窄条
- 图表横向空间不够，桌面感直接消失

本轮处理：

- 默认窗口优先上下工作区
- 超宽时增强面板内部布局，而不是整页一刀切左右分栏

### 6. Cost 数据存在缺口

当前 usage 历史里 `costUsd` 是可选字段，不是每条记录都稳定存在。

本轮处理：

- v1 默认以 tokens 为核心指标
- cost 作为可切换视角，但必须对缺失数据做好降级

### 7. Provider 卡片 usage 摘要会引入额外聚合成本

要让卡片展示 `7d tokens / 7d cost`，页面需要在 usage 加载后做 provider 维度聚合。

本轮处理：

- 复用当前 usage 原始记录，只在前端做轻量聚合
- 不新增新的后端统计接口，避免过度设计

### 8. usage 记录里的 provider 键和配置页 account 主键不是同一个东西

设计稿最初把“选中的 provider”说成单一状态，但真实 usage 数据里只有 runtime provider 字符串，配置页则以 `account.id` 为主键。

本轮处理：

- 设计文档补齐 `selectedProviderAccountId + runtimeProviderKey` 双层键
- provider 卡片、图表和明细统一通过映射层对齐

### 9. `all` 时间窗口如果继续无限按天展开，SVG 也会失去可读性

问题不在 SVG，本质在 bucket 数量失控。

本轮处理：

- `7d / 30d` 保留逐日 bucket
- `all` 改成按周 / 按月聚合，或限制在约 `60-90` 个柱以内

### 10. 默认窗口下最危险的是首屏高度失控，而不是列数本身

如果 provider board 继续无限向下长，即使图表本身设计正确，首屏仍然会退回网页分段页。

本轮处理：

- 设计文档新增默认态 / 聚焦态 / 超宽态模式契约
- 设计文档新增“Provider Board 最多 2 行首屏卡片，Token 主图必须首屏可见”的硬约束
- 当前已落实真实 clamp：Provider Board 默认态超过两行时进入内部滚动，不再只是 `data-overflow-mode="clamp"` 的假契约

### 17. `/models` 浏览器 fallback 一度会在渲染阶段直接崩溃

真实问题：

- 页面直接读取 `window.electron.platform`
- 在无 preload 的浏览器 fallback 下会抛出 `Cannot read properties of undefined`

本轮处理：

- 平台读取改成安全分支，缺失 `window.electron` 时回退到默认值
- 已用定向回归锁住“浏览器 fallback 不崩”

### 18. Provider 卡片曾经继续沿用网页设置项的按钮堆叠语法

真实问题：

- 卡片下半部分被 `docs / edit / set default / delete` 一排按钮占满
- 主点击“进入聚焦配置态”和次级管理动作发生竞争
- 视觉上更像 settings row，不像桌面入口板

本轮处理：

- 卡片主区只保留身份、状态和 usage 摘要
- `Edit / Set default / Delete` 全部回收至 inspector footer
- 卡片 footer 只保留轻量 `docs` 和“进入配置 / 正在查看”状态提示

### 19. ultrawide rail 模式一度是不可达的假能力

真实问题：

- `pane` 的阈值先达到，但 `ultrawide + inspectorPinned` 的阈值又设得更高
- 实际内容宽度根本触发不到 rail 模式

本轮处理：

- 调整 pinned ultrawide 阈值到真实可达范围
- 扩大 `/models` 页面壳层最大宽度，保证 rail 模式在超宽窗口下能实际出现

### 20. Provider Inspector 的 drawer / modal 一度是手写 overlay，不具备共享 primitive 的基础能力

真实问题：

- 没有真正的 dialog / sheet 语义
- Esc、backdrop、焦点管理都依赖手写层
- 看似“能弹出来”，本质仍是网页式浮层

本轮处理：

- `modal` 切到共享 `Dialog`
- `drawer` 切到共享 `Sheet`
- 补齐标题、描述和关闭语义，保留 `pane` 作为常驻桌面侧栏

### 21. 同一 runtime provider 下的多账号一度只有隐式主账号，没有显式切换入口

真实问题：

- Provider 卡片汇总的是 runtime provider scope，不是单账号
- inspector 默认只会落到某一个账号，但用户看不到切换入口
- 这会导致“我看到的是 provider 级分析，但右侧到底在编辑哪个账号”变得不透明

本轮处理：

- inspector 头部增加同 scope 账号切换位
- 当前账号的副标题明确显示 `account.id · runtimeKey/vendorId`
- 切换账号时只切右侧配置对象，不打断下方 usage scope

### 22. 历史 usage 点击到已失效 provider 时，一度会静默退化

真实问题：

### 23. Provider Inspector 一度仍然带着网页 settings form 的空洞密度

真实问题：

- “当前范围”被单独做成整块卡片，和 modal 头部重复表达同一组信息
- compact 编辑表单虽然进了双列，但左侧基础信息会被右侧接入配置错误拉高
- 回退策略在折叠态仍是一整块大卡，像网页 Accordion，不像桌面 pane

本轮处理：

- 当前 provider 身份、默认态、凭证态统一合并进 inspector 头部
- compact grid 改成 `items-start + auto-rows-min`
- 回退策略折叠态改成带摘要的紧凑行，只在展开后显示详细字段

### 24. `/models` inspector 一度没有完全跟随全局 substrate

真实问题：

- modal、pane、section、field 仍掺杂页面私有的背景和边框表达
- 这会让 `/models` inspector 看起来比 `Channels / Skills` 更像网页浮层

本轮处理：

- inspector 外壳和内部 section 全部优先对齐 `global-theme-refresh`
- 统一复用 `app-modal-surface / app-pane-surface / app-insight-surface / app-field-surface`
- 状态 chip 保留功能语义，但基底不再脱离全局冷中性 substrate

### 25. Token Intelligence 一度仍像网页 dashboard / 报表页

真实问题：

- 头部摘要、指标切换和时间窗口被拆成多层网页式控制区
- breakdown 每行都是独立卡片，噪音太高
- 最近请求每条一张卡，导致列表像网页 feed，不像桌面工作台资源行

本轮处理：

- Token Intelligence 头部收成单层 pane header
- breakdown 改成更轻的资源行和细条指标
- 最近请求改成单 pane 内部列表，分页按钮改成桌面工具按钮

- breakdown / 最近请求里的 provider 可能来自历史数据
- 当前配置中如果已经不存在对应 provider，原先逻辑会把 `null` 继续传入选择链
- 结果是用户点了某个 provider，却没有得到明确反馈

本轮处理：

- 选择前先解析 runtime provider key 到当前配置账号
- 解析失败时保留当前页面状态
- 使用 toast 明确提示“该 provider 已不在当前配置中，需要先添加或恢复”

### 23. `/models` 一度错误地依赖“别的页面先初始化 provider store”

真实问题：

- 页面只读 `useProviderStore` 当前值，但没有在自身生命周期里触发 `refreshProviderSnapshot`
- 如果用户直接进入 `/models`，而之前没进过 `Settings / Setup`
- store 仍是空数组，页面就会误判成“还没有提供商”

本轮处理：

- `/models` 挂载时主动刷新 provider snapshot
- provider 正在加载且本地尚无数据时，先显示加载态，不再闪空态

### 24. 默认态 Provider Board 一度重复了页头语义

真实问题：

- 页头已经说明“模型 / 管理提供商与用量”
- Provider Board 默认态又重复输出“模型提供商 / 选择一个提供商...”
- 首屏层级因此显得像网页式说明文案堆叠，而不是桌面 pane

本轮处理：

- 默认态移除重复的 board 标题说明
- 只保留空态和加载态需要的必要文案

### 11. Task 1 初版一度只形成“测试驱动的表面 API”，没有真正接进生产链

第一次实现里，`workbench-layout.ts` 和 `workbench-view-model.ts` 的 contract 只被单测消费；`/models` 真实入口只接入了 `usage-history` 的月聚合修复，runtime key 映射、provider usage summary 和 KPI 仍未形成页面闭环。

本轮处理：

- 在现有 `/models` 页面中补入轻量 `Provider Board + 紧凑摘要带`
- 让页面真实消费 `getModelsWorkbenchMode / getProviderBoardColumns / getTokenIntelligenceLayout`
- 让页面真实消费 `resolveSelectedRuntimeProviderKey / buildProviderUsageSummaries / buildUsageKpis / getBreakdownDimension`
- 新增 render 测试，锁住“点击 provider 卡片后，聚焦态与分析区同步过滤”的生产链

### 12. 多账号共享同一 runtime provider key 时，汇总对象不能伪装成单账号

第一次实现虽然去掉了重复计数，但仍把汇总结果挂到“第一个命中的账号”上，等于把 provider 级事实静默折叠成单账号语义。

本轮处理：

- `findProviderAccountByRuntimeKey` 改成返回全集匹配，而不是第一命中
- `ProviderUsageSummary` 改成 provider 级结构，只保留 `accountIds / accountLabels / accountCount / runtimeProviderKey`
- 多账号共享 runtime key 时，展示名回退到 `runtimeProviderKey`，不再假装它属于某个主账号

### 13. 如果直接删掉旧 `ProvidersSettings`，`/models` 会失去添加 provider 的入口

这个问题在 Task 4 结束时确实存在，因为当时新增 provider 的完整实现还绑在旧设置页里的 `AddProviderDialog` 链路上。

本轮处理：

- 把 `AddProviderDialog` 抽成共享对话框组件
- 把创建 provider 的 store 绑定逻辑抽到独立 helper
- `/models` 与 `ProvidersSettings` 复用同一条新增 provider 链路
- `/models` 不再内嵌或展开 legacy provider manager

### 14. Inspector 的四组结构不能随着 provider 类型漂移

第一次接 Task 4 时，像 OpenAI 这类没有 `baseUrl / model` 可编辑字段的 provider，会把“接入配置”整组直接省掉。这会让 inspector 结构随着 provider 类型漂移，退回成条件网页表单。

本轮处理：

- 固定保留 `基础信息 / 接入配置 / 回退策略 / 凭证与验证` 四组结构
- 没有额外字段的 provider 也保留该组，并显示只读摘要或空态
- 用测试锁住 `view / edit` 与 `modal / drawer / pane` 三种模式，不允许后续回退

### 15. 共享表单 section 不能直接吃 store 级三参校验函数

Task 3 抽出 `ProviderAccountFormSections` 后，组件 contract 被收敛成 `(key, options) => result`，但 `/models` inspector 原本直接把 store 的 `validateAccountApiKey(accountId, key, options)` 原样往里传。这样会把“当前编辑的是哪个账号”这个页面级决策泄漏进通用组件边界。

本轮处理：

- 共享表单 section 继续保持二参校验 contract，不感知 `accountId`
- `ProvidersSettings` 在卡片层绑定当前账号
- `/models` 在页面层绑定 `selectedProviderItem.account.id`
- 用 `typecheck` 和定向 lint 锁住这条边界，避免后续再把 store 签名直接传进共享组件

### 16. 超宽模式和 Token Intelligence 布局判定一旦分叉，就会出现“页面已超宽、图表仍堆叠”的错位

Task 6 收口时暴露过一次典型问题：`/models` 根容器已经进入 `ultrawide`，但 `models-token-intelligence` 仍然保留 `stack` 布局。问题不在 CSS，而在两个布局 contract 走了不同的判定输入，页面语义和面板语义开始分叉。

本轮处理：

- 用 `models-page` 回归测试锁住“超宽模式 = Token Intelligence split 布局”的契约
- 页面实际渲染直接消费同一套 workbench layout contract，不允许根布局和 token 面板各自猜断点
- 保留 `inspectorPinned` 这一维，但它只能通过同一套 helper 影响阈值，不能在页面里额外派生一套局部规则

### 17. Provider 卡片点击热区做窄了，导致体感像“点好几次才打开”

真实问题：

- 默认态卡片只有上半块是 `<button>`
- footer、docs 旁边的留白和卡片底部并不参与主点击
- 用户点击卡片下半区时不会进入 provider 聚焦态，体感就像点击不灵敏

本轮处理：

- `ProviderBoardCard` 改成整卡可点击的资源卡
- docs 链接保留独立交互，并显式阻断冒泡
- 键盘回车 / 空格也能从整卡触发聚焦，不再只绑定到上半块按钮

### 18. Inspector 只加圆角不够，真正的问题是宽度和单列密度

真实问题：

- modal 虽然换成了 dialog/sheet primitive，但编辑态仍是窄宽度 + 单列表单
- 信息一多就只能靠垂直滚动解决，导致“看起来像网页浮层”
- 用户看到的不是桌面 inspector，而是一层更圆的长表单

本轮处理：

- Dialog 宽度提升到接近桌面工作台的承载宽度，drawer 也同步加宽
- `ProviderAccountFormSections` 增加 inspector 专用 `compact` 密度，只在 `/models` 编辑态启用
- 接入配置、回退策略和凭证区在 compact 模式下改成更高密度布局，减少不必要滚动
- Settings 页继续保留原始阅读密度，避免把另一条功能线一起带坏

### 19. 查看态的信息组织仍然过于网页化，宽 modal 也会被单列大卡片浪费掉

真实问题：

- 查看态虽然进入了 desktop modal，但主体仍是单列纵向 section card
- 卡片之间的留白比信息本身还显眼，modal 宽度没有被有效利用
- 用户感受到的不是“桌面 inspector”，而是“网页详情页塞进弹窗”

本轮处理：

- 查看态改成双列信息板，当前范围头卡压紧
- 基础信息 / 接入配置 / 回退策略 / 凭证与验证进入统一的紧凑网格
- 底部动作区右对齐，避免继续像网页表单 footer 那样占整行

### 20. `/models` 当前最容易跑偏的，不是颜色，而是没有持续对照 `WU-01 ~ WU-07`

真实问题：

- 修卡片时容易只盯图标、阴影、颜色
- 修 modal 时容易只盯宽度和圆角
- 结果局部变了，但默认态 / 聚焦态 / 超宽态的工作台语法还是没有统一

本轮处理：

- 正式把 `/models` 单独对照 `workbench-style-unification` 重新审计
- 明确本轮主偏差只看三块：`Provider Board / Inspector / Token Intelligence`
- 不再把“继续找更彩的 icon”当成主线任务

### 21. Provider Board 仍然容易滑回“信息卡片墙”，而不是桌面资源板

真实问题：

- 大图标壳、重复元信息和固定最小高度会制造“网页卡片墙”
- 如果再继续给图标壳加品牌色，会进一步偏离桌面 substrate
- `custom` 这类没有原生品牌图标的 provider，更容易被错误做成装饰性彩色块

本轮处理：

- 卡片继续压回资源板语法：标题、状态、usage facts、utility 四层即可
- 图标只允许两种来源：真实原生品牌图标，或中性壳里的单字母/单色 glyph
- accent 只允许落在小面积文字和原生品牌图标，不允许再给整个图标壳染色

### 22. Token Intelligence 仍然残留“报表页组件”思维，而不是工作台 pane

真实问题：

- 摘要带一旦做成独立壳，就会和图表 pane 形成双层 dashboard chrome
- breakdown / 最近请求如果每行继续用小卡片，就会重新长回网页报表列表

本轮处理：

- 摘要带、主指标切换、时间窗口重新并入同一条 header 语法
- breakdown 与最近请求统一改成分隔式资源行
- 主图、ranking、明细继续保留，但它们都被降级到同一 pane 内部，而不是再各长一个摘要壳
