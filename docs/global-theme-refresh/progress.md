# 全局主题重构进度

## 当前状态

- [x] 确认这是全局主题系统重构，不是单页配色调整
- [x] 确认采用“统一品牌主题 + 轻度平台适配”方向
- [x] 确认主视觉基调为“深红铜 + 石墨黑”
- [x] 确认浅色配套基调为“瓷白灰 + 深红铜”
- [x] 调研 `oneclaw / youclaw` 可吸收的主题策略
- [x] 产出快速示意页 `preview-red-copper.html`
- [x] 产出快速示意页 `preview-red-copper-light.html`
- [x] 完成第一版设计文档
- [x] 完成基于用户目标的三轮设计复盘
- [x] 输出实施计划 `implementation-plan.md`
- [x] 启动受控子代理并完成第一波并行重构
- [x] 启动第二波页面扩散，并将 `Settings / Models / Agents / Skills / Cron` 接入统一主题表层
- [x] 为第二波页面补上主题回归测试锁
- [x] 收口 `Setup` 页残留的暖色向导皮肤和蓝色 OAuth 面板，并纳入统一主题回归锁
- [x] 完成 `Setup` 结构级 review，并输出标准桌面引导页重构设计
- [x] 将 `Setup` 推进到四阶段桌面向导骨架，并完成 `start / preparation` 阶段抽离
- [x] 完成 `Setup` 结构级重构、主 CTA 契约收口、国际化补齐和自动化回归
- [x] 补充开发闭环准则：唯一工作树、四层一致性核对、禁止用 UI 修补掩盖 runtime 身份错误
- [x] 将 `custom provider / runtimeKey / model ref` 问题纳入额外闭环要求：必须同时核对 `provider store`、`~/.openclaw/openclaw.json`、`openclaw models list` 与聊天模型选择器，且测试口径必须与 UI 展示口径一致
- [x] 修复 `takeover reconciler` 会用 runtime 降维视图覆盖 custom provider richer account 的问题，启动后不再把 `998 + runtimeKey=998 + model=gpt-5.4` 回写坏
- [x] 确认浅色主题实现已偏离原设计目标，并开始将全局 `token / chrome / surface` 从暖米色网页感收回到冷中性桌面基座
- [x] 重写主题主线：从“品牌配色方案”切换为 `QClaw substrate, XClaw accent`
- [x] 将“全局只保留一套冷中性 desktop substrate”写成最高准则，明确它不是模仿外观，而是吸收 `QClaw` 已验证的桌面基底规律

## 当前落地结果

