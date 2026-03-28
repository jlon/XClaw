# 全局主题重构问题跟踪

## 核心问题

### 1. 旧主题主线仍然是“品牌配色方案”，不是“桌面视觉系统方案”

之前最大的问题不是颜色选错，而是设计主线错位：

- 先定了品牌色
- 再让页面去适应品牌色
- 最后用 glow、渐变、暖底去补“质感”

这会天然导向网页感。

本轮处理：

- 主线改写为 `QClaw substrate, XClaw accent`
- 以后先做桌面基底，再做品牌点缀

### 2. 浅色主题仍然最容易回到网页感

真正的回退信号有 4 个：

- 暖米色主底
- 整页 glow
- 面板渐变
- 厚表单感搜索框/输入框

本轮处理：

- 浅色主题明确以 `#fafafa / #f5f5f5 / #f0f0f0 / #e5e5e7` 这一档为事实基准
- 禁止再把暖色基底当“桌面感”
- 新增约束：任何 modal、empty state、stat panel 都必须优先复用共享 substrate，禁止每页继续发明暖色或高阴影容器
- 新增约束：即使 token 已回冷，workspace shell、sidebar 和搜索入口也不能继续保留“页中大卡片 + 常驻厚表单”语法，否则网页感仍会回流

### 3. 品牌色如果继续承担背景职责，网页感一定会回来

深红铜适合做：

- 焦点
- 激活
- 主按钮
- 品牌识别

不适合做：

- 整块底色
- 常规 hover
- 常规列表 active 大面
- 常规搜索/输入背景

本轮处理：

- 品牌色预算继续收紧
- 单页高显色面积控制在 `8%-10%`

### 4. 只改颜色，不改控件语法，没有意义

如果以下控件仍然是网页语法，界面就仍然会像网页：

- 搜索框
- source list
- hover/active
- 标题栏
- 输入区
- 列表更多动作

本轮处理：

- 统一要求先改壳层语法，再改页面配色
- 已补充共享 `modal / empty / insight panel` 语法，后续页面优化优先替换容器语法，不先调色
- 已补充新的方向约束：聊天侧栏优先走 `trigger-first` 搜索语法，workspace 优先退出“大卡片外壳”，避免再用网页表单和网页卡片去承载桌面基底

### 5. serif 标题、品牌字标和高饱和身份章会持续泄露“设计稿感”和“AI 味”

这类问题在局部很小，但累加后会非常明显。

本轮处理：

- 产品界面默认字体统一回系统无衬线
- 聊天列表默认退出身份章
- serif 标题退出主要工作区

### 6. 如果把 `QClaw` 误读成 `SF Pro` 双栈，会把源码证据重新带偏

这次已经确认，`QClaw` 真源码里的全局 `body` 用的是单一系统 sans 栈，不是“正文 `SF Pro Text` + 标题 `SF Pro Display`”。

本轮处理：

- 已将本机解包源码保留到 `.reference/qclaw-unpacked-20260321/`
- 以后所有字体判断必须先核对解包出来的 CSS / JS
- 即使保留 `font-display` 这类语义 token，也不能再让它长成一套脱离源码证据的独立字栈

### 7. rail、sidebar、session list 如果不是同一套壳层，会天然像 dashboard

这类“分两块拼起来”的结构，是当前网页感的重要来源。

本轮处理：

- 统一要求 rail 与聊天列表是同一导航壳层
- 分隔依赖轻边界，不依赖多层渐变与阴影

### 7. `Agents / Skills / Cron` 的 modal、统计卡和详情侧栏如果不继续收口，还是会泄露网页设置中心语法

这三个页面已经接入统一主题表层，但仍然最容易在局部重新长出：

- 大头像 / 大徽章
- 厚 card / thick sheet
- hover-only controls
- dashboard 式统计块

本轮处理：

- `Agents`、`Skills`、`Cron` 的头部、列表和对话框已经继续向冷中性 substrate 收拢
- 后续如果继续扩散，优先改壳层语法，不先改装饰颜色

### 8. 如果继续保留“页面各自有自己的漂亮壳”，全局永远收不住

这会导致：

- chat 一套
- channels 一套
- setup 一套
- settings 又一套

最终产品像多个网站拼在一个 Electron 里。

本轮处理：

- 主题改造优先级固定为：壳层 > 共享控件 > 高频工作区 > 次级页面

### 9. 如果“冷中性 desktop substrate”不被正式写成最高准则，后续实现会再次回漂

