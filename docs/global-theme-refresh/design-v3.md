# 全局主题重构设计 V3 - 基于 Nexu 证据的桌面质感修正版

## 文档状态与适用口径

本文件从现在开始是 `global-theme-refresh` 的**唯一现行设计规范**。

- `design-v2.md` 保留，但角色降级为**历史归档与错误思路对照样本**。
- 后续所有实现、评审、验收都以本文件为准，不再允许同时引用 V2 与 V3。
- 若后续出现与本文件冲突的新想法，必须先更新本文件，再进入实现。

### 关于“全面对齐 Nexu”的正式定义

本项目对“全面对齐 Nexu”的定义不是机械抄样式，也不是无视平台差异做像素级复制，而是：

1. **macOS**：在窗口壳层、标题栏、侧栏材质、主工作区边界、列表密度、浮层语言、输入焦点、滚动条气质上，尽可能全面对齐 `nexu` 的桌面语法。
2. **Windows**：在结构、层级、密度、边界、标题栏交互、滚动条和浮层规则上尽量靠近 `nexu`，但不强行复制 macOS 独占的系统材质。
3. **品牌保留**：允许保留 XClaw 的品牌识别，但品牌只能作为焦点、CTA、Logo 和少量强调层，不得破坏 `nexu` 式的桌面秩序。

### 关于“有源码所以必须做到”的约束说明

`nexu` 源码的价值在于：它让我们可以基于真实证据复刻其**窗口壳层逻辑、组件语法和平台分层方法**。

但源码存在不代表可以无脑拷贝。真正需要复刻的是：

- 壳层优先的架构顺序
- macOS 与 Windows 的分层策略
- 主侧栏、列表、浮层、输入、滚动条的桌面语言

不应该复刻的是：

- 未经 XClaw 架构验证的局部实现细节
- `nexu` 中本身偏 macOS、偏产品专区的特殊页面语法
- 与 XClaw 路由、信息架构、品牌职责冲突的展示层噪音

---

## 为什么必须推翻 V2 的部分判断

`design-v2.md` 的方向有一半是对的：它正确识别了 XClaw 当前存在尺寸膨胀、选中态过度悬浮、图标过大和彩色化、局部组件过度网页化的问题。

但 V2 也犯了一个根本性错误：它把“桌面感”错误理解成了“极限去特效、极限去颜色、极限去一切材质”。这不符合真实桌面产品的实现证据。

对 `/mnt/data/nexu` 的真实代码拆解表明，它的桌面感并不是靠“全面禁用 blur / gradient / inset”得到的，而是靠以下组合成立：

1. **壳层优先**：先处理 `BrowserWindow`、标题栏、拖拽区、红绿灯/窗口控制按钮，再处理组件。
2. **材料集中在大层级**：玻璃感、轻微渐变、壳层 tint 只出现在窗口壳与侧栏基底，不下放到每个列表项。
3. **列表保持紧凑和平实**：导航行高度、字重、间距、图标尺寸都明显收敛。
4. **平台差异真实存在**：Nexu 明显偏 macOS，Windows 只是降级策略，不是完全同构。

因此，V3 不再采用 V2 那种“绝对禁止一切”的教条，而是改为：**分层定义什么地方可以有材质，什么地方必须绝对克制。**

---

## 证据基线

本版结论只基于真实文件，不基于想象：

### Nexu 证据

- ` /mnt/data/nexu/apps/web/src/index.css `
- ` /mnt/data/nexu/apps/web/src/layouts/workspace-layout.tsx `
- ` /mnt/data/nexu/apps/desktop/main/index.ts `
- ` /mnt/data/nexu/apps/desktop/src/runtime-page.css `

### XClaw 当前实现证据

- ` /mnt/data/XClaw/src/components/layout/Sidebar.tsx `
- ` /mnt/data/XClaw/src/styles/globals.css `
- ` /mnt/data/XClaw/src/components/layout/TitleBar.tsx `

---

## V2 逐条修正对照

