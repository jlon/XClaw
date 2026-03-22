# 频道中心重构设计

## 背景

当前 XClaw 的频道功能已经具备真实可用的配置、保存、验证、默认账号、绑定 Agent、运行态状态回读能力，但交互层仍停留在“页面列表 + 弹窗编辑”的早期结构，导致以下问题同时存在：

- 新增入口分散，用户无法形成稳定心智模型
- 已配置账号、默认账号、绑定 Agent、编辑配置分散在不同交互层
- 字段模型只有一层 `configFields`，无法承载“基础配置 / 通用高级 / 渠道专属高级”
- 后端已支持的高级参数没有系统暴露，页面能力明显落后于真实能力

本轮目标不是局部补按钮，而是把频道页面重构为可长期扩展的“频道中心”工作台。

## 现状 Review

### 当前实现的真实能力

基于以下代码可确认，现有后端已经支持多账号、默认账号、启停、绑定 Agent、配置验证与运行态状态聚合：

- `src/pages/Channels/index.tsx`
- `src/components/channels/ChannelConfigModal.tsx`
- `electron/api/routes/channels.ts`
- `electron/utils/channel-config.ts`

其中：

- `/api/channels/accounts` 已经返回按渠道聚合的账号视图
- `/api/channels/config/:type` 已经支持读取指定账号配置
- `/api/channels/config`、`/api/channels/default-account`、`/api/channels/binding` 已经支持保存、设默认、绑 Agent
- `channel-config.ts` 已经处理多种高级参数的持久化与清洗

问题不在后端完全没有能力，而在前端结构无法承载这些能力。

### 当前页面的关键问题

#### 1. 添加入口分裂

当前“支持的频道”卡片可以新增，已配置列表里又能添加账号，弹窗内部还要再次选择频道类型。用户会不断在“先选频道”还是“先找账号”之间切换。

#### 2. 编辑路径不自然

用户在页面中看到的是渠道和账号，真正编辑却在弹窗里完成，导致高频调参场景效率很差。

#### 3. 字段模型过于扁平

`src/types/channel.ts` 当前只有 `configFields`。这会直接导致：

- 必填凭证和高级策略混在一起
- 无法做折叠、摘要、分组
- 无法统一渲染通用高级配置

#### 4. 高级参数暴露不完整

`electron/utils/channel-config.ts` 已经明确处理了如下真实字段：

- 通用行为相关：`defaultAccount`、渠道级 `enabled`
- 访问策略相关：`dmPolicy`、`allowFrom`、`groupPolicy`
- 特殊转换字段：Telegram 的 `allowedUsers -> allowFrom`
- 当前基础字符串字段的通用读回：`extractFormValues()` 会回填字符串字段

同时还存在一类最初被视为“候选字段”的插件参数，例如 `mode`、`webhookPath`、`encodingAESKey`、`wsUrl`、`welcomeText`、`markdownSupport`。当前实现已经确认：其中字符串、布尔、数字、字符串数组、枚举类字段，可以通过 `saveChannelConfig()` + `getChannelEditorValues()` 形成当前 XClaw 的真实闭环，因此允许进入工作台，但必须明确标注来源为“插件参数”，不能伪装成核心基础配置。

当前 UI 只暴露最基础的账号凭证，能力严重不对称。

## 参考吸收

### 来自 oneclaw 的有效设计点

参考文件：

- `/Users/jianglong/workspace/oneclaw/settings/index.html`
- `/Users/jianglong/workspace/oneclaw/settings/settings.css`
- `/Users/jianglong/workspace/oneclaw/settings/settings.js`
- `/Users/jianglong/workspace/oneclaw/docs/design-guidelines-zh.md`

本轮吸收以下思路：

- 左侧固定渠道导航，而不是把“已配置”和“可添加”拆成两块内容
- 新增入口统一收敛到一个稳定位置
- 右侧常驻配置区，不依赖反复弹窗
- 高级配置使用折叠分组，而不是首屏全部展开
- 策略类字段必须带解释文案，降低误配概率
- 底部操作区固定，保存、验证、危险操作分层
- 绝对主要操作只能保留一个强强调色，其余操作尽量使用 outline / ghost，避免整页蓝色按钮抢层级

### 来自 youclaw 的有效设计点

参考文件：

- `/Users/jianglong/workspace/youclaw/src/channel/config-schema.ts`
- `/Users/jianglong/workspace/youclaw/src/channel/types.ts`
- `/Users/jianglong/workspace/youclaw/src/routes/channels.ts`
- `/Users/jianglong/workspace/youclaw/src/settings/schema.ts`
- `/Users/jianglong/workspace/youclaw/src/settings/manager.ts`

