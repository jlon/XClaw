# 全局主题重构设计 V2 - 彻底祛除网页味，走向原生桌面质感

## 背景与 V1 痛点复盘

在 V1 版本的执行中，虽然确立了“以 QClaw 为桌面基底”和“冷中性 Substrate”的设计主线，但在**代码落地时发生了严重的视觉降级**。React 组件库（大量照搬 Web 默认配置与 Tailwind 肌肉记忆）保留了深深的“网页 SaaS 味”。

如果不客气地说：**当前的 App 处于一种极其严重的“Web SaaS 狂欢”状态，几乎每一处容器都在宣示自己是一个网页。**

**V1 遗留的致命问题（必须在 V2 中彻底铲除）：**

1. **尺寸膨胀与“鹅卵石”大圆角 (Border Radius Inflation)**
   - 满屏幕的 `h-10` 高度、`rounded-[12px]`、`rounded-[16px]` 甚至是 `rounded-[30px]`（如 Studio 壳层）。这是触屏和网页营销页为了制造“亲和力”的特征，绝不是紧凑、高信息密度的工业级桌面工具特征。
2. **失控的光影特效与弥散发光 (Overuse of Web Effects)**
   - 滥用 `backdrop-blur`（高斯模糊）、巨大的发散阴影（如 `shadow-[0_18px_48px...]`）、以及通过 `box-shadow: inset` 伪造的浮雕发光感和背景的 `radial-gradient` 强行打光。这些廉价特效让界面显得“漂浮”、“发热”、“不严谨”。
3. **违反直觉的网页式容器布局 (Web Container Wrappers)**
   - 工作台（Workspace）中存在 `max-width: 1560px` 配合 `margin: 0 auto` 居中的概念。原生桌面应用的内容区应该顺应系统窗口的物理拉伸（Fluid Window Bounds）100% 撑满，而不是在屏幕中间留下两条尴尬的网页式白边。
4. **悬浮感与臃肿的侧栏 (Chunky Source List)**
   - 会话列表和侧栏选中项像贴在墙上的胶囊（使用了 `h-10` 和 `rounded-full`），没有与桌面 App 的“窗口基底（Window Chrome）”融为一体。

---

## V2 终极目标：原生工业级桌面应用

V2 的核心是不再仅仅停留于“改颜色”，而是**在尺寸（Metrics）、密度（Density）、层级（Z-Index）和控件语法（Component Syntax）上执行军事化标准的桌面级重构。**我们要刮骨疗毒，把一切前端习惯性的修饰全部砍掉，回归本质的框线、纯色与高密度排版。

---

## 强制性设计红线与 Token 实施规范（红线级规范）

为了防止上下文压缩导致开发执行走样，以下参数是硬性契约。**所有前端代码提交前，必须经过以下红线审查，违者直接打回。**

### 1. 绝对禁止 Web 级尺寸与巨型圆角
桌面应用的精髓是“克制的画框感”与高信息密度。

**具体 Token 与 Class 约束：**
- **高度 (Heights)**：
  - **默认交互控件** (`Button`, `Input`, `Select`) 必须降级为 `h-7` (28px) 或 `h-8` (32px)。
  - **大按钮/主要行动点** 最高允许 `h-9` (36px)。
  - **禁止使用**：`h-10` (40px)、`h-11` (44px) 或 `h-12` (48px)。
- **圆角 (Border Radius)**：
  - **基础圆角** (`globals.css` 中的 `--radius`) 必须设置为 `0.375rem` (6px) 或 `0.5rem` (8px)。
  - **标准控件** (Input, Button) 统一使用 `rounded` (4px) 或 `rounded-md` (6px)。
  - **面板/卡片/气泡** 最大使用 `rounded-lg` (8px) 或 `rounded-xl` (12px，仅限极少大面板)。
  - **杀无赦**：绝对禁止在非全屏面罩或特殊头像外使用 `rounded-2xl`、`rounded-[11px]`、`rounded-[14px]`、`rounded-[16px]`、`rounded-[24px]`、`rounded-[30px]`、`rounded-full`（除用户/Agent头像和明确的圆形按钮外）。

### 2. 绝对禁止伪拟态、模糊与发散发光
桌面层级依赖精确的 1px 边框和极短促的物理投影，不需要网页里的花哨打光。