- 已有独立视觉示意页用于确认品牌方向
- 已明确不再沿用默认蓝主色
- 已明确浅色主题不再沿用暖米色网页底
- 已明确科技感来自材质、光感、层级，不来自 AI 风色彩
- 已明确 mac / Windows 只做轻度平台 overlay
- 已明确品牌色使用预算、动效红线与共享控件首批纳入范围
- 已确认 `QClaw` 解包里的浅色壳层真实落点更接近 `#fafafa / #f5f5f5 / #f0f0f0 / #e5e5e7` 这一档，并将其作为浅色桌面壳层的事实参考
- 已明确新的主题判断标准不是“更像 XClaw 品牌页”，而是“先像桌面应用，再保留 XClaw 品牌点缀”
- 已明确“冷中性 desktop substrate”是所有页面的共同基底，任何局部页面都不能再单独发明第二套壳层
- 已落地全局主题入口、桌面应用外壳与共享 primitive 的第一波改造
- 已将 `Chat / Channels` 推进到新主题表层，不再完全依赖旧暖色 hardcode
- 已将 `Chat` 从“仅欢迎态接近新主题”推进到“欢迎态 + 消息平面 + 输入坞站”统一桌面工作台层级，消息区不再直接依赖旧网页式气泡语义
- 已将 `Chat` 消息区、工具处理中、文件动作和附件错误态的剩余硬编码文案收回 `zh / en / ja` 国际化资源
- 已将 `Chat` 顶部从“重复标题 + 重复当前对象 + 分散操作”收口成“单一主标题 + 元信息胶囊 + 纯工具条”，并在会话标题里自动拆分 `id:` 尾缀
- 已继续参照 `oneclaw / youclaw` 收紧 `Chat` 空态头部：空态不再重复渲染会话头，欢迎区顶部只保留纯文字焦点与工具动作，移除了 logo 块、工作区 badge、常驻状态 pill 和顶部图标卡片
- 已将 `Chat` 基本信息继续上吸到工作区最顶层，聊天路由不再额外保留 `main` 顶部留白，头部容器边界也已弱化成轻标题区
- 已进一步将 `Chat` 会话标题和工具动作并入 `TitleBar`，聊天页内部不再保留第二条页头，顶部信息结构收敛成单层
- 已继续移除 `Chat` 顶栏里的标题与会话元信息，聊天 route 顶部现在只保留必要动作，避免首屏继续被顶部说明占据
- 已移除 `Chat` 输入区下方的整条 gateway 状态栏，并将 gateway 微状态进一步上移到顶栏工具区；输入区只在不可用时通过 placeholder 解释原因，正常态不再常驻播报连接文字
- 已为 `Chat` 顶栏里的 gateway 微状态补上柔和呼吸反馈，连接稳定后也能保留轻量生命感，但仍保持低振幅、不刺眼
- 已将 `Chat` 的欢迎态、消息工作台、错误条和输入坞站统一挂到共享 `workbench` 宽度基线上，避免上下区域继续各用一套宽度规则；输入坞站已从横向控制条重构成“上写作区、下工具行、右下发送”的单面板结构，模型选择也已收成小图标触发器
- 已继续收掉 `Chat` 输入区里“独立 footer 行”的分层感：底部工具现在是同一面板里的覆盖式工具层，左侧图标组收紧，文字输入也回到统一背景里
- 已继续统一 `Chat` 输入区左下角三个入口的控件语义，附件 / `@` / 模型现在共用同一套轻工具按钮，不再出现第三个入口比前两个更重、更像独立表单控件的错位感
- 已根据本机解包的 `QClaw.app` 输入区证据，将 `Chat` 输入坞站继续从“过高的网页式面板”收回更紧凑的桌面节奏：textarea 最小高度、发送按钮和工具轨都已压回更接近真实桌面产品的比例
- 已开始按 `QClaw` 的工作区思路继续收平 `Chat` 上半区：消息工作台去掉厚重的大卡片包裹感，助手消息回到更自然的文档流，用户气泡保留品牌语气但不再走强玻璃感
- 已继续按 `QClaw` 的“轻量发送气泡”思路收掉用户消息块的厚重感：发送方气泡改成更淡的铜红 tint，不再依赖渐变和品牌 glow 抢注意力
- 已继续按 `QClaw` 的“工作台启动区”与“次级信息轨”思路收 `Chat`：欢迎态从 landing 风三卡片降成更轻的启动列表，`thinking / tool` 和发送中状态也改成更平的次级轨道
- 已继续压低 `Chat` 欢迎动作与附件资产的存在感：欢迎动作改成更像轻列表行，文件/图片附件从“卡片资产”进一步收回到更克制的工作区附件表达
- 已修复 `Chat` 输入区工具轨回归：上一轮为压密度加入的 `overflow: hidden` 会裁掉 `@` 与模型弹层，现已恢复为可见并补回定向约束
- 已继续按 `QClaw` 的文档工作区思路收掉 `Chat` 里剩余的网页组件感：助手消息下的复制栏改成无底板的轻元信息行，代码块改成更平的文档式代码片段，图片预览与灯箱动作也从“居中大按钮 + 厚 overlay”收回到更克制的桌面预览方式
- 已继续将 `Chat` 空态动作和工具/思考状态轨从“卡片按钮”收成“文档工作区次级行”：欢迎动作去掉箭头与厚边框，thinking/tool/status 改成更轻的文本轨与细分隔，不再继续抢正文注意力
- 已继续为 `Chat` 补上真正有日常价值的人性化 affordance：模型图标 hover 现在会明确显示当前模型，模型弹层会把当前选中模型置顶；用户和助手消息下都增加了轻量复制入口；当用户上翻历史消息时，聊天区右下会出现“快速回到底部”的轻按钮，并在有新内容积压时给出弱提示点
- 已修复 `Chat` 里 typing / activity 指示器被“工具状态轨”样式误伤的问题：运行中提示现已回到独立的小气泡，不再复用左侧细分隔状态轨，因此不会再出现首屏只剩半边轮廓的视觉缺口
- 已将 `Chat` 里“LLM request timed out”这类请求级错误从全宽顶栏横幅收口成贴近输入区的轻错误气泡，只保留真实可执行的关闭动作，不再把一次请求失败夸大成页面级故障
- 已继续按 `QClaw` 的状态气泡思路压低 `Chat` 请求级错误提示的热度：去掉大警示 icon，改为微点 + 紧凑关闭，整体更像贴近输入动作的状态胶囊，而不是警报条
- 已将 `Settings / Providers / Update / Models` 收口到统一的桌面面板层级
- 已将 `Agents / Skills / Cron` 的头部、列表、弹层和主要操作区推入统一主题表层
- 已将 `Setup` 的接管、运行时检查、Provider/OAuth 和日志面板收口到统一的桌面 surface 体系
- 已将 `Setup` 的四阶段骨架、步骤轨、底部操作栏、退出守卫、主 CTA 契约和高级诊断折叠全部落地
- 已将 `Setup` 新拆层的 `zh / en / ja` 国际化补齐，避免英文环境掉回中文硬编码
- 已确认目标页面里不再残留固定暖色 hex、黑白透明边框和默认蓝按钮样式
- 已通过源码级主题回归测试锁住第二波页面，避免回退到旧暖色和网页式控件表现
- `Setup` 已完成从“大卡片设置页”到标准桌面引导页的代码级重构，独立特性文档 `docs/setup-wizard-refresh/` 也已同步收口
- 已开始重置浅色全局 `token / body / app-shell / panel / titlebar / chat-nav-shell`，移除整页暖色 glow 与强渐变，恢复更接近桌面应用的冷中性基座
- 已将全局正文与聊天区局部字体统一回系统无衬线栈，并移除 `Channels / Agents / Skills / Cron / Providers / Channel Modal` 等页面的 serif 标题覆盖
- 已把 `QClaw.app` 真包完整解到本地参考目录 `.reference/qclaw-unpacked-20260321/`，后续字体与欢迎页判断都直接对照源码而不是继续靠截图推测
- 已确认此前“`SF Pro Text / SF Pro Display` 双栈更接近 QClaw”的判断不成立，并已回收为和 `QClaw` 全局 `body` 一致的单一系统 sans 栈
- 已将聊天导航继续从“网页式列表栏”推进到更接近 `QClaw` 的 source list：本地 pane 标题退出、列表默认单行、聊天列表默认不再显示身份章、只在同名会话时以内联后缀补最小 Agent 区分
- 已将 `body / titlebar / sidebar / workspace / setup shell` 的浅色基底继续压平到单一冷中性 substrate，弱化整页渐变、blur 和浮层感
- 已修正聊天路由顶部分界语法：`TitleBar` 不再为聊天页单独绘制横向底部分割，避免标题栏与聊天导航壳层叠出网页式横切线
- 已将浅色 substrate 从偏蓝冷灰进一步拉回更接近 `QClaw` 的中性灰阶，`background / chrome / surface / border` 已开始使用更接近 `#fafafa / #f5f5f5 / #f0f0f0 / #e5e5e7` 的事实落点
- 已将聊天左侧 rail 与会话列表重新拉回同一套桌面导航壳层：rail 更窄、更平，聊天搜索更像轻筛选器，会话行更接近 source list row 而不是网页卡片
- 已将 `WorkspacePageShell` 从“页中大卡片”进一步压回贴窗体的 pane 容器：外层大圆角、整块边框和半透明背景继续退出，工作区默认回到更像 desktop pane 的中性基底
- 已将聊天列表的搜索入口从“常驻网页表单”推进到 `trigger-first` 语法：默认先呈现轻筛选 trigger，进入搜索时才展开输入态，进一步减少 sidebar 的网页表单感
- 已将 `TitleBar` 和聊天顶栏工具按钮继续压薄：标题栏高度和窗口控件宽度都下调了一档，工具按钮退出渐变底，进一步靠近桌面 utility header
- 已将欢迎区从高装饰 landing 语法继续往桌面启动工作区收，缩小 logo 壳层、压低卡片热度，并把颜色从品牌主导改回中性 substrate 上的轻 accent
- 已将 `Input / Textarea / Select / Button / Card / ConfirmDialog / WorkspacePageShell` 一并切回更平的桌面控件语法，减少共享 primitive 自带的网页表单感和厚阴影
- 已新增共享 `app-modal-overlay / app-modal-surface / app-empty-surface / app-insight-surface` substrate 语法，并开始让高频页面退出各自为战的 modal / empty / stat panel 视觉方言
- 已将 `Agents / Skills / Cron / Models / Settings / Providers / ChannelConfigModal / Setup` 的大圆角、厚 blur、暖色 panel 和高阴影压回同一套冷中性桌面面板语法
- 已将 `WorkspacePageShell` 从“浏览器里的一张大卡片”继续压回贴窗体的 desktop pane，外层圆角和阴影都进一步减弱
- 已将 `Chat` 输入坞站继续从网页式大圆角浮条收回更紧的 desktop tray，模型 picker 和搜索输入也一起退出厚 pill 语法
- 已将 `Channels` 三栏工作台继续从 dashboard 卡片语法收向 split-pane workbench：主 section、rail item、空状态和搜索框都进一步减轻网页感
- 已将 `Providers` 继续从“网页设置中心”收回桌面语法：provider 卡片改成稳定实体 surface，摘要改成两层信息，非密钥字段退出 `font-mono`，fallback 配置也退出原生 checkbox/textarea 语法
- 已继续收口 `Settings / Providers` 的二级语法：标题、section、subpanel、pill、输入框和 OAuth/fallback 区域都进一步压平，避免再次长成网页式 settings center
- 已将 `Channels` 继续从 dashboard pane 收向真正的 split-pane：页头 hero 收成轻 toolbar，三栏 section 改用统一 pane surface，选中态与 hover 降回 source-list 语义，右栏编辑区不再是卡片套卡片
- 已将 `ChatInput / ChatToolbar` 的次级控件继续退出网页表单语法：agent/model picker 改用专属 chat picker surface，模型搜索框改成 wrapper + transparent input，工具 rail 与运行态 token 也进一步桌面化
- 已将 `Agents / Skills / Cron` 的头部、列表、统计卡和部分 modal/inspector 继续推回 desktop pane / source-list 语法，减少网页设置中心和 dashboard 感
- 已将 `Agents / Skills / Cron` 的详情侧栏、安装/编辑弹窗与任务对话框继续压平到同一套冷中性 substrate，减少大头像、大徽章和 hover-only controls 的网页语法
- 已继续清理 `Agents / Skills / Cron` 残留的网页式 utility button / pill 语法，把常用触发器和次级动作收回更平的 desktop utility 形态
- 已直接对照 `.reference/qclaw-unpacked-20260321/` 修正 `index.html` 被打包产物污染的问题，恢复 `XClaw` 自己的 Vite 入口，避免构建链被错误的 `QClaw` 资源脚本卡死
- 已继续收口 `ChannelConfigModal` 的网页弹窗语法：标题区、选择卡、说明块、验证态和底部动作区统一回到更平的 desktop pane / modal surface，避免频道配置弹窗再次长成网页设置对话框
- 已继续把 `ChannelConfigModal` 的 modal 阴影、圆角、头部、频道选择区、帮助说明块、验证结果块和 footer 动作收成更像桌面 utility dialog 的语法
- 已继续清理 `Setup / Chat` 里残留的网页式 utility 语法：provider 选择器和 OAuth 审批面板退出 `2xl` 大圆角与 glow，聊天 loading shell、附件移除按钮和文件 hover 退出网页 accent/浮层语法
- 已对 `Settings / Providers / Channels / ChannelConfigModal / Chat / Setup / Agents / Skills / Cron` 这轮残留热点做了一次聚合核验，确认没有因为继续去网页感而打破主流程
- 已确认当前聊天主界面的“扁平、发虚、不高清”不是缺少装饰，而是前一轮把桌面层级压得过头；本轮开始按 `QClaw substrate, XClaw accent` 重新拉开 `sidebar / source list / workspace / composer` 四层
- 已将聊天侧栏与会话列表从“更素的网页列表”纠偏回 desktop source list：搜索 trigger 重新做成白底胶囊、会话行恢复 `40px` 级行高与更明确的 hover/active 体块、rail 和 toolbar button 恢复轻阴影与边界
- 已将聊天输入 dock 与主工作区恢复到更像桌面产品的层级：输入坞站、工具按钮、回到底部按钮和用户气泡都重新引入克制的高亮、阴影和边界，不再是一整屏同一平面
- 已继续将聊天主工作区和输入区的“高清感”补回：picker panel、search wrapper、message stage、附件卡、图片卡和过程轨 toggle 全部退出发白发虚的同平面语法，恢复更清晰的边界、体块和局部对比
- 已继续将聊天输入 dock 的精度拉回 `QClaw` 的桌面语法：发送按钮改回更稳的深色 CTA，picker item/附件卡/运行态 pill 恢复统一的白底体块和轻阴影，不再像低对比网页控件
- 已继续补聊天正文的清晰度：用户气泡、代码块、附件卡、时间/复制元信息不再发灰发虚，正文和次级信息的对比重新拉开
- 已继续补聊天正文内部的局部精度：过程轨 toggle、内联代码、代码块和次级元信息恢复更清晰的边界、灰阶和焦点反馈，避免阅读区像一层模糊文稿
- 已根据 `QClaw` 真实源码把聊天层级再次校正成“source list 更简、workspace 有轻白洗、composer 最强” 的桌面语法：搜索与会话行回到更干净的白底/浅灰 active 节奏，输入坞站收紧内部空白并重新成为主控件，避免把所有区域一起做平
- 已进一步确认“网页感”在聊天页的最大根因是双层导航而不是配色：`QClaw` 聊天页左侧本就是单层 `ChatSidebar`，`XClaw` 已开始将聊天路由从“全局 rail + 会话列表”收回单层 sidebar 结构
- 已继续纠偏聊天侧栏里“去网页感去过头”的问题：保留单层 sidebar 和 merged row 的 `XClaw` 特色，但把搜索 trigger、utility 新建按钮和 active row 的局部对比、边界与焦点语法重新拉回 `QClaw` 的桌面控件区间
- 已开始把“高清感”从聊天侧栏扩展到主工作区：聊天画布、输入 dock、picker panel、回到底部按钮和正文/元信息对比已经从“发虚的浅层”纠正为更清晰的桌面层级，避免左侧对齐后右侧仍像低对比网页