本轮吸收以下思路：

- 配置字段必须由 schema / registry 驱动，不能继续散落在组件里硬编码
- 字段元数据需要支持 `secret`、`required`、`options`、默认值、掩码、可见性控制
- 渲染层负责展示，校验与清洗继续由后端主导
- 字段分层和类型定义应该先于 UI 排版落地

### 来自 QClaw 实码的校准

本轮不再只看截图，而是直接参考本机安装版 QClaw 的 renderer 打包产物：

- `/Applications/QClaw.app/Contents/Resources/app.asar`
- `out/renderer/assets/c-8d_bn_BT.js`
- `out/renderer/assets/a-Bce15nMF.css`

从真实代码可确认：

- QClaw 的远控频道首页是 `remote-channel-grid + remote-channel-card` 的入口板，不是左侧 rail 里塞一列卡片
- 卡片自身承担图标、名称、推荐标记、说明文案、`配置 / 已配置` 状态、更多操作
- 已配置频道先停留在入口板上，由用户点击后再进入具体配置流，而不是页面首屏默认直接落到持久三栏工作台
- CSS 证据也说明其基础模式是“网格卡片 + 后续专属流程”，不是“默认两栏后再挤成三栏”

这条证据直接推翻了当前 XClaw 设计里“默认窗口优先两栏工作台”的前提，因此本轮必须先纠偏信息架构，再谈左栏密度和卡片样式。

## 目标

- 建立统一的频道中心入口
- 支持多账号自然编辑与切换
- 将字段明确分为“基础配置 / 通用高级 / 渠道专属高级”
- 暴露当前真实支持的高级参数，优先覆盖 Feishu、WeCom、DingTalk、Telegram、QQ Bot
- 保持现有保存、验证、绑定、默认账号、运行态状态链路可复用
- 保持 Win/mac 一致可用，不引入平台专属配置流程

## 非目标

- 不在 v1 中把所有渠道都补齐到同等高级度
- 不把会话级命令直接伪装成频道配置
- 不把频道中心重构成二次设置向导
- 不改现有 OpenClaw 渠道插件的运行机制

## 设计结论

### 0. 开发准则

频道中心后续开发不允许只盯着单个页面补局部样式，必须先做全局排查，再决定局部实现。

具体约束：

- 任何“左右留白过大 / 内容过密 / 主题不一致”的问题，先检查 `MainLayout`、主题 token、通用表单控件和工作台外层壳，不允许只在单个卡片里硬塞 `width` / `margin` 补丁
- 任何“首屏加载慢”的问题，先确认真实慢点是否来自路由探测、运行态 rpc、重复请求或阻塞刷新，不能只增加 loading 态掩盖问题
- 页面文案优先说人话，少用“绑定对象”“ID:”这类实现视角措辞；账号、Agent、连接状态必须让普通用户一眼看懂
- 布局调优必须同时兼顾暖色主题和深色主题，且要考虑窗口缩放后的换行、错位和滚动表现
- 新增行为必须先补单测或 e2e 约束，再改实现，避免频道页再次回到“看起来能用，实际容易漂”的状态

### 1. 页面骨架改为“双模式频道中心”

当前需要先纠正一个错误前提：频道页不是任何尺寸下都应该优先表现为“工作台”。对默认窗口而言，用户的首要任务通常是“看到有哪些频道、哪些已配置、从哪里接入”，不是立刻同时管理“频道 + 账号 + 配置表单”三块内容。

因此本轮采用 `B` 方案，并作为唯一主路径：

- 默认与标准窗口：先展示“频道入口卡片板”
- 在入口板中选中某个频道后：进入“聚焦编辑态”
- 只有超宽工作区：才切成“完整三栏工作台”

这不是风格偏好，而是职责分配：

- 入口板解决“我现在要接哪个渠道 / 管哪个渠道”
- 聚焦编辑态解决“我现在要管理这个渠道的账号和配置”
- 完整三栏工作台只服务于足够宽的高频运营场景

### 1.1 为什么放弃“默认两栏工作台”

继续坚持默认两栏，会同时犯三种错误：

- 把大量宽度浪费在“尚未选择频道时并不必要”的持久导航上
- 把频道发现与频道编辑两个任务强行揉在一个首屏里，导致默认窗口既不紧凑也不高效
- 为了塞下右栏编辑器而不断压缩左侧列表，最后只能做成“看起来像卡片，本质还是长列表”的伪改版

所以本轮不再修“左栏更紧凑”，而是直接把首屏恢复为独立入口板。

### 1.2 入口卡片板

入口板是频道页默认模式，承担以下职责：