| V2 条款 | Nexu 的真实证据 | 结论 | V3 修正 |
|---|---|---|---|
| 1. 绝对压缩尺寸与圆角 | Nexu 主导航接近 `13px + px-3 py-2 + 6px radius`，但主内容壳用了 `12px` 圆角，桌面壳里的某些页面甚至到 `18px` | V2 过于绝对 | 保留“列表与控件紧凑化”，但容器圆角分层处理：列表项 `6px`，面板 `8px`，主工作区壳体允许 `10px~12px` |
| 2. 绝对禁止 blur / inset / gradient | Nexu 在 macOS 上明确使用 `vibrancy: "sidebar"`、`backdrop-filter`、壳层浅渐变；但没有把这些效果下放到每个 nav item | V2 判断失真 | 禁止组件级玻璃、禁止光晕、禁止重阴影；允许壳层级材质，且仅限标题栏/侧栏基底/模态大容器 |
| 3. 禁止网页定宽盒子 | Nexu 主工作区是顺应窗口拉伸的流体布局 | V2 正确 | 保留，继续作为红线 |
| 4. Source List 只能纯底色、无边框、无投影 | Nexu 的主工作区导航基本如此；但其某些桌面 runtime 页并不遵守这一点 | V2 方向对，但适用范围写错了 | 该规则只约束 XClaw 的主侧栏、会话列表、资源列表，不强行套给所有产品专区页面 |
| 5. 输入区去外壳化 | Nexu 的桌面感也依赖“输入区归属到工作区基底”而不是独立大胶囊 | V2 基本正确 | 保留 |
| 6. Windows 必须用 10px~14px 可抓取滚动条 | Nexu 并没有这么宽的 Windows 样式，而是采用更细但可见的方案 | V2 过度教条 | macOS `2px~4px`；Windows `4px~6px`，默认低对比、hover/active 增强，避免网页式超粗滚动条 |
| 7. 桌面质感不等于简陋 | Nexu 通过色阶、壳层 tint、极弱渐变建立质感 | V2 正确 | 保留 |
| 8. 必须纯系统字体栈 | Nexu 并非完全系统字体，而是品牌字体 + 系统 fallback | V2 过于绝对 | 标题与品牌区可有自定义字体，侧栏、标题栏、表单、菜单优先系统字体体验 |
| 9. 动效必须瞬时 | Nexu 过渡也偏短促，侧栏宽度变化、悬停反馈都很克制 | V2 正确 | 保留 |
| 10. 弹窗与菜单必须紧凑 | Nexu 的主导航和列表密度支持这一结论 | V2 正确 | 保留 |
| 11. 禁止 `transition-all` | 这是合理的性能红线 | V2 正确 | 保留 |
| 12. 压缩栅格与 padding | Nexu 的导航和 provider 列表都明显更紧凑 | V2 正确 | 保留 |
| 13. Focus ring 必须 1px/2px 果断 | Nexu 并不靠大面积发光 ring | V2 方向正确 | 保留，但允许 `border-color + 轻 ring` 组合，不强制只剩一种语法 |
| 14. 次级文字必须收敛 | Nexu 导航文字与分区标题都做了层级压缩 | V2 正确 | 保留 |
| 15. Z-index 降级 | 符合桌面壳层思路 | V2 正确 | 保留 |
| 16. 普通按钮都不该是小手 | 这是接近原生桌面的方向，但前端生态并不总一致 | V2 可保留但优先级不高 | 仅要求主侧栏、工具栏、标签切换默认箭头，超链接继续小手 |
| 17. 壳层不可选中文本 | 这是真桌面感细节 | V2 正确 | 保留 |
| 18. 图标必须 14px~16px | Nexu 主导航是 `16px`，provider 列表是 `14px` | V2 基本正确 | 保留，主侧栏以 `16px` 为上限，禁止 `18px~20px` 常态化 |
| 19. 不要劫持原生滚动容器 | 合理 | V2 正确 | 保留 |
| 20. 分隔线极简化 | 合理 | V2 正确 | 保留 |

---

## 从 Nexu 学到的真正方法

### 1. 桌面感首先是壳层工程，不是按钮工程

Nexu 最关键的证据不是某个按钮有多“克制”，而是：

- `BrowserWindow` 对 macOS 做了 `transparent + vibrancy + hiddenInset`
- 渲染层做了 `drag-region` / `no-drag`
- 标题栏预留了红绿灯空间
- 侧栏宽度可被拖拽并记忆

这说明桌面感的第一来源是**窗口系统关系**，不是组件库换个颜色。

XClaw 当前的 `TitleBar.tsx` 已经具备这条路线上最正确的基础，因为它已经区分了 macOS 与 Windows/Linux 的标题栏行为。这部分不应该被推翻，反而应该在 V3 被提升为主题设计的一级约束。

### 2. 材质必须集中在“壳”，不能洒到每个行项目

Nexu 的 blur、浅渐变、壳层 tint 主要作用于：

- 侧栏大基底
- 标题栏
- 大内容容器
- 少数更新卡片或系统级浮层

它没有让每个导航项都拥有自己的边框、投影、发光、高光。真正有桌面感的做法，是**让整个窗口像一个物理对象**，而不是让每个列表项都像一张漂浮贴纸。

XClaw 当前最大的问题恰好相反：`Sidebar.tsx` 的 active item 仍然使用了 `border-border/65` 与 `shadow-[inset_0_1px_0...]`，图标还有独立彩色底片，这会把侧栏拆成一堆小网页组件。

### 3. 真实桌面感的关键是密度，而不是“极简灰”

Nexu 的导航行之所以稳定，不是因为它没有颜色，而是因为它：

- 字号基本压在 `13px`
- 图标多为 `14px~16px`
- 行高接近 `30px~32px`
- gap 很小
- active 提升字重而不是提升立体感

这比“把所有色彩都删光”重要得多。

### 4. 平台差异必须被文档化，不要幻想一套 CSS 吃三端

Nexu 的真实策略是：

- **macOS**：吃系统 vibrancy，允许壳层半透明与玻璃感
- **Windows / Linux**：退回实色壳层和更明确边界

所以 V3 的平台策略必须承认：

1. macOS 可以更软、更融合。
2. Windows 必须边界更清楚、分割线更明确、标题栏按钮区绝不能漂。
3. Linux 默认跟随 Windows 的保守策略，不追求毛玻璃。

---

## V3 设计目标

XClaw V3 的目标不是“像网页那样高级”，也不是“像记事本那样无聊”，而是：

**让 XClaw 的窗口壳层、主侧栏、会话区和工作区在 macOS 与 Windows 上都形成可信的桌面工具质感，同时保留 XClaw 自己的品牌识别。**

具体来说：

1. **主侧栏要像应用壳的一部分**，而不是像一组会发光的导航卡片。
2. **工作区要像顺着窗口物理边界展开**，而不是网页中央白盒。
3. **品牌色只做焦点与关键动作**，不去染主导航底色。
4. **视觉材料有预算**，只用在壳层，不泛滥到所有组件。

---

## 当前实现能力反思

在进入实现之前，必须明确承认一个事实：