## 完成判断

- 代码改造已覆盖全局主题入口、应用外壳、共享控件、`Chat / Channels / Settings / Models / Agents / Skills / Cron / Setup`
- 自动化验证已覆盖主题、布局、`Setup` 向导和构建链，当前可以认为“代码与自动化回归已闭环”
- 本特性暂时不宣称“最终验收完成”，因为 `mac / Windows` 真机手工 smoke 还没完成，首页/欢迎态资产也仍在观察范围
- 任何后续“已完成”表述，都必须先确认工作树与运行树一致，并核对 `provider store`、`~/.openclaw/openclaw.json`、`CLI/runtime`、`UI` 四层状态一致；否则只能算未闭环

## 下一步

- 做一次 mac / Windows 手工 smoke，确认真实桌面观感
- 评估 `Chat` 欢迎态和首页资产是否需要跟随新主题继续重绘
- 继续审查剩余零散旧样式、状态/图表色预算和首页资产热度
- 继续审查尚未完全 source-list 化或 trigger 化的搜索/列表/弹层，尤其是 `Providers / Channels / Chat` 里的次级面板
- 继续观察 `Chat` 消息区在真实桌面窗口中的密度与节奏，确认是否还需要收口消息正文排版与资产热度
- 继续观察 `Chat` 空态建议卡片的文字密度，确认是否还需要进一步压缩成更接近桌面应用的文本清单
- 继续观察 `Chat` 代码块、图片预览和 hover 元信息在真实桌面窗口中的存在感，确认是否还需要进一步收平为更接近原生文档工作区的表达
- 继续收 `Providers / Channels / Chat` 里仍偏网页化的 modal / picker / inspector 次级面板
- 继续观察 `ChannelConfigModal` 在真实桌面窗口中的标题、字段和底部动作密度，确认是否还需要继续压平
- 继续做 mac / Windows 真机手工 smoke，确认代码级闭环和真实桌面观感一致

## 暂不纳入

- 双品牌主题并行
- 完整插画系统重绘
- 一次性重做所有页面