- 展示所有频道，并按“已配置 / 待添加”分组
- 提供搜索与轻量筛选
- 汇总显示账号数、启停状态、连接摘要、接入方式
- 提供统一入口：配置、继续管理、更多操作

入口板不承载完整配置表单，不在首屏强行常驻账号列表。

#### 卡片内容

每张频道卡片至少包含：

- 品牌图标
- 渠道名称
- 可选 `推荐` 标记
- 最多两行说明文案
- 主动作：`配置` 或 `已配置`
- 已配置频道的次级动作：`更多`、解绑、查看详情
- 聚合摘要：账号数、启停状态、连接状态、主要接入方式
- 独立状态指示灯，继续保留明显但克制的“呼吸灯”语义

其中：

- 状态灯不能被挪没，也不能退化成纯装饰圆点
- 已配置卡片优先显示 `已配置` 胶囊，不再把账号 ID 直接塞在卡片主标题位置
- 未配置卡片只显示最关键的接入方式，例如 `二维码`、`令牌`、`Webhook`

#### 分组与排序

- `已配置` 永远在前，且按最近操作时间、启用状态、连接状态综合排序
- `待添加` 在后，按推荐优先级和渠道常用度排序
- 搜索结果优先保留原分组，不把“已配置”和“待添加”混成一锅

### 1.3 聚焦编辑态

在默认和标准窗口下，用户从入口卡片点击进入某个频道后，页面不直接上完整三栏，而是进入聚焦编辑态。

聚焦编辑态的原则：

- 顶部保留明确的“返回全部频道”入口
- 左侧只保留当前频道的账号列表或账号切换器
- 右侧优先给配置编辑区足够宽度
- 新增账号、重命名、默认账号、绑定 Agent、删除账号都在这个态里完成

这样可以在默认窗口中把宽度优先让给“当前正在编辑的内容”，而不是持续保留一个与当前任务无关的频道总导航。

### 1.4 完整三栏工作台

只有当页面可用宽度足够时，才切换到完整三栏：

- 左栏：频道入口 rail，但表现仍延续入口板的卡片摘要语义，而不是退回老式长列表
- 中栏：当前频道的账号与实例列表
- 右栏：常驻配置编辑区

三栏模式承担的是“高频运营态”，不是默认首屏态。

### 1.5 响应式阈值与切换原则

切换必须基于频道页内容容器宽度，而不是简单依赖窗口是否最大化。

#### 入口卡片板列数

入口板使用 `grid`，卡片遵循“先扩列，后缩卡；一旦低于最小可读宽度就减列”的规则：

- `< 640px`：1 列
- `640px - 959px`：2 列
- `960px - 1319px`：3 列
- `1320px - 1599px`：4 列

卡片的目标宽度区间为 `264px - 360px`。只要仍处于这个区间，就允许自动缩放；一旦下一列会把卡片压到 `264px` 以下，就必须减列，而不是继续硬缩。

实现层统一由单一布局契约导出 `board / focus / workbench` 模式、支持的 `1 / 2 / 3 / 4` 列集合、卡片最小可读宽度和三栏阈值，组件内不允许各自重写断点或列数判断。

#### 进入完整三栏的阈值

只有在同时满足以下条件时，才允许进入完整三栏：

- 频道 rail 可读宽度不少于 `248px`
- 账号栏可读宽度不少于 `320px`
- 编辑区可读宽度不少于 `760px`
- 栏间距与外层 padding 仍保有至少 `24px` 的呼吸空间

按当前 `WorkspacePage` 壳层估算，频道页内容容器至少需要约 `1600px` 才应切到完整三栏。低于这个阈值，即使技术上能挤下三栏，也不算“可用”，仍应停留在入口板或聚焦编辑态。

#### 缩放时的行为约束

- 从窄到宽：如果当前没有选中频道，仍停留在入口板；如果当前正在编辑，则在跨过阈值后平滑展开为三栏并保留当前选中频道与账号
- 从宽到窄：如果当前在三栏中编辑，不允许因为缩放直接把用户打回入口板；应先收敛成聚焦编辑态，保留当前上下文与未保存输入
- 只有用户主动点击“返回全部频道”时，才回到入口板

### 1.6 布局空间原则

- 页面宽度优先吃满可用工作区，频道页不再被固定 `max-w-5xl` 锁死
- 全局主内容区与频道页自身 padding 不能重复叠加，避免宽屏下左右两侧出现大面积空白
- 默认窗口尺寸下优先保证“入口板 3-4 卡并排”而不是“硬挤两栏工作台”
- 只有当可用空间足够同时容纳频道 rail、账号列表、配置编辑三块稳定可读宽度时，才允许进入三栏
- 聚焦编辑态和三栏态都必须让编辑区拿到优先宽度，不能为了保留导航而牺牲表单可读性
- 缩放或窄窗口下，按钮区、状态区、下拉框必须允许换行，不能依赖单行布局硬撑
- 频道页不能单独私有一套壳层策略，`Agents / Skills / Cron / Models / Settings / Channels` 应统一挂到共享 `WorkspacePage` 壳层上，避免页面之间留白与滚动策略再次漂移