**XClaw 当前代码基础还不能直接“通过改几个 class”实现对 Nexu 的全面对齐。**

现有基础具备的能力：

- 已经有 `TitleBar.tsx` 的平台分支基础。
- 已经有 `electron/main/index.ts` 的窗口创建控制点。
- 已经有 `globals.css` 的 `surface-*`、`chrome-*`、`shadow-*` token。

现有基础的核心缺口：

1. **窗口级材料能力不足**：当前只有 `hiddenInset` 与 traffic light 定位，还没有进入 `nexu` 那种 macOS `transparent + vibrancy + 壳层透明策略` 的层级。
2. **主侧栏语法仍偏网页**：active 仍依赖边框、`inset` 高光、多色图标底片。
3. **组件语言分散**：输入、下拉、浮层、聊天区尚未统一到同一桌面语法。

因此，V3 明确反对以下错误路径：

- 只改渲染层 CSS，不改主进程窗口策略。
- 只改 `Sidebar.tsx`，不重做标题栏与工作区边界关系。
- 先铺开全站修样式，最后才回头修壳层。

---

## V3 的 20 项落地细则

以下 20 项不是抽象口号，而是为防止后续 Session 合并、上下文压缩、实现人员切换而写死的执行清单。每一项都按同一结构展开：

- `目标`：这一条到底要解决什么问题。
- `Nexu 证据`：真实参考来源，不允许靠想象。
- `XClaw 必须怎么做`：后续实现时的硬性落地方式。
- `禁止事项`：避免再次滑回网页味。

### 1. 窗口壳层必须优先于组件层设计

- `目标`：先把 App 做成可信的桌面窗口，再谈按钮与卡片细节。
- `Nexu 证据`：
  - `apps/desktop/main/index.ts` 使用 `titleBarStyle: "hiddenInset"`，且对于 `darwin` 设置 `transparent: true`, `vibrancy: "sidebar"`, `visualEffectState: "followWindow"`, `backgroundColor: "#00000000"`。非 `darwin` 时退回 `#0B1020`。
  - macOS 使用 `transparent + vibrancy: "sidebar" + visualEffectState`。
  - `workspace-layout.tsx` 与 `runtime-page.css` 明确为 traffic lights 预留空间。
- `XClaw 必须怎么做`：
  - 所有主题重构先从 `TitleBar`、`Sidebar`、`Workspace` 三个一级壳层开始。
  - macOS 主进程中需增加类似 `vibrancy: 'sidebar'`, `transparent: true` 和 `visualEffectState: 'followWindow'` 的配置；同时配置 `trafficLightPosition: { x: 18, y: 18 }` 规范红绿灯位置。
  - 渲染层必须强制透明以透出系统材质：`html, body, #root { background: transparent !important; }`，否则网页背景会遮挡 vibrancy。
  - macOS 侧栏顶部必须预留 `h-14` (约 56px) 的控制区避让空间；全局顶部拖拽区应从 `left: 100px` 开始，避免劫持红绿灯和侧栏折叠按钮的点击事件。
  - macOS、Windows、Linux 的顶部安全区必须有明确常量或平台分支。
  - 不允许只因为“在 Electron 里”就统一套同一套顶部 inset。
- `禁止事项`：
  - 先改按钮样式，最后才发现标题栏与侧栏边界不成立。
  - 继续把平台差异简化成“是否 Electron”。

### 2. 材质只能集中在大层级，不能下放到列表项

- `目标`：把“质感”收回到窗口壳，而不是让每个交互元素都像单独的网页卡片。
- `Nexu 证据`：
  - 壳层使用 `desktopGlassTint`、`.sidebar-vibrancy`（`backdrop-filter: saturate(180%) blur(20px)`）、主区 `rounded-l-[12px]`。
  - 主导航行本身只做轻底色变化，不承担玻璃材质。
- `XClaw 必须怎么做`：
  - 标题栏、主侧栏基底、主工作区容器可以使用极弱渐变或弱材质。macOS 侧栏玻璃态应引入类似于 `backdrop-filter: saturate(180%) blur(20px)` 的参数。
  - 列表项、按钮、Tab、普通卡片只允许实色层级，不允许玻璃化。
- `禁止事项`：
  - 给侧栏激活项加半透明白膜、内高光、局部发光。
  - 把毛玻璃做成组件通用语法。

### 3. 主工作区必须顺应窗口物理拉伸

- `目标`：彻底消灭网页式“中间白盒”。
- `Nexu 证据`：
  - 主内容区随着窗口拉伸，未采用网页式定宽居中壳。
- `XClaw 必须怎么做`：
  - Workspace 页面禁止 `max-width + mx-auto`。
  - 内容仅通过 `px-3`、`px-4`、`px-5` 等边距呼吸。
  - 宽屏下优先重排，不允许中央出现两侧大空白。
- `禁止事项`：
  - 把桌面工作区继续当 SaaS 页面做。

### 4. 主侧栏 Source List 统一成 30px~32px 的桌面密度

- `目标`：让主侧栏像 Finder / VSCode / Nexu 主导航，而不是网页导航卡。
- `Nexu 证据`：
  - 主导航接近 `13px + px-3 py-2 + 6px radius`。
  - 选中态主要靠底色与字重，而不是立体效果。
- `XClaw 必须怎么做`：
  - 主侧栏与会话列表单行目标高度固定在 `30px ~ 32px`。
  - 水平 padding `10px ~ 12px`。
  - 圆角统一 `6px`。
  - 字号 `13px`，默认字重 `400/500`，激活项 `500/600`。
