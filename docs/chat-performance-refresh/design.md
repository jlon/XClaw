# 聊天性能与流畅度优化

## 背景

当前聊天页已经完成了一轮主题和人性化收口，但首屏进入、长会话滚动和消息排版仍然不够稳定，用户已经在本地真实使用中暴露出两类问题：

- 首屏进入和长会话滚动不够顺，主观感受偏“网页组件堆叠”，不像桌面工作区。
- 消息区域出现截断、错位和信息掉层，尤其在富内容、长文本、复制/时间元信息同时存在时更明显。

这次优化以 `QClaw` 的聊天设计思路为参考，但只在 `XClaw` 本地已经确认存在同类问题时才借鉴，不做无证据迁移。

## 已确认的本地证据

### 代码证据

1. [src/pages/Chat/index.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/index.tsx) 仍然直接对 `messages.map(...)` 做全量渲染，长会话时每条消息都会进入完整富内容渲染路径。
2. [src/pages/Chat/ChatMessage.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatMessage.tsx) 同时承担：
   - markdown 正文
   - thinking
   - tool 状态
   - 图片
   - 文件
   - 复制/时间元信息
   - lightbox 状态
3. [src/pages/Chat/ChatMessage.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatMessage.tsx) 对用户消息和助手消息使用了明显不同的宽度规则：
   - 用户：`w-full max-w-[70%] md:max-w-[62%]`
   - 助手：`w-full max-w-[min(76%,40rem)]`
4. [src/hooks/use-stick-to-bottom-instant.ts](/Users/jianglong/workspace/XClaw/src/hooks/use-stick-to-bottom-instant.ts) 仍然使用 `visibility: hidden -> 双 RAF -> scrollTop = scrollHeight -> reveal` 的策略，并且 `resize` 为 `smooth`，这会放大首屏空白和富内容高度变化时的滚动抖动。

### 用户现场证据

1. 用户在真实聊天记录中已经截到消息掉层/截断截图，说明问题不是理论风险，而是当前实现中的真实缺陷。
2. 用户持续反馈首屏和滚动“不流畅”，说明现有主题层优化不足以掩盖结构级问题。

## 目标

第一阶段只解决以下问题：

1. 首屏进入不再出现明显的空一下、跳一下、抖一下。
2. 长消息和富内容消息在常见窗口宽度下不再出现正文、元信息、复制入口错位。
3. 长会话滚动更稳，滚动时不再像推一堆厚网页卡片。
4. 保持现有聊天功能闭环：
   - streaming
   - thinking 展开
   - tool 状态
   - 图片预览
   - 文件卡片
   - 回到底部
   - 复制

## 非目标

本阶段不做以下事情：

1. 不上真正的虚拟列表。
2. 不重写聊天 store。
3. 不改消息协议和 OpenClaw runtime。
4. 不继续扩大视觉改造范围到整个应用。

## 设计原则

1. 以 `XClaw` 本地真实问题为准，`QClaw` 只作为参考样本。
2. 先减结构复杂度，再谈更激进的性能策略。
3. 先稳住消息主列，再放置次级信息。
4. 正文是主层，meta、复制、thinking、tool、附件是次级层。
5. 首屏体验优先于炫技动画，避免为了“顺滑”引入额外抖动。

## 第一阶段方案

### 1. 重构消息行结构

把每条消息拆成两个层级：

- 主层：
  - 头像
  - 正文气泡或正文文档流
- 次级层：
  - 时间
  - 复制
  - thinking
  - tool 状态
  - 图片与文件

这样做的目的不是换样式，而是避免次级块参与正文主排版，减少宽度竞争和错位。

### 2. 收敛消息宽度规则

不再继续维持“用户一套、助手一套、富内容再自己漂”的宽度策略。

计划改成：

- 聊天工作区保持统一阅读列宽。
- 助手正文默认占用稳定文档列。
- 用户消息相对紧一点，但仍然跟同一列系统对齐。
- meta 行和复制入口跟随消息列，而不是掉到列外。

### 3. 去掉隐藏后滚到底的首屏策略

[src/hooks/use-stick-to-bottom-instant.ts](/Users/jianglong/workspace/XClaw/src/hooks/use-stick-to-bottom-instant.ts) 将改成：

- 不再隐藏滚动容器。
- 初次进入和切换会话只做即时滚底。
- 富内容 resize 不再默认走 `smooth`，避免持续补动画导致抖动。

### 4. 富内容轻量化

第一阶段不做虚拟列表，但会降低首屏富内容压力：

- thinking 和 tool 状态保持次级展示。
- 图片和文件区不再抢正文宽度。
- 长会话下优先保证正文滚动和阅读稳定。

## 参考策略

### 来自 QClaw 的可迁移思路

1. 聊天页更像平的桌面工作区，而不是厚卡片堆叠。
2. 输入区和消息区分工明确，正文优先，辅助状态退后。
3. 错误、状态、复制等次级信息尽量贴近操作源头，不做大横幅。

### 不直接照搬的部分

1. 不复制 QClaw 的像素尺寸。
2. 不复制 QClaw 的品牌色和图形语言。
3. 不为了对齐 QClaw 而引入本地没有证据支撑的行为改动。

## 架构影响

本阶段主要影响：

- [src/pages/Chat/index.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/index.tsx)
- [src/pages/Chat/ChatMessage.tsx](/Users/jianglong/workspace/XClaw/src/pages/Chat/ChatMessage.tsx)
- [src/hooks/use-stick-to-bottom-instant.ts](/Users/jianglong/workspace/XClaw/src/hooks/use-stick-to-bottom-instant.ts)
- [src/styles/globals.css](/Users/jianglong/workspace/XClaw/src/styles/globals.css)
- 相关聊天单测

不影响：

- OpenClaw runtime 协议
- provider 配置逻辑
- session 数据模型

## 发布说明

如果第一阶段完成，聊天页的变化应当是：

1. 首屏进入更直接，不再先闪空白。
2. 消息正文和复制/时间信息不再出现“掉层”。
3. 长会话滚动更稳。
4. 页面主观感觉更像桌面聊天工作区，而不是 AI 网页面板。