### 1.7 首屏性能原则

- `/api/channels/accounts` 默认只取当前已知状态，不强制对运行时做主动 `probe`
- 只有用户手动点击刷新时，才请求 `?probe=1` 做主动探测
- 网关不在 `running` 时，不应继续等待无意义的 runtime rpc
- 后台状态同步应尽量静默刷新，避免页面因非必要的全屏 loading 频繁闪烁

### 1.3 操作层级与滚动策略

- 页面内只保留一个明确主动作：右栏“保存并重连 / 保存并启用”
- `添加频道`、`添加账号`、`查看文档`、`检查配置`、`刷新` 等都降级为 outline 或 ghost，避免和保存动作争夺注意力
- 渠道启停开关使用中性开关色，不再延续蓝色主按钮语义
- 页面主滚动区与右栏内部编辑滚动区都使用弱化滚动条，策略对齐聊天列表：mac 走更轻的 `subtle-scrollbar`，Windows 走更可见但仍克制的 `subtle-scrollbar-win`
- 字段默认值应尽量内联为 badge，而不是额外再占一整行说明，减少缩放后的错位风险
- 左栏状态不能只靠彩点表达，必须同时给出人话状态摘要，至少包含“账号数 + 连接状态 + 启停状态”
- 右栏行为区和字段区默认走紧凑控件：输入框 / 下拉 / 开关高度统一收敛，说明文案最多展示两行，避免缩放后控件错位
- 频道页内所有下拉控件必须统一走共享自定义 Select，不允许继续混用浏览器原生 `<select>`；否则 mac 会退回系统菜单样式，Windows 也会出现箭头、内边距和触发器高度不一致的问题
- 中栏头部动作区必须使用紧凑的共享布局规则，保证“添加账号 + 删除频道”在宽屏和缩放场景下仍维持同一视觉组，不允许自由换行后在卡片右上角留出大块空白

### 2. 先对齐 OpenClaw 真实配置契约

这是本轮必须先落地的前提，不能先发明 UI schema 再去猜配置。

当前代码能被证实的真实配置路径如下：

| 能力 | 实际写入路径 / 路由 | 读回方式 | 当前证据 |
| --- | --- | --- | --- |
| 账号级配置字段 | `channels.<type>.accounts[accountId].<field>` | `getChannelConfig()` -> `getChannelFormValues()` | `saveChannelConfig()` / `getChannelConfig()` |
| 默认账号镜像 | `channels.<type>.<field>` 从默认账号镜像 | 由插件直接读取顶层 | `saveChannelConfig()` / `setChannelDefaultAccount()` |
| 默认账号切换 | `channels.<type>.defaultAccount` | `/api/channels/accounts` | `setChannelDefaultAccount()` |
| 渠道启停 | `channels.<type>.enabled` | `listConfiguredChannels()` / `/api/channels/accounts` | `setChannelEnabled()` |
| Agent 绑定 | 非 `openclaw.json` 主配置字段，走单独绑定接口 | `/api/channels/accounts` 聚合返回 | `/api/channels/binding` |
| Telegram 允许用户 | UI `allowedUsers` -> 配置 `allowFrom[]` | `extractFormValues()` 映射回 `allowedUsers` | `transformChannelConfig()` / `extractFormValues()` |
| Feishu / WeCom 私聊策略 | `dmPolicy` 字符串直写到账户配置 | `extractFormValues()` 可回填字符串 | `transformChannelConfig()` / `extractFormValues()` |
| Feishu / WeCom 群聊策略 | `groupPolicy` 字符串直写到账户配置 | `extractFormValues()` 可回填字符串 | `extractFormValues()` 通用字符串回填 |

当前也能确认一个重要事实：

- `saveChannelConfig()` 会把未知字段原样写入账号配置，并在默认账号场景镜像到 `channels.<type>` 顶层
- `getChannelFormValues()` 对字符串字段做通用回填，对 `Telegram.allowedUsers` 做特殊映射
- `getChannelEditorValues()` 会在此基础上继续补齐布尔、数字、字符串数组字段的工作台回填

因此：

- 字符串字段可以较低成本纳入 UI
- 布尔、数字、数组字段只要能走 `editor-values` 读回链，也可以纳入工作台
- 仍未建立 `save -> editor-values -> 再保存` 证据的复杂嵌套字段，不能直接进入 v1 UI