- `禁止事项`：
  - `h-10`、`h-11` 导航行。
  - 大胶囊式导航按钮。

### 5. 主侧栏 hover 和 active 只允许平面反馈

- `目标`：让导航保持安静、可信、系统化。
- `Nexu 证据`：
  - hover 为浅底色，active 为略深底色 + `font-weight: 600`。
  - 主导航没有把 active 做成发光按钮。
- `XClaw 必须怎么做`：
  - hover：只改变底色与文字颜色。
  - active：只允许底色更深、文字更实、必要时加极细 indicator。
  - 主侧栏 active 不再依赖描边、阴影、浮雕。
- `禁止事项`：
  - 额外边框。
  - inset 高光。
  - 强阴影。
  - 让 active 看起来像独立按钮。

### 6. 图标系统必须收敛，取消彩色底片

- `目标`：消除当前最明显的网页感来源之一。
- `Nexu 证据`：
  - 主导航图标主要是 `16px`，provider 列表是 `14px`。
  - 没有当前 XClaw 这种彩色小底片常态铺满一级导航。
- `XClaw 必须怎么做`：
  - 一级导航图标统一以 `16px` 为上限。
  - 普通列表图标统一 `14px ~ 16px`。
  - 删除 `app-sidebar-toned-icon` 当前这种彩色底片常态视觉。
  - 若保留品牌感，只能在激活项或极轻微色相差上体现。
- `禁止事项`：
  - 常态 `18px~20px` 图标。
  - 常态彩色 icon chip。

### 7. 圆角必须分层，而不是全局一刀切

- `目标`：既去掉鹅卵石，又避免把大容器削得过硬。
- `Nexu 证据`：
  - 主导航约 `6px`。
  - 独立卡片（如 `.card`、`.runtime-card`）使用 `16px` 到 `20px`。
  - 主工作区壳体可到 `12px`。
- `XClaw 必须怎么做`：
  - 输入框、按钮、选择器：`4px ~ 6px`。
  - 列表项、菜单项、小型面板：`6px`。
  - 独立设置卡片 (Card) / 仪表盘模块：允许 `16px`。
  - 主工作区大壳、聊天主容器：允许 `10px ~ 12px`（如对齐 Nexu 的 `rounded-l-[12px]` 边界逻辑）。
- `禁止事项`：
  - 把主侧栏、会话列表等密集型列表也做成 `16px+` 圆角。

### 8. 标题栏必须分别服务 macOS 与 Windows

- `目标`：让两个平台都可信，而不是一套偏 mac 视觉硬套双端。
- `Nexu 证据`：
  - macOS 真正依赖 `hiddenInset + trafficLightPosition + vibrancy`。
  - 非 mac 实际上退回实色背景，并没有同等系统材质。
- `XClaw 必须怎么做`：
  - macOS：保留红绿灯区、允许标题栏与侧栏轻融合。
  - Windows：标题栏按钮区、拖拽区、工作区顶边要分得更清楚。
  - Linux：默认跟随 Windows 保守策略。
- `禁止事项`：
  - 用 mac 的 left inset 和 traffic light 逻辑直接套到 Windows。

### 9. 拖拽区与可点击区必须严格切分

- `目标`：桌面感不仅是视觉，更是窗口交互语义。
- `Nexu 证据`：
  - 多处使用 `WebkitAppRegion: "drag"` / `"no-drag"`。
  - 顶部有专门的 `.window-drag-bar`。
- `XClaw 必须怎么做`：
  - 所有标题栏空白区、允许拖窗的侧栏上沿必须是 `drag-region`。
  - 按钮、搜索框、列表滚动区、切换器必须是 `no-drag`。
  - 折叠按钮与 traffic lights / 窗口控制区绝不能抢点击区。
- `禁止事项`：
  - 可点击控件落在拖拽区域里。
  - 为了好看把整个头部都变成不可用拖拽区。

### 10. 滚动条要分平台，但不能走网页式夸张方案

- `目标`：兼顾 mac 的轻与 Windows 的可抓取性。
- `Nexu 证据`：
  - 全局滚动条是细、低对比、透明 track 的 `6px` 方案（`scrollbar-width: thin`，`-webkit-scrollbar { width: 6px; }`，`thumb { border-radius: 3px; }`）。
  - 它并没有做 V2 里那种超宽 Windows 滚动条。
- `XClaw 必须怎么做`：
  - macOS：`2px ~ 4px`，默认接近隐藏，hover/active 出现。
  - Windows：必须限制在 `width: 6px`，默认低对比，hover/active 增强。
  - Linux：跟随 Windows。
- `禁止事项`：
  - Windows 上做 `10px~14px` 的网页式粗滚动条。
  - macOS 上做永远可见的重轨道滚动条。

### 11. 分割线要比阴影更重要

- `目标`：特别是在 Windows 上，用边界而不是雾感建立层级。
- `Nexu 证据`：
  - 非 mac 退回实色背景时，层级主要靠色差与边界。
- `XClaw 必须怎么做`：
  - 标题栏与工作区、侧栏与工作区、Pane 与 Pane 之间优先用 `1px` 线分隔。
  - Windows 的 `chrome-divider` 与 `border-subtle` 要比 mac 稍强一档。
- `禁止事项`：
  - 用大面积阴影代替边界。
  - 用 8px 的分隔色块模拟模块切分。

### 12. 输入框焦点必须锐利，不做网页雾感

- `目标`：形成高质量桌面表单语言。
- `Nexu 证据`：
  - Input 使用 `focus:shadow-focus + border-brand-primary/30`。
  - 不是大面积泛白 ring。
