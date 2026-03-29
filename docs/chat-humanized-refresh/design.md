# 聊天区域人性化设计优化

## 背景

第一阶段已经把聊天页的首屏、滚动链和消息结构拉回到可控状态，但聊天区域本身仍然偏“AI 控制台”而不是“桌面工作区”：

1. 助手消息、用户消息、thinking、tool、错误、复制、时间这些元素仍然像独立网页组件拼在一起。
2. 快捷操作虽然逐步补了，但整体缺少统一语义，有些操作像浮在消息上方的工具条。
3. 主阅读流里次级信息仍然偏重，用户会被过程块和交互按钮打断。

这次优化不再以性能为主，而是以“聊天区域的人性化和桌面工作区质感”为主。最新一轮目标进一步明确为：在不破坏全局壁纸能力与 `macOS / Windows` 窗口结构的前提下，把聊天主区整体向 `QClaw` 的通用桌面聊天语义对齐。

## 参考原则

### 以 QClaw 为第一参考，但不照搬

`QClaw` 真正值得借鉴的不是像素风或品牌皮，而是这几条产品逻辑：

1. 消息区优先像文稿流，而不是像控制面板。
2. 快捷操作存在，但默认很轻，只有在用户需要时才增强。
3. thinking / tool / 状态是“过程轨”，不是一堆厚卡片。
4. 错误和状态贴近操作源头，不做整页广播。
5. 用户消息更像被盖章的输入，助手消息更像铺在画布上的结果。
6. 次级动作默认接近隐身，hover 或选中后才抬起。

### 明确不借鉴的部分

1. 不引入 `QClaw` 的像素视觉语言。
2. 不复制它的重型反馈面板。
3. 不复制它依赖特定产物结构的 hook 卡片交互。
4. 不为了“像 QClaw”而增加本地没有真实需求的数据结构或协议。
5. 不强行复制它“用户一下、助手一整段”的分组结构；如果 `XClaw` 当前 store 没有稳定的 assistant block 语义，就不能为了视觉像它而硬改消息链。

## 本地已确认问题

### 真实使用中的问题

1. 用户已经多次反馈聊天区域仍有明显 AI 产品味，不够像成熟桌面应用。
2. 用户认为 `QClaw` 的快捷操作更顺手，说明当前 `XClaw` 的交互权重和入口组织仍然不够自然。
3. 在现有实现里，复制、时间、流式状态、tool 进度、thinking 展开等都已存在，但整体体验仍然像“功能齐了，节奏没齐”。
4. 开启壁纸后，聊天主区仍存在一块可感知的 `reading plane` 色块，主区与侧栏的明暗层次不像 `QClaw` 那样自然。
5. 侧栏、主区、输入区目前分别像三套局部玻璃组件，而不是同一张桌面壳层上的连续阅读区。

### 代码层事实

1. [src/pages/Chat/ChatMessage.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatMessage.tsx) 已经拆出了主列与次级轨，但次级轨里的块语义仍然偏离散。
2. [src/pages/Chat/ChatInput.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatInput.tsx) 已经具备轻量工具按钮、模型选择、@ 选择、附件入口，但“主输入动作”与“辅助动作”仍可继续收紧层级。
3. [src/pages/Chat/index.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/index.tsx) 已经具备回到底部、错误气泡、运行状态等机制，说明当前阶段问题主要是组织方式，而不是缺功能。
4. [src/styles/globals.css](/Users/jianglong/workspace/XClaw/src/styles/globals.css) 中 `.desktop-app-shell .app-chat-main-stage::before` 仍使用带边界、带 blur 的整块底板，这会在浅色壁纸下显成隐约矩形。
5. [src/components/layout/ChatSessionsPane.tsx](/Users/jianglong/workspace/XClaw/src/components/layout/ChatSessionsPane.tsx) 与 [src/pages/Chat/ChatInput.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatInput.tsx) 已经接入统一壳层，但会话侧栏搜索框、会话行和 composer 仍保留明显局部组件感。

## 目标

第二阶段只做以下事情：

1. 让聊天区域更像桌面工作区，而不是网页控制台。
2. 让快捷操作更容易发现，但默认更克制。
3. 让用户消息、助手消息、过程轨、错误、状态形成一套统一节奏。
4. 保持第一阶段已经修好的性能和滚动契约，不为了人性化重新引入结构抖动。
5. 让聊天主区比侧栏略亮，但不能回退成一块独立网页卡片。
6. 保持全局壁纸功能完整可用，并同时兼容 `macOS` 与 `Windows` 的标题栏和窗口层级。

## 非目标

这一阶段不做：

1. 不改 OpenClaw runtime 协议。
2. 不新增需要后端支持的“消息重试”“消息反馈上报”等假闭环能力。
3. 不重做左侧会话列表的数据模型、搜索语义和路由行为，只收视觉层级与材质表达。
4. 不引入重型动画、复杂悬浮面板或大面积新卡片系统。
5. 不改壁纸导入、清除、持久化和主进程链路。

## 设计原则