### 2.1 账号标识编辑必须是真重命名，不允许只改展示文案

频道账号的“账号标识”不是普通备注字段，而是 `channels.<type>.accounts[accountId]` 的真实键。

因此本轮约束明确为：

- 允许编辑已有账号标识时，必须走真实 rename 链路
- rename 至少要同时更新账号配置树、`defaultAccount` 指针、默认账号顶层镜像字段，以及 Agent 绑定
- 如果旧绑定仍是遗留的 channel 级 fallback 绑定，且它原本承接的是 `default` 账号，则 rename 时也要把它转成新的账号级绑定，避免负责 Agent 静默丢失
- 页面保存时，账号标识变化必须先完成 rename，再继续保存当前表单值，并保持选中态落在新账号上

### 2.2 首屏模式和运行时状态必须尊重真实上下文

频道中心不能在数据还没回来时，先拍脑袋默认选到 `feishu` 之类的主推渠道，再把真正已配置的频道晾在一边；同样也不能在默认窗口进入页面时，未经用户选择就强制跳进某个频道的编辑态。

因此本轮补充两条硬约束：

- 入口板模式下，首屏应先展示全部频道概览，不自动钻进任一频道
- 只有在进入聚焦编辑态或完整三栏工作台时，才需要计算默认选中；优先级为：最近操作对象 > 首个已配置频道 > 首个主推频道
- 当网关或 runtime 状态不可用时，页面必须明确表达“运行时未就绪 / 当前仅展示本地配置”，不能继续把这种状态说成“未连接”

这条约束本质上也是开发准则的一部分：状态文案必须对应真实事实，不能把“没有拿到运行时状态”伪装成“已经确认断连”。

### 2.3 消息接入规则必须按用户任务组织，不能把白名单输入藏起来

访问控制的真实流程不是“先填一个抽象策略值”，而是：

1. 平台消息进入渠道插件
2. 渠道账号先做消息接入判断
3. 通过后才继续路由给负责 Agent

因此 Feishu / WeCom 的“访问控制”区必须改按用户任务组织：

- 区块标题改成“消息接入规则”
- 私聊策略与私聊白名单放在一起
- 群聊策略、群聊白名单和“仅在被 @ 时回复”放在一起
- 如果某个白名单字段已经有值，即使策略值暂时还没回填，也不能把这个字段隐藏掉

### 3. 建立分层字段模型

现有 `configFields` 不够用，本轮要升级为可分层 schema。

建议的新模型：

- `basicFields`
- `commonAdvancedFields`
- `channelAdvancedSections`
- `commonBehaviorControls`

每个字段元数据至少需要支持：

- `key`
- `label`
- `type`
- `required`
- `placeholder`
- `description`
- `options`
- `secret`
- `defaultValue`
- `summaryValue`
- `visibleWhen`

其中：

- `basicFields` 只放完成连接必需的字段
- `commonAdvancedFields` 只放跨渠道通用、且后端或插件已真实支持的配置字段
- `channelAdvancedSections` 用于承载渠道特有配置，并按子主题折叠展示
- `commonBehaviorControls` 用于承载不直接写入同一配置对象的通用操作，例如默认账号与 Agent 绑定

### 4. 通用高级与专属高级必须分开

这是这次重构的核心边界。

#### 通用高级

仅纳入满足以下条件的字段：

- 不属于某一渠道独有协议细节
- 当前后端或上游插件已有真实配置落点
- 能被用户理解为“回复行为 / 通道行为”而不是“底层协议参数”

v1 立即纳入的通用配置字段：

- 无

v1 建议纳入的通用行为控件：

- 渠道启停
- 默认账号
- Agent 绑定

注意：

- 当前通用高级字段先不做统一大包，因为现有 XClaw 还没有足够的闭环证据支撑一整组跨渠道高级字段
- 默认账号与 Agent 绑定属于通用编辑行为，但不应伪装成普通配置字段
- 渠道启停走单独路由 `PUT /api/channels/config/enabled`
- `/verbose` 暂不纳入 v1 频道配置。现有证据表明它更接近会话级运行行为，而不是所有渠道都稳定支持的持久化字段

#### 渠道专属高级

仅纳入该渠道真实支持、且用户确实会配置的字段。

#### 首批立即纳入的“已闭环字段”

这些字段满足至少一个条件：

- 当前 `channel-config.ts` 已有显式转换和回填逻辑
- 或当前已能通过“字符串直写 + 字符串回填”形成稳定闭环

首批立即纳入：

- Feishu：
  - `dmPolicy`
  - `groupPolicy`