- `XClaw 必须怎么做`：
  - 输入框与搜索框采用锐利边界聚焦（强制约束焦点样式为实色锐环，如 `--shadow-focus: 0 0 0 2px rgba(品牌色, 0.25)`，参考 Nexu 的 `rgba(61,185,206,0.25)`）。
  - 品牌色只做焦点强化，不染底色。
  - 搜索框高度压到 `28px ~ 32px`。
- `禁止事项`：
  - `focus:ring-2 focus:ring-ring/30 focus:ring-offset-2` 这类网页式雾 ring。

### 13. Button / Select / Textarea 的焦点语言要统一

- `目标`：避免组件各自为政。
- `Nexu 证据`：
  - 按钮与文本域使用统一的 `focus-visible:ring-1 focus-visible:ring-ring` (即 1px `#1c1f23` 环)。
  - 它内部其实并不完全统一，这正是 XClaw 要避免的坑。
- `XClaw 必须怎么做`：
  - Button、Select、Textarea、Input 统一成同一类焦点语法。
  - 首选 `border-color + 轻 ring` （例如统一使用 `ring-1` + Token定义的 `ring-color`） 或 `border-color + 焦点阴影` 二选一，不允许混搭三四套。
- `禁止事项`：
  - Input 一套、Button 一套、Select 又一套。

### 14. Dialog / Dropdown / Popover 必须统一浮层语言

- `目标`：桌面 App 的系统级浮层必须是同一个家族，不能有的像网页有的像手机。
- `Nexu 证据`：
  - Modal (Dialog)：使用 `width: min(480px, calc(100vw - 32px))`、`rounded-2xl`、标题 `text-[14px] font-semibold`、描述 `text-[11px]`。遮罩层采用 `bg-black/40 backdrop-blur-sm`。内容区叠加 `shadow-2xl` 与 `border-[var(--color-border)]`。
- `XClaw 必须怎么做`：
  - 所有浮层统一：
    - 小浮层 (Dropdown/Tooltip)：圆角 `6px ~ 8px`，轻阴影。
    - 大弹窗 (Dialog/Modal)：强制圆角 `16px` (2xl)，顶部 Header 与底部 Footer 使用明确的 `px-6 py-4` 和 `border` 分割线，中间 Body `px-6 py-5`，摒弃所有半屏大抽屉 (Sheet) 设计。
    - 遮罩层 (Overlay)：统一使用 `bg-black/40 backdrop-blur-sm`，避免纯黑或纯透明。
  - 下拉列表要支持 `max-height + overflow-y-auto + overscroll contain`。
- `禁止事项`：
  - 一个菜单 `rounded-md`，另一个 `rounded-2xl`。
  - 一个是冷静桌面浮层，另一个像移动端抽屉（禁止使用右侧或底部划出的大面板，桌面应以中央 Modal 为主）。

### 15. 遮罩层与模态动画必须克制

- `目标`：弹窗像桌面中断，不像网页营销动画。
- `Nexu 证据`：
  - Dialog 使用 `fade + zoom-in-95`，而不是远距离飞入。
- `XClaw 必须怎么做`：
  - Overlay 直接、短促出现。
  - Content 只允许 `opacity + 轻 scale`。
  - 出场时长控制在 `120ms ~ 180ms`。
- `禁止事项`：
  - 从屏幕底部、侧边长距离飞入。
  - 夸张弹性动画。

### 16. 聊天区、消息气泡与 Markdown 回归高阶桌面 IM 语法

- `目标`：避免把聊天气泡做成粗糙的直角网页块，兼顾 IM 的气泡阅读性和桌面的克制感。
- `Nexu 证据`：
  - 气泡容器：`rounded-[20px] px-4 py-3 text-[13px] shadow-[0_10px_24px_rgba(15,23,42,0.04)]`。
  - 气泡尾巴：使用 `rounded-tl-sm` (助手) 或 `rounded-tr-sm` (用户) 表示对话方向。
  - Tool Call / Artifact：变成 `inline-flex rounded-full px-2.5 py-1.5` 的细巧 Chip，而非占满一行的粗壮卡片。
  - Markdown：`pre` 背景为深色 `#1e1e2e` (无论亮暗色主题)，内联 `code` 使用 `bg-surface-3 px-1.5 py-0.5 rounded text-[0.9em]`。
- `XClaw 必须怎么做`：
  - `ChatInput` 外壳收敛，不再是巨大独立胶囊，直接归属到工作区底座。
  - 消息气泡允许使用 `20px` 圆角和微弱的 `0.04` 透明度阴影，并通过 `rounded-tl-sm`/`rounded-tr-sm` 切平起始角。
  - 工具调用卡片（Tool/Artifact）必须是轻量级 `inline-chip`（全圆角、小字号、无阴影，带主题色背景如 `rgba(0,163,101,0.06)`）。
  - Markdown 代码块必须独立深色化，内联代码必须有明确但轻量的高亮底色。
- `禁止事项`：
  - 阴影透明度不可超过 `0.05`，禁止大面积泛白发光气泡。
  - 禁止把工具卡片做成沉重的实色大方块。
  - `ChatInput` 禁止使用 `rounded-[16px]` 以上的超厚输入外壳。

### 17. Card / Pane / Empty State 必须纳入同一密度系统