**具体 Token 与 Class 约束：**
- **背景模糊**：全局禁止使用 `backdrop-blur` / `backdrop-blur-sm` / `backdrop-blur-xl` 等滤镜属性。弹窗必须使用实色（如 `bg-[hsl(var(--surface-elevated))]`）。
- **背景光晕**：全局禁止使用 `bg-[radial-gradient(...)]` 来为组件或页面制造人造环境光。
- **内阴影与浮雕高光**：全局禁止使用 `shadow-[inset_0_1px_...]` 或者 `shadow-[inset_...]` 制造组件高光。
- **外阴影重写 (`globals.css`)**：
  - 必须抛弃大范围漫反射。
  - `--shadow-sm`: `0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)` （适用于极小浮层/按钮悬浮）
  - `--shadow-md`: `0 2px 8px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.1)` （适用于 Tooltip、Dropdown）
  - `--shadow-lg`: `0 8px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.1)` （适用于大型 Dialog，如 ConfirmDialog）
  - 深色模式下（`.dark`），阴影透明度应适当增加（如 0.2 或 0.3），而不是增加模糊半径。

### 3. 打碎“网页定宽盒子” (Fluid Window Bounds)
- **取消定宽居中**：所有 Workspace 和主工作区页面，禁止出现 `max-w-[1560px]` 配合 `mx-auto` 的布局。
- 内容区域必须 100% 顺应窗口的物理缩放，无论多宽的屏幕都应贴边重新分布或对齐边缘，只通过合理的 `padding`（如 `px-4`, `px-6`）呼吸，绝不作为“页面居中在屏幕里”。

### 4. 彻底扁平化的 Source List (Sidebar & SessionsPane)
导航栏必须像 macOS Finder 或 VSCode，安静、平实。
- **高度与圆角**：列表项（Row）高度压缩到 `h-7` 或 `h-8`，圆角改为 `rounded-md`。
- **Hover 与 Active 态**：只依靠底色改变。
  - 激活态（Active）：纯色底块（如 `bg-[hsl(var(--surface-active))]`），**无边框，无投影**，字体权重可微升 (`font-medium`)。
  - 悬浮态（Hover）：更浅的纯色底块（如 `bg-[hsl(var(--surface-hover))]`）。
- **取消间距堆叠**：列表项之间的间距（gap）要极小（`gap-0.5` 或 `gap-1`），内边距（padding）压缩至 `px-2 py-1`，去掉多余的边框（移除 border 属性）。
- **安静的搜索框**：搜索框压缩到 `h-7`，变成一个边角微圆（`rounded-md`）、融入底色的系统级搜索控件，而不是高度 `h-10` 的巨大网页表单。

### 5. 沉浸式 Composer（输入面板）与 Chat 消息流
- **输入区去外壳化**：剥除 `ChatInput` 外部巨大的独立外壳圆角（`rounded-[16px]`）和厚重的 padding（如 `px-4 py-2.5` 改为 `px-3 py-2`）。让输入区直接下沉到底部基底中，或通过 1px 线（`border-t border-border`）做极简硬分割。
- **克制的工具按钮**：输入区内的附件、@ 等操作按钮尺寸压缩至 `h-6 w-6` 或 `h-7 w-7`，采用无边框的扁平图标，融入背景。
- **克制的气泡**：剥离 `ChatMessage` 的巨大圆角。用户气泡降级为 `rounded-md` 或只保留背景色而去掉厚重 border；助手气泡纯文本排列。

### 6. Windows 与 macOS 的原生化兼容 (Cross-Platform Native Feel)
桌面级质感并非“一招吃遍天下”，macOS 和 Windows 具有截然不同的原生心智模型，红线规范必须兼顾这两大平台的差异，不能用同一套“类 Mac”风格强加给 Windows 用户。

- **滚动条 (Scrollbars)**：
  - **macOS**：必须使用隐藏式、悬浮态才显示、无轨道的纤细滚动条（`::-webkit-scrollbar` 宽度不超过 6px，或直接使用原生隐藏逻辑）。
  - **Windows**：严禁使用 macOS 的隐形滚动条，必须保留带有明确轨道（track）和块状滑块（thumb）的系统级滚动条（宽度 10px - 14px），或者使用符合 Windows 11 Fluent Design 风格的定制滚动条，确保在无触控板环境下鼠标易于抓取。
- **窗口控制与顶部栏 (TitleBar & Traffic Lights)**：
  - **macOS**：左侧预留红绿灯空间，标题栏与工作区允许轻微融合。
  - **Windows**：必须保留右侧标准的最小化/最大化/关闭按钮区（且 Hover 态必须符合系统原生的红底/灰底响应），标题栏不能和下方内容混淆，需要有清晰的拖拽区和边缘界限。