- WeCom：
  - `dmPolicy`
  - `groupPolicy`
- DingTalk：
  - `robotCode`
  - `corpId`
  - `agentId`
  - `dmPolicy`
  - `groupPolicy`
- Telegram：
  - `allowedUsers`
- QQ Bot：
  - 暂不新增高级字段，只保留基础凭证

#### 首批以“插件参数”分组纳入的字段

这些字段的来源仍主要是插件 schema，但当前 XClaw 已经具备通用持久化与 `editor-values` 回填闭环，因此允许在右栏以“插件参数”分组展示，并通过 badge 明确来源：

- Feishu：
  - `encryptKey`
  - `verificationToken`
  - `domain`
  - `connectionMode`
  - `webhookPath`
  - `allowFrom`
  - `groupAllowFrom`
  - `requireMention`
  - `streaming`
  - `textChunkLimit`
- WeCom：
  - `mode`
  - `webhookPath`
  - `token`
  - `encodingAESKey`
  - `wsUrl`
  - `welcomeText`
  - `allowFrom`
  - `groupAllowFrom`
  - `requireMention`
- DingTalk：
  - `allowFrom`
  - `showThinking`
  - `messageType`
- QQ Bot：
  - `markdownSupport`
  - `dmPolicy`
  - `allowFrom`

#### 当前仍暂不直接暴露的“需先补适配字段”

当前仍只把没有现成 XClaw 闭环证据的复杂嵌套结构排除在 v1 之外，例如 `replyMode`、`footer`、`groups` 这类更复杂的字段。判断标准仍然不变：

1. 先在 `channel-config.ts` 中建立明确的序列化 / 反序列化适配
2. 用单测证明它能 `保存 -> 读回 -> 再保存`
3. 再进入工作台 schema

### 5. 交互原则改为“首屏简单，折叠高级”

页面默认只展开基础配置。高级配置采用折叠区，并显示摘要，例如：

- `流式输出：开启`
- `群聊策略：仅白名单`
- `分块长度：1200`

摘要优先显示当前值；如果当前值为空，再回退到默认值或字段数量。密码类字段只显示“已填写”，不直接泄露实际值。这样既不会把页面做成密集设置墙，也不会让高级参数继续消失。

### 5.1 编辑态必须防止静默丢失

聚焦编辑态和完整三栏工作台都比旧 modal 更高频切换，因此不能接受“用户改了右栏，再点另一个频道或账号，当前修改被静默覆盖”。

v1 规则：

- 右栏存在未保存修改时，切换频道或账号必须先弹确认
- 用户确认放弃后，才允许跳转到新的编辑目标
- 保存成功后，需要重新读取一次 `config-editor` 返回值，确保服务端标准化后的最终值立即回显到工作台

这样做的原因不是“更谨慎”，而是避免把工作台重新做成一个容易吞掉输入的危险界面。

### 5.2 配色必须服从现有主题体系

频道页允许保留暖色工作台气质，但不能依赖固定 hex 背景把暖色“写死”在组件里。否则浅色下还算协调，深色下就只能靠零散 `dark:` 补丁兜底，和项目其他页面的主题策略不一致。

本轮约束：

- 频道页主要 surface 优先使用现有 `background` / `foreground` / 半透明层级
- 暖色只保留在选中态等少量强调面，且必须同时提供深色对应样式
- 搜索框、选中卡片、基础配置区这类高频 surface，避免继续写死固定暖色 hex
- 新增账号仍要经过的 `ChannelConfigModal` 也必须使用同一套主题 token，不能继续保留旧暖色独立皮肤

### 5.3 新增账号后必须自然落到新对象

如果新增账号保存后仍停留在旧账号，用户还要再回中栏手动寻找刚创建的对象，属于明显的路径断裂。

本轮约束：

- `ChannelConfigModal` 保存成功后，必须把最终保存的 `channelType + accountId` 回传给页面
- 页面刷新账号列表后，要自动切到刚保存的账号
- 右栏随后必须基于该账号重新回读 `config-editor`，而不是继续停留在旧账号表单

### 5.4 字段可访问性不能继续缺位

频道页右栏已经成为主编辑入口，如果 `label` 没有正确绑定到输入框，键盘导航、辅助技术和自动化验证都会变脆。

本轮约束：

- 工作台内联编辑字段需要建立 `label -> input/select` 的显式关联
- e2e 不再依赖随机 DOM 层级和 placeholder 猜字段，而应能按字段名称稳定定位

### 6. 保留现有 API 主链，重构前端组织方式

本轮不优先扩新后端接口，而是先复用现有主链：