- `目标`：避免某些面板像桌面，某些空状态像营销页。
- `Nexu 证据`：
  - 空状态通常使用一个背景柔和的大图标（如 `w-12 h-12` 配合 `bg-red-500/10` 或 `bg-surface-3`），加上标题和辅助说明。
  - 复杂面板 (Pane)：通常有明确的左右分栏 (如 `w-56` 的侧边导航配合 `flex-1` 的主区)，外壳使用 `border-border bg-surface-1`。
- `XClaw 必须怎么做`：
  - 空状态图标区不超过 `48px ~ 64px`，并且背景色必须是低透明度的 `surface-3` 或主题色 `10%` 透明度。
  - 空状态文字遵守主 UI 字级 (标题 `14px-18px`，描述 `13px`)，不做大幅营销化放大。
  - 设置页面、模型页面的左右分栏 Pane 结构，必须严格切分边界，不允许内容漂浮在无界面的背景上。
- `禁止事项`：
  - 大量 `p-6`、巨型 icon、空状态像 landing page。

### 18. Section label、次级信息、统计文案必须系统化

- `目标`：用排版层级，而不是大色块，建立信息组织。
- `Nexu 证据`：
  - `.sidebar-section-label` 使用 `10px + uppercase + tracking`。
  - 元信息普遍降到 `10px~12px`。
- `XClaw 必须怎么做`：
  - 章节标题统一：
    - `10px ~ 11px`
    - `uppercase`
    - `tracking: 0.06em ~ 0.08em`
    - `text-muted-foreground`
  - 次级描述不许和主标题同权重同颜色。
- `禁止事项`：
  - 区块标题与正文长得一样。

### 19. Cursor 与 user-select 必须回归桌面语义

- `目标`：修掉最容易泄露网页味的细节。
- `Nexu 证据`：
  - 它仍较偏 Web，button 默认 `cursor: pointer`，这恰好说明 XClaw 不能照抄这一条。
- `XClaw 必须怎么做`：
  - 主侧栏、标题栏工具按钮、分段控件、Pane header 按钮默认箭头指针。
  - 真正跳转型链接继续小手。
  - 壳层、侧栏、标题栏、按钮标题统一 `select-none`。
- `禁止事项`：
  - 整个桌面壳层随便可选中文字。
  - 所有按钮无差别小手。

### 20. 动效必须服务秩序，不服务炫技

- `目标`：让界面响应像系统级工具，而不是网页动画样板。
- `Nexu 证据`：
  - 大量短促 `120ms~160ms` 级过渡。
  - UI 控件 hover 采用 `transition-colors duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]`（250ms）或默认物理减速（ease-out）。
  - 主浮层以 `fade + scale`（如 `zoom-in-95`）为主。
- `XClaw 必须怎么做`：
  - `--motion-fast: 75ms`
  - `--motion-base: 150ms`
  - `--motion-slow: 220ms`
  - 缓动曲线约束：常规过渡使用 `ease-out`，弹层/菜单展开使用 `cubic-bezier(0.16, 1, 0.3, 1)`，组件状态反馈可使用 `cubic-bezier(0.4, 0, 0.2, 1)`。
  - 所有 hover/active 只过渡颜色、边框、透明度、极小位移（明确指定属性，如 `transition-colors duration-[var(--motion-base)] ease-out`）。
  - 侧栏折叠、Pane 切换可以稍慢，但不能弹。
- `禁止事项`：
  - `transition-all`
  - 大范围 `box-shadow` 动画
  - 卡片悬停明显漂浮

---

## 执行顺序与阶段约束

为了确保“全面对齐 Nexu”不是一句口号，执行顺序必须固定，禁止跳步。

### Phase 0：规范冻结

- 以本文件作为唯一现行规范。
- `design-v2.md` 仅保留归档价值，不再作为实现依据。
- 如需新增规则，先改文档，再改代码。

### Phase 1：窗口壳层与平台策略

优先文件：

- `electron/main/index.ts`
- `src/components/layout/TitleBar.tsx`
- `src/styles/globals.css`

目标：

- macOS 对齐 `nexu` 的壳层逻辑。
- Windows 建立高质量近似的实色 chrome 策略。
- 统一 `drag-region` / `no-drag`、顶部安全区、traffic lights / 控制按钮区。

若 Phase 1 未完成，不允许宣称“已开始全面对齐 Nexu”。

### Phase 2：主侧栏、会话栏、主工作区边界

优先文件：

- `src/components/layout/Sidebar.tsx`
- `src/components/layout/ChatSessionsPane.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/AppBrandLockup.tsx`
- `src/styles/globals.css`

目标：

- 清除主侧栏网页味。
- 建立 `nexu` 式主导航密度与边界秩序。
- 让侧栏与主工作区形成同一个物理壳层系统。

### Phase 3：输入、浮层、滚动条、焦点语言

优先文件：

- `src/pages/Chat/ChatInput.tsx`
- `src/pages/Chat/ChatMessage.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/sheet.tsx`
- `src/styles/globals.css`

目标：

- 统一 Input / Select / Button / Dialog / Dropdown / Sheet 的桌面语法。
- 统一 mac / Windows 滚动条与焦点策略。
- 让聊天工作区回到桌面容器语言。

### Phase 4：全站页面收束

优先文件范围：

- `src/pages/Models/`
- `src/pages/Agents/`
- `src/pages/Channels/`
- `src/pages/Skills/`
- `src/pages/Cron/`
- `src/pages/Settings/`

目标：

- 清掉残余网页式卡片、过大圆角、过大 padding、营销式空状态。
- 让全站页面统一服从 V3 的 20 条细则。

### 阶段性验收原则

