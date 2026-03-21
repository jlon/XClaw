# 聊天列表去网页感改造验证

## 目标

确保聊天左侧会话列表在不破坏现有功能的前提下，完成去网页感改造。

## 必跑验证

- `pnpm exec vitest run tests/unit/chat-layout.test.tsx`
- `pnpm exec eslint src/components/layout/ChatSessionsPane.tsx src/components/layout/MainLayout.tsx tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm run typecheck`

## 手工验收

- 聊天侧栏宽度明显收紧，不再像内容栏
- 聊天列表默认不再展示身份章
- 本地 pane 标题已退出聊天列表
- 默认会话项回到单行 source list，只在必要时再补轻度 Agent 区分
- 主列表不再展示每行时间
- 搜索默认先展示为轻筛选 trigger，只有进入搜索时才展开输入态
- 搜索、切换会话、新建会话、删除会话都仍然可用
- 当前项 hover / active 层级更轻，不再像网页卡片
- mac / Windows 下滚动条和边界维持现有轻度平台适配
- 长 Agent 名与 CJK 文本在 `250px` 左右的侧栏下仍能稳定截断
- 删除按钮在 hover 和键盘 focus 时都可发现、可点击

## 风险回归点

- 搜索是否还能按标题 / Agent / 会话标签命中
- trigger 展开/收起后，输入焦点和 ESC 退出是否正常
- 删除按钮 hover 时是否仍然可点
- 当前会话切换是否仍然正确跳转到 `/`
- 分组文案与测试是否保持一致
- 同名会话标签时，内联 Agent 后缀是否仍能正确区分