- `GET /api/channels/accounts`
- `GET /api/channels/config/:type`
- `POST /api/channels/config`
- `DELETE /api/channels/config/:type`
- `POST /api/channels/credentials/validate`
- `PUT /api/channels/default-account`
- `PUT/DELETE /api/channels/binding`

需要新增或重构的主要是前端配置 registry 与编辑器组织方式，而不是另起一套后端协议。

### 7. 弹窗退场为兼容壳

`ChannelConfigModal` 不再作为主交互路径。v1 处理方式：

- 页面新增、编辑统一进入聚焦编辑态或完整三栏中的配置编辑区
- `ChannelConfigModal` 只保留给少数需要特殊中断式流程的场景，或作为过渡兼容壳
- 目标是在功能稳定后进一步缩减或移除该 modal

## 结构设计

### 前端

建议新增以下结构：

- `src/pages/Channels/index.tsx`
  - 负责页面装配、数据加载、模式切换与选中状态同步
- `src/components/channels/ChannelEntryBoard.tsx`
  - 首屏频道入口板
- `src/components/channels/ChannelEntryCard.tsx`
  - 单个频道卡片
- `src/components/channels/ChannelFocusWorkspace.tsx`
  - 默认窗口下的聚焦编辑态骨架
- `src/components/channels/ChannelWorkbench.tsx`
  - 超宽模式下的完整三栏工作台骨架
- `src/components/channels/ChannelTypeRail.tsx`
  - 三栏模式下的频道 rail
- `src/components/channels/ChannelAccountList.tsx`
  - 聚焦编辑态与三栏模式共用的账号列表
- `src/components/channels/ChannelConfigEditor.tsx`
  - 右栏编辑器
- `src/components/channels/ChannelFieldRenderer.tsx`
  - 根据字段 schema 渲染通用表单控件
- `src/components/channels/ChannelAdvancedSection.tsx`
  - 折叠式高级分组
- `src/lib/channel-registry.ts`
  - 统一定义页面可见的渠道字段分层、通用行为控件、以及字段契约

### 类型层

建议重构：

- `src/types/channel.ts`

方向：

- 保留 `ChannelType`
- 将 `ChannelMeta` 从单层 `configFields` 升级为分层 schema
- 把展示信息和编辑 schema 分离，避免继续把描述文案与表单模型绑死

### 后端

优先复用现有能力，必要时补轻量辅助方法：

- `electron/utils/channel-config.ts`
  - 继续作为持久化、清洗、兼容迁移中心
- `electron/api/routes/channels.ts`
  - 继续负责页面所需账号聚合与保存调用

v1 不建议新增大规模专用编辑接口，避免把重构范围扩到协议层。

### registry 契约要求

`channel-registry.ts` 不能只描述“怎么显示”，还必须声明：

- `fieldKey`
- `storagePath`
- `readStrategy`
- `writeStrategy`
- `valueType`
- `evidence`
- `evidenceLevel`

其中：

- `storagePath` 必须指向真实 OpenClaw 配置路径或真实动作路由
- `readStrategy` 必须说明是通用字符串回填、专用转换，还是动作接口聚合
- `evidence` 必须标明代码依据，避免后续字段再次凭印象加入
- `evidenceLevel` 只能取：
  - `current-xclaw-roundtrip`
  - `current-xclaw-route`
  - `upstream-plugin-only`

其中：

- `current-xclaw-roundtrip` 才允许直接进入 v1 字段
- 当前工作台已展示的插件参数，也必须提升为 `current-xclaw-roundtrip`，不能继续标成 `upstream-plugin-only`
- `current-xclaw-route` 仅适用于默认账号、渠道启停、Agent 绑定这类行为控件
- `upstream-plugin-only` 只能进入候选池，不能直接显示到 v1 UI

## 迁移策略

### 旧配置兼容

- 现有 `openclaw.json` 中的渠道配置继续沿用
- 页面只是重新组织编辑能力，不要求用户重新配置
- 读取旧配置时，仍通过现有 `getChannelFormValues()` 等逻辑回填

### 默认选中逻辑

- 首次进入频道页且处于入口板模式时，不自动选中频道
- 当用户进入聚焦编辑态或页面处于完整三栏模式时，优先选中最近操作的渠道
- 若没有最近操作记录，则选中首个已配置渠道
- 若完全未配置，则选中首个主推渠道

### 旧交互兼容

- 若外部代码仍调用 `ChannelConfigModal`，先保持可用
- 页面内部不再主动依赖 modal 开展主要流程

## 风险与控制

### 风险 1：字段边界继续失控

处理：

- 先定义“字段契约表”，再定义 schema 分层
- 只纳入已有真实落点和真实回填链路的字段
- `/verbose` 等边界不清字段不在 v1 强行落地