- Phase 1 不通过，不能进入大规模组件重构。
- Phase 2 不通过，不能宣称主导航已对齐 `nexu`。
- Phase 3 不通过，不能宣称桌面语言已经统一。
- Phase 4 不通过，不能宣称“全局主题重构完成”。

---

## V3 红线规范

### 1. Chrome First：先壳层，后组件

- 主题重构先约束 `TitleBar`、`Sidebar`、`Workspace` 三个一级容器。
- macOS 允许标题栏与侧栏材质轻微融合，但必须保留红绿灯避让。
- Windows 必须保证标题栏控制按钮区域、拖拽区、侧栏上沿三者边界清晰。
- 所有主题决策先通过壳层验证，再下放到按钮、表单、列表。

### 2. 材质预算只能出现在大层级

- **允许**：
  - 标题栏背景轻微实色差
  - 侧栏基底极弱线性渐变
  - macOS 下壳层级 vibrancy / blur（如 `backdrop-filter: saturate(180%) blur(20px)`）
  - 大容器级阴影通过低透明度扩散建立层级（如 `0 18px 60px rgba(0, 0, 0, 0.08)`），不用深灰色。
  - Dialog / Popover 的轻阴影
- **禁止**：
  - 列表项、按钮、Tab、侧栏激活项使用玻璃感
  - `radial-gradient` 环境光
  - 大面积发散阴影
  - 用 `inset shadow` 制造按钮高光与浮雕

### 3. 主侧栏 Source List 规格

- 适用范围：
  - 全局导航侧栏
  - 会话列表
  - 频道/模型/技能等工作区资源列表
- 主导航 row 目标规格：
  - 高度：`30px ~ 32px`
  - 水平 padding：`10px ~ 12px`
  - 圆角：`6px`
  - 字号：`13px`
  - 字重：默认 `400/500`，激活 `500/600`
- hover：
  - 仅底色加深，不增阴影，不做边框跳变
- active：
  - 以底色 + 字重提升为主
  - 禁止额外描边
  - 禁止 inset 高光
  - 禁止看起来像胶囊按钮的立体块

### 4. 图标系统修正

- 主侧栏导航图标统一以 `16px` 为上限。
- 普通工作区列表图标以 `14px ~ 16px` 为主。
- 取消当前这种“每个一级导航图标都有独立彩色底片”的做法。
- 如果保留品牌感，只允许：
  - 图标本身做非常轻微的色相差异
  - 或在当前激活页使用细线强调
- 禁止：
  - 常态 `18px ~ 20px` 图标
  - 常态彩色背景图标胶囊

### 5. 圆角分层，不再一刀切

- 输入框、按钮、选择器：`4px ~ 6px`
- 列表项、菜单项、主导航项：`6px ~ 8px`
- 侧边栏二级列表 (如具体的 Session 会话项)、小面板：允许 `10px`
- 独立大弹窗 (Dialog Modal) / 独立卡片 (Card) / 仪表盘模块：允许 `16px ~ 20px`
- 聊天气泡：`20px`，单角切平 (`rounded-tl-sm`/`rounded-tr-sm`)
- 主工作区大壳、聊天主容器、嵌入式内容壳：允许 `10px ~ 12px`
- 禁止在主侧栏与资源列表里无差别使用 `16px+` 的圆角

### 6. 平台分层策略

#### macOS

- 可以保留壳层轻融合。
- 滚动条允许更细，默认接近隐藏，hover 再浮现。
- 允许侧栏或标题栏存在极轻的半透明材质。

#### Windows

- 采用实色 chrome。
- 通过 `1px` 边框和更明确的 `chrome-divider` 建立层级。
- 滚动条不做超粗系统仿真，宽度控制在 `4px ~ 6px`，hover/active 时提高可见度。
- 关闭按钮 hover 必须保持系统语义。

#### Linux

- 跟随 Windows 保守策略。
- 不追求强玻璃，不引入特例化特效。

### 7. 工作区布局

- 禁止定宽居中盒子。
- 主工作区必须与窗口宽度同步伸缩。
- 只允许用 `px-3`、`px-4`、`px-5` 这类内边距建立呼吸，不允许网页式 `mx-auto + max-width`。

### 8. 排版规则

- 主 UI 文字使用 `13px ~ 14px`。
- 页面大标题（Page Title）约束在 `24px`，字重 `700`，行高 `1.2`；区块标题（Section Title）`14px`，字重 `500`。
- 行高使用 `1.25 ~ 1.4`。
- **数字必须使用表格等宽字体 (Tabular Digits)**：在 CSS 中单独定义 `@font-face`（如 `unicode-range: U+0030-0039...`，并设置 `size-adjust: 88%`），将其指向 `JetBrains Mono` 等等宽字体，保证列表、时间、状态数据对齐。
- 侧栏、标题栏、菜单、表单优先系统字体体验。
- 品牌展示区可保留独立展示字族，但不能污染系统交互区。
- Windows 下禁止 `font-light`。

### 9. 动效规则

- `--motion-fast: 75ms`
- `--motion-base: 150ms`
- 禁止 `transition-all`
- 缓动曲线约束：
  - **页面进入 (Page Enter)**：使用短距离轻滑入，如 `opacity 0 -> 1` 配合 `translateX(12px) -> 0`，时间 `0.3s`，曲线 `cubic-bezier(0.16, 1, 0.3, 1)`。
  - **弹层/菜单入场 (Scale/Enter)**：必须带有轻微阻尼感，统一使用 `cubic-bezier(0.16, 1, 0.3, 1)`。
  - **常规状态切换/Hover**：使用 `ease-out` 或 `cubic-bezier(0.4, 0, 0.2, 1)`。