这次已经确认，真正能去掉网页感的不是局部配色技巧，而是统一的冷中性桌面基底。  
如果这条结论只存在于讨论里，不进入文档，后续实现很容易重新走回：

- 暖色大底
- 页面各自长壳
- 品牌色重新承担背景职责

本轮处理：

- 将“全局只保留一套冷中性 desktop substrate”写入设计总纲
- 明确这条准则高于局部页面的审美冲动
- 以后任何局部主题方案，都必须先证明自己没有破坏全局 substrate

## 当前未闭环项

### 0. 目前只能说进入 `nexu` 结构对齐，不应误报成“已经完全对齐”

本轮已经补上了真正决定桌面壳层质感的几处结构：

- `sidebarWidth` 持久化
- 真实 `resize handle`
- `workspace tint`
- mac 固定 `window-drag-bar`
- `Chat` 单滚动层 + footer dock composer

但仍然没有资格说“完全对齐 nexu”，原因很具体：

- mac 左上固定 control rail 虽然已经补上，但这只解决了壳层交互语义，不代表聊天工作区内部层级已经完全追平
- 聊天正文虽然已改成 document-like assistant shell，但正文排版、工具轨和更多 pane 关系还没追到同一完成度
- 真机桌面窗口里的拖拽、缩放与层级手感还没有做完 mac / Windows 手工验收

### 1. 浅色桌面基底虽然已开始回正，但还没有完成全页统一

尤其需要继续观察：

- 聊天导航
- 频道页
- 设置页
- 欢迎态 / 首页资产

### 2. 搜索 trigger 化还没全部收完

会话列表已经开始向 trigger 靠拢，但其他页面搜索/筛选仍可能残留厚表单感。
尤其是：

- `Channels`
- `Providers`
- `Chat` 次级 picker

### 3. 部分页面虽然颜色已冷下来，但空间节奏仍偏网页

典型表现是：

- 标题过重
- 卡片感过强
- 边界过多
- 副标题过多
- 页面内部仍保留“整块工作区卡片”而不是 pane 容器

### 4. 高频页面虽然已经退出大部分暖色和 blur，但仍未完全对齐 `QClaw` 的 pane/source-list 纪律

仍需继续观察和收口的重点有：

- `Channels` 三栏 workbench 的 section 仍有局部 dashboard 感
- `Providers` 的创建/编辑流仍有较重的“设置中心网页对话框”语气
- `Chat` 输入区虽然已明显收紧，但 picker 和次级动作还可以继续桌面化
- `Settings / Models / Cron` 的次级统计和状态区仍可能比 `QClaw substrate` 更显眼

### 5. 三个高频热点虽然已经落下一轮，但次级面板仍可能回退成 web 语法

本轮已经确认收益最大的三个热点是：

- `Providers`：创建 modal、OAuth inline 面板、fallback inspector
- `Channels`：右栏 section divider、modal picker、局部 dashboard 语气
- `Chat`：picker、toolbar、次级状态 token

这三处如果后续继续复用通用 `panel / field / button` 语法，而不是 chat/pane 专属语法，就会再次把桌面 substrate 拉回网页表单感。

本轮新增事实：

- `Providers` 类型列表、provider 摘要和 fallback inspector 已继续压平，但 OAuth inline 区如果仍沿用“说明 + 大输入框 + 大切换”的网页流程，仍会重新长回设置中心语气
- `Channels` 三栏主体已明显更像 split-pane，但右栏 section 的层层包裹仍有继续收口空间，尤其是行为区和访问控制区
- `Chat` composer 已改成更轻的 dock + utility strip，但 picker、次级状态 token 和错误/连接提示仍要持续守住“wrapper-first”而不是 pill-first

### 6. `Agents / Skills / Cron` 仍有少量 modal 与详情面板可继续收口

当前已经把这三页的头部、列表和统计卡拉回桌面语法，但以下区域仍需继续观察：

- `Agents` 的添加与设置弹窗
- `Skills` 的安装 sheet 和技能详情侧栏
- `Cron` 的任务创建/编辑弹窗和任务详情卡

### 7. `ChannelConfigModal` 仍可能在高 DPI 下回到网页设置弹窗语法

本轮处理：

- 已继续压平频道配置弹窗的标题区、选择卡、说明块、验证态和底部动作区
- 已同步收紧 modal 阴影、圆角、头部和 footer 动作，让它更接近桌面 utility dialog
- 仍需要在 mac / Windows 真机下确认高 DPI 与缩放场景不会把 modal 再拉回网页对话框观感