### 风险 2：页面重构后保存链路回归

处理：

- 复用现有 host-api 路由，不改保存协议
- 先完成工作台 UI 与状态管理，再逐项接入保存

### 风险 3：高级配置过多导致页面臃肿

处理：

- 高级区默认折叠
- 用摘要替代首屏铺满字段
- 渠道专属高级再按主题分组

### 风险 4：Win/mac 体验不一致

处理：

- 不引入平台专属交互
- 维持现有 renderer -> host-api -> main 的边界
- 所有滚动区、阴影、粘性操作条都按跨平台样式约束处理

### 风险 5：入口板和工作台在缩放时频繁抖动

处理：

- 布局切换只看内容容器宽度，不看浏览器缩放倍率或窗口是否最大化
- 三栏阈值使用固定最小可读宽度，而不是“差不多能塞下就切”
- 从三栏收窄时先退到聚焦编辑态，不允许直接丢上下文回入口板

## 本轮范围

### v1 必做

- 频道入口卡片板
- 聚焦编辑态
- 超宽三栏工作台骨架
- 统一新增入口
- 渠道选择、账号选择、编辑区联动
- 基于 OpenClaw 真实配置路径的字段契约表
- 字段 schema 三层模型
- Feishu、WeCom、DingTalk、Telegram、QQ Bot 的首批“已闭环字段”接入
- 保存、验证、默认账号、绑定 Agent、删除账号的工作台化

### v1 不做

- 所有渠道一次性补齐高级配置
- 未建立 round-trip 证据的结构化高级字段
- 把所有命令级运行参数塞进频道页
- 自定义拖拽布局
- 多页面设置向导

## 结果标准

当以下条件成立时，认为本轮设计落地成功：

- 用户在默认窗口下首先看到的是清晰的频道入口卡片板，而不是被挤压的工作台
- 用户能在一个稳定入口完成新增频道和新增账号
- 用户能从入口板自然进入聚焦编辑态，并在超宽窗口中无缝升级为三栏工作台
- 用户能在同一页面完成查看、编辑、验证、保存和删除
- 页面能清晰区分基础配置、通用高级、渠道专属高级
- 已有配置无迁移中断
- Feishu / WeCom / DingTalk / Telegram / QQ Bot 的高级参数不再只能靠手改配置文件

## 设计自审记录

### 第 1 轮：推翻错误前提

初稿沿用了“默认两栏、够宽再三栏”的旧假设，只是试图把左栏做得更像卡片。这一版本质上仍是长列表导航，解决不了默认窗口宽度浪费的问题，也和 QClaw 实码的入口板模式不一致。

修正：

- 删除“默认两栏工作台”前提
- 改为“入口卡片板 -> 聚焦编辑态 -> 超宽三栏”的双模式频道中心

### 第 2 轮：补齐切换阈值

第二轮发现如果只写“窗口大了就变三栏”，实现时一定会退化成拍脑袋断点，最终还是会在默认窗口提前挤出三栏。

修正：

- 明确入口板的列数断点
- 明确卡片最小可读宽度 `264px`
- 明确完整三栏的最小可读宽度预算和约 `1600px` 容器阈值

### 第 3 轮：补齐缩放中的上下文保持

第三轮发现如果只定义“入口板”和“三栏”，缩放时会出现两个坏结果：

- 正在编辑时缩小窗口，用户被直接打回入口板
- 正在浏览入口板时放大窗口，页面可能强制跳进某个频道

修正：

- 新增“聚焦编辑态”作为中间态
- 规定从宽到窄先退到聚焦编辑态，不直接退到入口板
- 规定入口板放大到超宽时，只有已经存在选中上下文才自动展开三栏

### 第 4 轮：补齐信息架构与视觉边界

第四轮发现如果只说“做成卡片网格”，实现很容易再次走偏成彩色大砖块，或者把账号 ID、状态、动作一股脑塞满卡片头部。

修正：

- 卡片只承载聚合摘要，不承载完整账号编辑信息
- 已配置卡片主状态统一为 `已配置` 胶囊，账号详情进入后续态再展开
- 呼吸灯继续保留，但必须和人话状态摘要同时存在，不能再退化成唯一语义

### 第 5 轮：清理旧术语残留

第五轮发现文档里还残留“工作台右栏”“统一工作台入口”这类旧术语，会误导实现者继续把默认模式理解成持久三栏。

修正：

- 目标改为“统一的频道中心入口”
- 明确新增、编辑统一进入“聚焦编辑态或完整三栏中的配置编辑区”
- 组件命名从含糊的 `ChannelChannelCard` 收敛为 `ChannelEntryCard`