- 卡片悬停提升：允许极轻微的 `translateY(-1px)` 和扩散阴影 `0 10px 20px -5px rgba(0,0,0,0.06)`，取代粗暴的变色边框。
- hover 仅允许背景色、文字色、边框色、透明度的短促变化
- 侧栏折叠展开可允许 `180ms ~ 220ms`
- 禁止弹窗和菜单从远距离滑入

### 10. 焦点与输入

- Focus 以锐利边框为主，不做网页式雾状发光。
- 输入区与聊天底座要形成同一工作区语言，避免独立巨型胶囊。
- 工具按钮控制在 `24px ~ 28px` 级别。

### 11. 文本选择与指针

- 壳层、标题栏、侧栏、导航项统一 `select-none`
- 输入框、聊天内容、终端输出、代码块允许 `select-text`
- 主导航、标题栏工具按钮、分段控制默认箭头指针
- 真正超链接继续使用小手

### 12. 状态指示与数据列表

- **状态点 (Status Dot)**：拒绝网页大色块标签，采用类似 Nexu 的 `8px ~ 10px` 纯色点（如绿色、黄色、红色），可配合低透明度的 `ring` 扩散呼吸效果表示状态激活（如 `0 0 0 6px rgba(34, 197, 94, 0.12)`）。
- **数据列表 (Data Table)**：
  - 外壳：控制在 `12px` 圆角，`1px` 实线边框。
  - 表头：必须比内容小一号且降低对比度（如 `11px uppercase tracking-wider text-muted-foreground`），并与正文使用 `1px` 底边框分割。
  - 行悬停：仅允许极其微弱的底色加深（如 `rgba(0,0,0,0.015)`），不允许带阴影或粗边框。

### 21. 筛选器与切换组件 (Segmented Controls & Pills)
- **目标**：替代厚重的网页级 Tabs，建立桌面的细巧感。
- **Nexu 证据**：
  - Segment Control：外壳采用 `rounded-full p-1 bg-surface-2`，内部项使用 `px-4 py-1.5 text-[13px] font-medium`，激活项添加 `bg-white shadow-[var(--shadow-rest)]`。
  - Filter Pills (如 Tag 选择)：高度仅为 `h-7`，内边距 `px-3`，字号 `11px`，带数字徽标 (`tabular-nums`)。
  - **Switch (开关)**：极致还原 macOS 26 (Tahoe) 样式，包含白色/灰色状态点，精确的轨道缩放与阴影 (`shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]`)，焦点色强制使用原生蓝色等。
  - **Badge (徽标)**：`px-2.5 py-0.5 text-xs font-semibold rounded-md`，避免过大，背景色区分 semantic (如 success 使用 `bg-[var(--color-success-subtle)] text-[var(--color-success)]`)。
- **XClaw 必须怎么做**：
  - 对于顶级页面切换，使用带有滑块阴影感的紧凑型 Segment Control，取代粗重下划线的网页 Tabs。
  - 列表筛选器使用极致压缩的 Pill (药丸) 样式，高度不得超过 `28px`，圆角全角 `rounded-full`。
  - Switch 组件必须放弃网页通用的圆角矩形粗略模拟，在 macOS 下要做到高保真还原系统 Switch，包含内部的小竖线（On）和小圆圈（Off）。
  - Badge 标签必须降级为只读的极小号装饰元素，不能抢夺主要按钮的视觉重心。
- **禁止事项**：
  - 禁止使用带粗下划线的全屏宽 Tabs。
  - 筛选器不要带粗边框或高饱和度色块。

---

## 对 XClaw 当前侧栏的直接修正结论

以下不是猜测，而是基于当前代码的直接结论：

### 必须删除

1. `Sidebar.tsx` 激活态的边框表达
2. `Sidebar.tsx` 激活态的 `inset` 高光
3. 当前多色图标底片式的 `app-sidebar-toned-icon` 常态表现
4. 主侧栏里 `18px` 级导航图标

### 必须保留

1. `TitleBar.tsx` 已经存在的 macOS / Windows 分支
2. `drag-region` / `no-drag` 这一套窗口语义
3. `globals.css` 中已经建立的 `surface-*`、`chrome-*`、`shadow-*` token 基础

### 必须重写

1. 主侧栏选中态语法
2. 主侧栏图标视觉语法
3. 侧栏与标题栏、工作区之间的边界关系
4. Windows 滚动条策略

---

## V3 验收标准

1. 将 XClaw 与 Nexu、Finder、Windows 资源管理器并排对照时，XClaw 的主侧栏不再像一组贴上去的网页按钮。
2. 主侧栏单行视觉高度稳定在 `30px ~ 32px`。
3. 主侧栏激活项不再依赖边框、阴影、内高光建立存在感。
4. 一级导航图标不再出现常态彩色底片，不再使用 `18px` 级尺寸。
5. macOS 与 Windows 的标题栏和侧栏边界逻辑分别成立，而不是一套视觉硬套两个平台。
6. 全局仍禁止径向光晕、重阴影和组件级毛玻璃，但允许壳层级的弱材质。

---

## 最终结论

V2 最大的问题不是“不够狠”，而是**把真正的桌面质感误读成了纯减法**。

Nexu 给出的真实启示是：

- 桌面感来自**壳层结构正确**
- 质感来自**材料集中**
- 高级感来自**密度控制**
- 平台适配来自**承认差异而不是假装一致**

V3 因此不再追求“把所有特效都杀光”，而是追求：

**把材质收回到壳层，把组件压回到秩序。**
