# 聊天消息区桌面 IM 质感对齐进度

## 2026-03-22

1. 已完成 QClaw 解包源码核对，确认本轮应对齐的是通用桌面 IM，而不是像素办公室样式。
2. 已识别当前 XClaw 问题：
   - 用户气泡过窄
   - 助手正文仍有弱卡片感
   - 元信息占据正文下方流
   - 富内容块留白不足
3. 已按源码逐项核对消息画布、用户气泡、助手正文、图片附件、流式态、工具链和思考链。
4. 已完成实现：
   - 引入 `app-chat-message-primary`
   - 用户/助手气泡语义按 QClaw 通用桌面 IM 收口
   - 元信息改为浮动 hover affordance
   - 消息画布改为开放式 `app-chat-thread-canvas`
   - 图片预览改为自然尺寸 `200px` 上限，不再强制方块裁切
5. 已继续补齐助手反馈区：
   - `thumbs rail`
   - `not helpful` feedback panel
   - 输入框、关闭动作、提交按钮
6. 已把 fallback typing 与 tool-processing 收成独立助手消息 bubble，不再复用旧 runtime pill。
7. 已把消息态滚动壳层按平台分流：
   - mac / 非 Windows：`workspace-page-scroll-default`
   - Windows：`workspace-page-scroll-win`
   - 欢迎态：`subtle-scrollbar`
8. 已修复工具阶段消息重复问题：
   - `toolresult final` 触发的中间快照不再保留正文文本
   - 工具轨与最终回答同时存在时，只保留一条正文输出
9. 自动化验证已通过，源码级闭环已完成，当前剩余工作只是真实 Electron 窗口的肉眼验收。