- **边界与对比度 (Borders & Contrast)**：
  - **macOS**：可以通过极轻的阴影和微弱的背景色差来分层。
  - **Windows**：对阴影的感知较弱，必须通过明确的 `1px` 边框（Borders）来区分不同的内容面板。Windows 下的边框颜色应该比 macOS 稍微深（高对比度）一个层级。

### 7. 桌面级质感不等于“简陋与素雅” (Refined Texture, Not Boring)
去除网页味绝不意味着我们要把 App 做成一个无聊的灰色记事本。顶级的桌面应用（如 Linear、Raycast、Arc 浏览器）之所以高级，是因为它们在极简的结构上附加了极致的物理质感。

- **精密的材质与分层**：不使用花哨的渐变，而是通过极为考究的色阶（`surface-base` 到 `surface-elevated` 再到 `surface-panel`）来建立空间的立体感。
- **锐利的交互焦点 (Focus Ring)**：将 XClaw 的品牌铜红色作为极其锐利、果断的 Focus Ring 和 Active Indicator，让每一次键盘导航和点击都有极高的响应感。
- **微小的物理投影**：使用多层、极小半径的物理投影（例如按钮在 Hover 时的 1px 抬升感，依靠修改 box-shadow 或 translate-y-[0.5px] 实现），而不是大面积背景阴影。
- **排版与间距的张力**：利用系统级无衬线字体的 `font-medium`、`font-semibold` 与次级文字的透明度（如 `text-foreground/60` 或 `text-muted-foreground`）形成强烈的排版对比。不用复杂的颜色，仅靠字重、透明度和精确的 4px/8px 间距节奏就能拉满高级感。

### 8. 字体系统与排版 (Typography)
字体系统必须与系统原生 UI 无缝对接，网页中常见的花哨字体栈（如过大的行高、强加的字距）必须废弃。