如果这些区域继续使用过厚的 card、sheet 或 stats 语法，页面仍会明显偏网页设置中心，而不是工业级桌面 app。

### 8. 如果参考 `QClaw` 的过程中污染根入口文件，构建链会被假问题卡死

### 9. `Agents / Skills / Cron` 还需要继续压平残留的 utility 语法

本轮确认的残留主要是：

- `rounded-full` 还在按钮、筛选器和搜索触发器里反复出现
- `hover:bg-accent/60` 仍在把次级操作推回网页 hover 语法
- 搜索 trigger 依旧偏厚，和 desktop utility / source-list 语义不一致

本轮处理：

- 统一把这些触发器和次级按钮收回 `rounded-[12px] / rounded-[14px]`
- 默认 hover 改成更克制的 `surface-hover` 语义
- 用测试锁住残留，避免后续改动重新回到网页 pill 风格

这次已经出现过一次真实问题：仓库根 `index.html` 被误替换成 `QClaw` 打包后的静态资源入口，导致 `build:vite` 直接去解析不存在的 `./assets/e-Kf-uhv6n.js`。

本轮处理：

- 已恢复 `XClaw` 自己的 Vite 入口 `src/main.tsx`
- 明确以后只能把 `QClaw` 当设计/结构参考，不能把它的构建产物文件带入主仓库

### 10. `QClaw` 的桌面基底已经吸收大半，但仍需继续守“不能为模仿而模仿”

只有在 `XClaw` 本地确实有同类问题时，才继续对齐 `QClaw`。

### 11. Win/mac 真机桌面观感仍未完全手工验收

自动化和代码层可以说明“没有明显坏”，但不能替代桌面质感判断。

### 12. `Settings / Providers` 的二级语法仍是最容易回退的热点

这次已经继续压掉主壳层的网页感，但真正容易泄露成 settings center 的还是局部控件语法：

- section 标题太重
- pill 看起来像网页筛选器
- 输入框和文本域太像表单
- fallback 和 OAuth 区域太像嵌套卡片

本轮处理：

- `Settings` 的标题、section 和 subpanel 进一步压成桌面 pane 语法
- `Providers` 的 provider row、fallback list 和 OAuth inline 区进一步压成 utility 语法
- 后续如果再回漂，优先查控件层级和密度，不要只调色

### 13. `Setup / Chat` 的次级 utility 语法仍要继续守住

这批局部的共性不是颜色，而是结构和 utility 语法很容易回退：

- `Setup` 的 provider 选择器、OAuth 审批块和日志块容易重新长回“网页向导面板”
- `Chat` 的附件移除按钮、loading shell、文件 hover 和 picker token 容易重新长回“网页浮层 + accent-hover”

本轮处理：

- `Setup` 已继续退出 `2xl` 大圆角、网页 glow 和厚面板
- `Chat` 已继续退出网页式 `accent-hover`、圆形 overlay 和红色删除角标
- 后续如果这两页再出现“看起来像网页小组件”的问题，优先检查 utility 语法，而不是只调 token

### 14. `Workspace / Chat` 这轮已经收掉最高收益红线，但还不能误判成“全站严格遵循 design-v3”

这次已经明确解决的是真正最刺眼的红线：

- `WorkspacePage` 默认 `mx-auto + max-width` 的网页壳
- `Chat` 的 centered workbench / thread canvas
- `Chat` composer 的 `transition-all + rounded-[16px]` 胶囊语法
- shared primitive 的 `ring-2` 默认焦点

但这不等于全站已经闭环。当前仍然明显落后的页面是：

- `Setup`
- `Studio`
- `Agents`
- `Skills`
- `Models`
- `Cron`

这些页面还残留：

- 网页式大卡片或居中大盒子
- 分叉的 modal / inspector 语言
- 焦点与 segment 语法不统一
- 次级面板仍偏 dashboard / settings center

本轮处理：

- 先把最高频入口 `workspace + chat + high-frequency primitives` 收到桌面语法
- 把剩余页面明确记成下一批 scope，不再模糊成“后面顺手优化”

## 开发准则补充

- 以后所有“主题优化”都必须先回答：当前问题是配色问题、结构问题，还是控件语法问题
- 如果问题根因是结构或控件语法，禁止只改颜色交差
- 任何“参考 QClaw”的工作，必须先拿到本地真实证据，再决定是否吸收
- 如果 `XClaw` 当前方案更清楚、更稳，必须保留，不得为了像而退步
- 如果某个页面的问题根因是大圆角/blur/阴影/表单厚度，禁止只通过“再调颜色”来伪装修复完成
