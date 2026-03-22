# 聊天消息区桌面 IM 质感对齐设计

## 目标

基于 QClaw 解包源码中的通用桌面 IM 消息区，而不是像素办公室模式，对齐 XClaw 的消息区质感。核心不是照搬 DOM，而是对齐以下语义：

1. 用户消息是右侧自然浮动的独立气泡。
2. 助手消息是偏透明的正文块，而不是弱卡片。
3. 时间与复制等次级操作不应挤占正文下方版面。
4. 附件、图片、工具链、思考区应作为正文下方的独立子块。

## QClaw 源码证据

参考文件：`.reference/qclaw-unpacked-20260321/out/renderer/assets/a-ChxxDMYc.css`

关键样式：

1. `.message-item.user { justify-content: flex-end; }`
2. `.message-bubble { max-width: 70%; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.6; }`
3. `.message-bubble.user { background: #f44c4c14; border-bottom-right-radius: 4px; }`
4. `.message-bubble.assistant { background: transparent; border-bottom-left-radius: 4px; }`
5. `.message-images { gap: 8px; margin-bottom: 8px; }`
6. `.streaming-indicator { padding: 12px 20px; border-radius: 12px 12px 12px 4px; width: fit-content; }`
7. `.messages-area { padding: 24px 24px 8px; max-width: 1000px; margin: 0 auto; width: 100%; }`
8. `.message-feedback { display: flex; flex-direction: column; align-items: flex-start; margin-top: 8px; width: 100%; max-width: 500px; }`
9. `.feedback-panel { margin-top: 8px; padding: 12px 16px; border-radius: 12px; }`
10. `.feedback-input-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }`

## XClaw 当前问题

1. 用户列宽过窄，当前 `max-width: min(78%, 31rem)` 让短文本显得挤。
2. 用户气泡圆角和边框语言偏重，不够像桌面 IM。
3. 助手正文仍然带半气泡视觉，和 QClaw 的自由文本块语义不一致。
4. 时间与复制操作在正常流里占位，打散消息块重心。
5. 富内容块跟随正文列宽挤压，附件与工具链不够自然。
6. 整个消息区还包在一张厚边框卡片里，和 QClaw 的开放式消息画布不一致。

## 方案

### 1. 引入主消息壳层

在 `ChatMessage.tsx` 中增加 `app-chat-message-primary`，承载正文气泡与浮动元信息。`app-chat-message-secondary` 只负责图片、附件等子块。

### 2. 重排用户与助手正文语义

1. 用户消息：
   - 列宽改为 `min(70%, 34rem)`
   - 气泡圆角改为 `12px / 4px`
   - 内边距改为 `12px 16px`
   - 颜色改为更轻的主色半透明底
2. 助手消息：
   - 列宽改为 `min(70%, 44rem)`
   - 保持透明正文
   - 去掉当前半卡片感与左侧内阴影

### 3. 浮动元信息

`MessageMetaBar` 改成浮动 hover affordance，不再占据正文下方流式空间。默认隐藏，hover/focus 时显示在主消息块外缘。

### 4. 富内容子块收口

1. 图片卡恢复更接近 QClaw 的圆角与间距
2. 文件卡从“重玻璃感”收成更轻的桌面附件卡
3. Thinking / Tool 卡收成更接近 QClaw 的浅灰 toggle 样式

### 5. 消息画布改回开放式平面

1. 在聊天线程区增加 `app-chat-thread-canvas`
2. 按 QClaw `messages-area` 语义收成 `24 / 24 / 8` 内边距与 `1000px` 画布宽度
3. 去掉当前线程容器的厚边框、圆角和大阴影，只保留消息本身作为视觉主体

### 6. 图片预览改成自然尺寸

1. 用户图片不再强制裁成固定方块
2. 用户/助手图片统一收成 `max-width/max-height: 200px`
3. 圆角对齐 QClaw 的 `8px`

### 7. 助手反馈区补齐桌面 IM 语义

1. 参考 QClaw 的 `.message-feedback / .feedback-actions / .feedback-btn`
2. 在助手正文下方补一条轻量反馈 rail
3. `not helpful` 展开轻量 panel，包含标题、关闭动作、输入框与提交按钮
4. 当前只做本地交互态，不接入后端反馈提交链路

### 8. typing / processing 与滚动壳层补齐

1. fallback typing 与 tool processing 不再复用旧的 runtime pill
2. 两者统一收成助手消息行下的独立 bubble，参数跟随 QClaw `.streaming-indicator`
3. 消息态滚动壳层在 mac 使用 `workspace-page-scroll-default`，在 Windows 使用 `workspace-page-scroll-win`
4. 欢迎态继续保留隐藏式 subtle scrollbar，避免把桌面 IM 消息滚动语义带进空态

## 非目标

1. 不对齐像素办公室模式
2. 不接入真实反馈提交后端
3. 不重写消息分组算法