- **系统无衬线字栈 (System Sans-Serif)**：
  - 必须使用绝对的系统字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`。
  - 严禁在非特定品牌展示区使用 Serif（衬线体）或特殊设计字体。
- **行高与字号 (Line-height & Size)**：
  - 桌面端阅读距离较近，不需要网页那种 `leading-loose` (1.5 - 1.8) 的松散行高。
  - UI 控件字号：主界面控件统一下降至 `text-[13px]` 或 `text-sm` (14px)。
  - UI 控件行高：使用 `leading-tight` (1.25) 或 `leading-snug` (1.375)。只有在长文本（如聊天气泡内容）才允许使用 `leading-relaxed` (1.5)。
- **字重与对比 (Weight & Contrast)**：
  - 加强字重的语义：标题或当前激活项使用 `font-medium` 或 `font-semibold`。
  - 正文和辅助信息保持 `font-normal`。
  - **重要**：Windows 系统的字体渲染对 `font-light` 支持极差，全局严禁使用低于 400 的字重。

### 9. 交互动画与过渡 (Motion & Animation)
桌面软件的动画应该是“物理的、瞬时的、无感的”，绝不能像网页那样拖泥带水，也不能有夸张的弹性（Bouncy）效果。

- **极速响应 (Snappy Transitions)**：
  - 所有的 Hover、Active 状态切换，过渡时间必须极短。
  - 标准过渡时间设定为 `duration-75` (75ms) 到 `duration-100` (100ms) 之间。全局变量 `--motion-fast` 设为 `75ms`。
  - 绝对禁止在按钮 hover 上使用 `duration-300` 等慢速渐变。
- **避免不必要的缓动曲线**：
  - 不需要花哨的 `ease-in-out-back`。使用 Tailwind 默认的 `ease-out`（物理减速）即可。
  - 对于极其基础的按钮变色，甚至可以直接取消 transition，做到 0ms 的纯原生响应速度。
- **组件出场动画 (Enter/Exit Animations)**：
  - 侧边栏折叠/展开允许使用稍长的动画（如 `duration-200`），但必须使用阻尼感极强的曲线（如 `cubic-bezier(0.2, 0.9, 0.4, 1)`），严禁像果冻一样回弹。
  - 弹窗（Dialog）、下拉菜单（Dropdown）、Select 出场时，严禁网页中常见的从屏幕底部或两侧“飞入（slide-in-from-xxx）”的夸张位移动画。
  - **红线规定**：组件出场只能有极其微小的缩放（`scale-95` 到 `scale-100`，甚至是 `scale-98`）和极速的透明度（`opacity`）渐变，或者直接 `0ms` 出现。

### 10. 弹窗与弹出菜单的严谨性 (Popovers & Modals)
在桌面端，弹窗（Modal）和弹出菜单（Select/Dropdown/Context Menu）是非常严肃的系统级中断，绝不能做得像网页侧边抽屉。

- **剥离巨型圆角与浮层光晕**：
  - Select 和 Dropdown Menu 绝对禁止使用 `rounded-[16px]`。必须统一降级为 `rounded-md` (6px) 或 `rounded-lg` (8px)。
  - 必须剥离 `shadow-[0_12px_28px_...]` 这种过度发散的阴影，换成克制的物理阴影 `--shadow-md`。
- **屏蔽多余的背景遮罩层动画**：
  - ConfirmDialog 这种全屏遮罩弹窗，背景面罩出现应当直接果断，不需要花哨的渐现。内容框居中，禁止从下往上飞的“抽屉感”。
- **下拉菜单紧凑化**：
  - `DropdownMenu` 的 Item `padding` 必须极致压缩（例如 `px-2 py-1`），废除为了触屏设计的宽大点击区（`py-2` 以上）。

### 11. CSS 过渡与动画的性能和逻辑规范 (Transitions & Performance)
桌面级的动画必须绝对避免影响渲染性能的滥用。

- **禁止过渡泛滥 (`transition-all`)**：
  - 严禁使用 `transition-all`。所有的过渡必须明确指定属性（如 `transition-[background-color,color,border-color,opacity]`）。
  - 原因：`transition-all` 在桌面端极易引发重绘（Repaint）和重排（Reflow），导致悬浮操作时掉帧（特别是包含 `box-shadow` 时）。
- **动效的克制**：
  - hover 状态的卡片抬升效果，使用 `translate-y-[-1px]` 代替修改 `margin` 或增加长阴影。
  - **废除悬停时的阴影变化**：尽量通过边框颜色加深（例如从 `border-transparent` 到 `border-border/50`）或底色加深来反馈悬浮态，而不是增加 `box-shadow`。频繁修改 `box-shadow` 是网页性能杀手。

### 12. 统一的数据密度与栅格 (Grids & Padding)
- **卡片内边距压缩**：所有被认定为“Card”或“Pane”的容器，内边距必须从原先为了触控设计的 `p-6` 或 `p-4`，大幅压缩为 `p-3` 或 `p-4`。
- **对话框紧凑化**：`DialogContent` 的最大宽度设定必须克制，内容区 padding 使用 `p-4` 或 `p-5`，不再使用空旷的网页式 `p-6`。

### 13. Focus Ring（键盘焦点）规范
在网页端常常用极其粗的 `ring` 来表示 Focus。在桌面端：
- 废弃 Tailwind 默认的泛白发光 `ring`（例如 `focus:ring-2 focus:ring-ring/30 focus:ring-offset-2`）。
- 焦点状态必须像 macOS 一样：是一条果断的、不模糊的 2px 或 1px 亮色实线边框，使用品牌主色（如 `XClaw 铜红色`）。
- 改写焦点类名为：`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0`，甚至直接在 input 上用 `focus-visible:border-primary` 取代 ring。

### 14. 语义颜色的克制使用 (Muted/Foreground)
网页前端喜欢在按钮或者卡片文字上直接用纯黑色（`text-foreground`）。
- 桌面端的次级文字（如提示、副标题、非焦点组件的图标）必须严格使用 `text-muted-foreground` 或透明度层级（如 `text-foreground/60`）。
- 任何禁用状态（Disabled）必须统一设定为 `opacity-50 pointer-events-none`，而不仅仅是换成灰色。

### 15. Z-Index 与模态框架构规范 (Z-Index & Modal Architecture)
网页为了防止重叠，极其喜欢动辄使用 `z-50` 乃至 `z-99`。桌面级的视图通常是基于窗口物理层级的平级关系。
- **降级 Z-Index**：严禁在非全局遮罩层使用 `z-50`。一般面板的堆叠只用到 `z-10` 到 `z-30`。
- **遮罩层 (Overlay) 规范**：Dialog / Sheet 的背景遮罩应当是一层极其简单的蒙版（如 `bg-[hsl(var(--background)/0.6)]` 或 `bg-black/20`），严禁使用带有径向渐变或高模糊（blur）的厚重黑色。
- **Focus Trap / 焦点管理**：弹窗必须使用原生或受控的 Focus Trap，避免像网页一样弹出后还能滚动背景或焦点漂移。这是防止失去 Windows 焦点的关键。

### 16. 可交互元素的“指针”规范 (Cursors)
- 桌面端与网页端最大的体验差异在于鼠标指针：网页里所有的可点击元素（包括按钮、Tab）通常都会变成“小手” (`cursor: pointer`)。
- **原生桌面规范**：在 macOS 和 Windows 的原生应用中，普通的按钮（Button）、输入框、甚至部分列表项 Hover 时，**鼠标指针永远是默认的“箭头”** (`cursor: default`)。只有真正的超链接（Link）才会变成小手。
- **强制红线**：全局取消 `Button`、`Tab`、普通交互卡片的 `cursor-pointer`。所有普通的 UI 控件保持箭头指针。

### 17. 文本选择的严格管控 (User-Select)
这通常是前端最容易忽视、却最能瞬间戳破“桌面级质感”幻想的细节。在网页中，默认所有内容都可以被鼠标拖拽选中（变蓝）。
- **全局壳层不可选**：App 的基底壳层（Sidebar、TitleBar、ToolBar、所有 Button、所有的卡片标题和系统状态）必须统一定义为 `select-none` (`user-select: none`)。
- **白名单可选**：只有真正需要被复制的内容区域（Chat 的气泡正文、Terminal 输出、Input 输入框、代码块）才允许 `select-text` (`user-select: text`)。
- **判断标准**：用鼠标在侧边栏或顶部栏随意点击并拖动，如果能拉出蓝色的文本高亮，即视为严重 Bug。

### 18. 图标尺寸的克制 (Iconography Sizing)
网页经常使用宽大的图标（如 24px `w-6 h-6` 或 20px `w-5 h-5`），加上 2px 的粗线条。
- **桌面级标准**：在界面导航、按钮和表单内，系统级图标应该使用 14px (`w-3.5 h-3.5`) 或 16px (`w-4 h-4`)。
- **严禁大图标**：除非是特殊的空状态插图、头像或独立展示，否则普通的 UI 图标绝对禁止使用 `w-5` 或 `w-6`。

### 19. 禁止重写系统原生滚动容器逻辑
不要因为前端组件库（如 Radix）的惯性，去劫持或破坏原生滚动容器的表现。
- 严禁在页面滚动容器中使用 `overflow-hidden` 配合自定义的模拟滚动条。
- 若使用了弹出层锁定了 Body 滚动，弹出层消失后必须确保不会引发页面抖动的 Bug（Padding-right shift）。

### 20. 分隔线 (Divider) 极简化
- 页面区块之间的分割，必须使用 1px 的冷峻细线，如 `border-t border-border`，或者是 `border-border/50`。
- 绝对禁止使用带有内阴影 `shadow-inner` 或者透明度渐变的厚重分隔块（有些 Web 项目喜欢用 height 8px 加上底色来区分卡片，这在桌面端是禁忌）。

---

## 品牌点缀重申 (Accent Layer)

**品牌色（XClaw 铜红色）的使用预算进一步削减。**
- **绝对禁止**：在侧栏底色、卡片底色、常规列表 hover/active 底色中使用品牌色。
- **唯一合法出现场景**：
  1. 主要的 Call To Action (CTA) 按钮（且尺寸要小）。
  2. 极其微小的状态指示圆点。
  3. Logo 及少量的强调文字。
  4. 键盘 Focus Ring（焦点环）。

---

## 验收标准
1. **尺寸测量**：截图放入设计软件测量，主按钮、输入框、列表项高度均在 28px~32px 之间。
2. **圆角检查**：全局排查代码，标准控件圆角最大不超过 `6px`，容器最大不超过 `8px`（除头像），彻底消灭“鹅卵石”风格。
3. **特效排查**：全局搜索代码，不存在 `backdrop-blur`，不存在 `radial-gradient` 背景光，不存在 `inset shadow` 高光。
4. **布局检查**：拉伸应用窗口至全屏或带鱼屏，工作区内容必须 100% 弹性充满，不能出现居中的定宽盒子。
5. **肉眼体感**：将 App 窗口拖到 macOS 的 Finder 或 Windows 的资源管理器旁，视觉密度、线条锐度、阴影克制程度必须能完全“融入”系统，不再有“内嵌网页”的违和感。