1. 正文优先，次级信息后退。
2. 正常态不播报，异常态才升级显示。
3. 快捷操作默认弱化，只在 hover、选中、异常或明确空态下增强。
4. 助手消息更像文稿流，用户消息更像轻回应，不做大块品牌色气泡。
5. 所有人性化改动必须守住第一阶段已经修好的滚动和宽度契约。
6. 聊天页只能“吃到”全局壁纸，不能自己再长出一张局部工作台卡片。

## 第二阶段方案

### 1. 收敛消息动作层

当前复制、时间已经在消息下方出现，但还不够像“消息元信息行”。

计划：

1. 用户和助手消息统一采用同一条轻 meta row。
2. 复制按钮保留，但进一步降低默认存在感。
3. 流式尾标、时间、复制、局部状态统一贴近 meta row 逻辑，不再像额外的工具条。

目标是让用户感觉“这些动作本来就该在这里”，而不是“消息下面塞了一排按钮”。

### 2. 把 thinking / tool / status 收成过程轨

当前 `thinking`、`tool`、流式状态已经分离，但视觉语义仍然不够统一。

计划：

1. `thinking` 和 `tool` 统一成更轻的过程轨组件族。
2. 过程轨默认强调“当前发生了什么”，而不是强调卡片边框。
3. 成功、运行中、错误三种状态只用轻图标、轻点或轻文案区分，不再通过大面积色块区分。

这一步是第二阶段最核心的设计收口。

### 3. 调整消息主视觉层级

基于 `QClaw` 的有效经验：

1. 助手消息继续往透明文稿流方向收。
2. 用户消息保留轻 tint，但继续压低品牌块存在感。
3. 图片、文件、代码块本阶段只做视觉收平，不改现有内容分支结构。
4. meta row 与复制保留，但默认权重继续低于正文，不做永久高存在感工具条。

原则不是把所有元素都做轻，而是让“正文”重新成为主角。

### 4. 重做主区与侧栏的明暗关系

这一轮新增一个更硬的视觉约束：

1. 主区阅读面要比侧栏略亮，但只允许是无边界轻 veil。
2. 侧栏要更安静、更暗一点，更接近 `QClaw` 的 source list 背景语义。
3. 主区与顶部、主区与 composer 之间不能再出现矩形切缝或局部玻璃卡片边界。
4. 有壁纸时依旧成立；无壁纸时也要成立，不能靠特定壁纸偷效果。

### 5. 让 composer 并入阅读流末端

1. `composer` 不再表现为独立玻璃控制台，而是阅读流尾部的一层轻表面。
2. 保留附件、`@agent`、模型、slash 等能力，但默认权重继续压低。
3. 发送按钮、工具按钮和浮层仍要兼容 `macOS / Windows`，不能破坏已有交互。

### 6. 强化真正有价值的快捷操作

第二阶段保留并优化这些快捷动作：

1. 复制
2. 回到底部
3. 模型快速切换
4. @ 目标切换

只优化这类已经被真实使用证明有价值的动作。

明确不在第二阶段新增：

1. 点赞/点踩反馈面板
2. 多级操作菜单
3. 重型 follow-up 建议流

如果未来要做 follow-up 或 hook 建议，必须先证明 `XClaw` 当前聊天协议能稳定提供对应数据。

### 7. 统一错误与状态语言

当前已经把错误从整页横条改成了贴近输入区的轻气泡，这是正确方向。

第二阶段继续要求：

1. 请求级错误继续贴近输入区。
2. 会话级过程状态贴近消息流。
3. 全局运行状态继续留在最顶层小状态点，不进入正文。

这样不同层级的问题不会互相抢位置。

## 影响范围

本阶段预计主要修改：

1. [src/pages/Chat/ChatMessage.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatMessage.tsx)
2. [src/pages/Chat/index.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/index.tsx)
3. [src/pages/Chat/ChatInput.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatInput.tsx)
4. [src/components/layout/ChatSessionsPane.tsx](/Users/jianglong/workspace/XClaw/src/components/layout/ChatSessionsPane.tsx)
5. [src/styles/globals.css](/Users/jianglong/workspace/XClaw/src/styles/globals.css)
6. 聊天相关定向测试
7. [docs/global-wallpaper/design.md](/Users/jianglong/workspace/XClaw/docs/global-wallpaper/design.md) 中的壁纸兼容约束

## 验收标准

第二阶段完成后，聊天区域应该达到：

1. 助手消息、用户消息、thinking、tool、状态、错误在同一窗口内不再表现为多套独立卡片体系。
2. 快捷操作在默认态下不再比正文更抢眼，hover 或异常态时才增强。
3. 不破坏第一阶段已经收好的滚动、宽度、流式与复制链路。
4. 主区比侧栏略亮，但没有可感知的矩形 reading card。
5. 有壁纸和无壁纸两种状态下，聊天主区都保持同一套层级关系。
6. `macOS / Windows` 下聊天页都不引入新的标题栏切缝或窗口交互回归。
7. 真实 `dev` 环境下，至少 1 条已有长会话和 1 条正在流式的会话都能通过手工验收。
