# 全局主题重构测试

## 目标

确认新的全局主题系统在保持统一品牌识别的同时，能在 mac / Windows 上维持稳定、克制、桌面应用化的视觉体验，不再呈现 AI 网页风。

## 当前结论

- 代码和自动化验证可以视为已闭环
- 最终验收仍未闭环，因为 `mac / Windows` 真机手工 smoke 还没完成
- 首页 / 欢迎态资产是否继续跟随新主题重绘，仍属于本特性的观察项，不作为当前代码闭环的阻塞条件
- `Chat` 最新一轮“空态头部极简化”已按设计落地，但本轮根据快速收口要求未重新跑自动化，下一轮收尾时需要补回
- `Chat` 最新一轮“信息上吸到工作区顶层 + 弱化头部分界”已落地，本轮只做最小静态校验，完整自动化仍需在后续收尾时补回
- `Chat` 最新一轮“并入 TitleBar，取消页面内第二条页头”已落地，本轮仍按快速收口策略只做最小静态校验
- `Chat` 最新一轮“移除顶栏标题与会话元信息”已落地，本轮仍按快速收口策略未补完整自动化
- `Chat` 最新一轮“移除底部 gateway 状态栏，并将微状态上移到顶栏工具区”已落地，本轮已补一条定向主题结构回归和最小静态校验
- `Chat` 最新一轮“为顶栏 gateway 微状态补柔和呼吸反馈”已落地，本轮同样只补定向结构回归和最小静态校验

## 设计阶段验证

- 视觉示意页能清晰表达“深红铜 + 石墨黑”的品牌方向
- 视觉示意页能清晰表达“瓷白灰 + 深红铜”的浅色方向
- `oneclaw / youclaw` 的参考吸收点已写入设计文档，而不是停留在口头描述
- 平台适配边界明确，避免后续演变成两套主题
- 设计稿已完成至少三轮复盘，并把关键红线写回文档，而不是停留在口头审美判断

## 实现阶段必跑验证

### 代码级

- `pnpm exec eslint src/App.tsx src/components/layout/MainLayout.tsx src/components/layout/Sidebar.tsx src/components/layout/TitleBar.tsx src/components/layout/WorkspacePage.tsx src/components/layout/ChatSessionsPane.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx src/components/ui/card.tsx src/components/ui/switch.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatToolbar.tsx src/pages/Chat/ChatInput.tsx src/pages/Channels/index.tsx tests/unit/theme-application.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm exec eslint src/components/settings/ProvidersSettings.tsx src/components/settings/UpdateSettings.tsx src/pages/Settings/index.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Setup/index.tsx tests/unit/theme-second-wave-pages.test.ts --max-warnings=0`
- `pnpm exec eslint tests/unit/theme-second-wave-pages.test.ts --max-warnings=0`
- `pnpm run typecheck`

### 构建级

- `pnpm run build:vite`

## 手工测试

### 1. 浅色主题

1. 打开首页、频道页、设置页
2. 确认不再出现“暖米色 + 默认蓝主色”的旧组合
3. 确认品牌主色统一为深红铜语义
4. 确认输入框、卡片、侧栏和按钮的层级稳定
5. 确认不会因为浅色主题而重新看起来像通用 SaaS 页面

### 2. 深色主题

1. 打开首页、频道页、设置页
2. 确认整体更像桌面应用，不像通用深色后台
3. 确认 glow 和高亮存在，但不刺眼
4. 确认状态色和品牌色不会互相污染
5. 确认深色下铜红不会过度泛滥成“整页发热”

### 3. 平台体验

1. 在 mac 下确认整体更轻、更静
2. 在 Windows 下确认边框与分层更清晰
3. 确认两端品牌主气质一致，没有分裂成两套产品
4. 确认 `prefers-reduced-motion` 下呼吸、浮起、发光效果会被正确抑制
5. 确认 Windows 高对比环境下关键边界和焦点态仍可识别

## 回归风险

- 页面里遗留的固定 hex 可能继续破坏统一主题
- 某些旧组件可能仍把 `primary` 当“默认蓝按钮”使用
- 深色模式的局部 glow 如果失控，会重新滑向 AI 风
- `Settings / Models / Agents / Skills / Cron` 当前已有源码级主题回归测试，但还缺更细颗粒度的交互级视觉回归
- `Setup` 当前已有源码级主题回归测试，但还缺切换 `takeover / fresh / OAuth / logs` 等状态时的页面级回归
- `Setup` 的代码和自动化验证已闭环，但其桌面主题观感仍需要真机手工确认
- `Chat` 空态欢迎区虽然已移除 logo、badge 和状态 pill，但建议卡片的文字密度仍需在真实桌面窗口里继续观察
- `Chat` 头部虽然已继续贴顶，但仍需在 mac / Windows 真机窗口里确认拖拽区、标题区和内容区的连接感是否足够自然
- `Chat` 顶部信息虽然已经收成单层，但仍需确认 Windows 顶栏里聊天动作和窗口控制按钮的距离是否足够稳定
- 在完成双端手工 smoke 之前，全局主题重构不视为最终验收完成

## 本轮已执行验证

- `pnpm exec vitest run tests/unit/theme-application.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channels-page.test.tsx`
- `pnpm exec vitest run tests/unit/theme-application.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channels-page.test.tsx tests/unit/agents-page.test.tsx`
- `pnpm exec vitest run tests/unit/theme-second-wave-pages.test.ts`
- `pnpm exec vitest run tests/unit/theme-application.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/workspace-page-layout.test.tsx`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx`
- `pnpm exec vitest run tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx`
- `pnpm exec vitest run tests/unit/chat-theme-shell.test.ts -t "keeps the header minimal and limits desktop-grade surfaces to tools and composer"`
- `pnpm exec vitest run tests/unit/chat-session-presentation.test.ts tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx`
- `pnpm exec vitest run tests/unit/setup-primary-action.test.ts tests/unit/setup-page-i18n.test.tsx tests/unit/setup-preparation-stage.test.tsx tests/unit/setup-locale.test.ts tests/unit/setup-wizard-flow.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-takeover.test.tsx`
- `pnpm exec eslint src/App.tsx src/components/layout/MainLayout.tsx src/components/layout/Sidebar.tsx src/components/layout/TitleBar.tsx src/components/layout/WorkspacePage.tsx src/components/layout/ChatSessionsPane.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx src/components/ui/card.tsx src/components/ui/switch.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatToolbar.tsx src/pages/Chat/ChatInput.tsx src/pages/Channels/index.tsx tests/unit/theme-application.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Chat/ChatToolbar.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx src/pages/Chat/session-presentation.ts tests/unit/chat-session-presentation.test.ts tests/unit/chat-theme-shell.test.ts tests/unit/chat-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Chat/ChatToolbar.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/gateway-ui.ts tests/unit/chat-theme-shell.test.ts --max-warnings=0`
- `pnpm exec eslint src/components/settings/ProvidersSettings.tsx src/components/settings/UpdateSettings.tsx src/pages/Settings/index.tsx src/pages/Models/index.tsx src/pages/Agents/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/*.tsx src/components/setup/*.ts tests/unit/setup-*.ts tests/unit/setup-*.tsx --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run build:vite`

说明：

- 当前仓库的 ESLint 配置不会处理 `globals.css`，所以 CSS 文件不能直接放进同一条 `eslint` 命令里；这不是本轮代码错误，而是工具边界。
- 如果把 `build:vite` 和大体量 `vitest` 套件并行跑，个别页面测试会因为资源争抢触发假超时；最终结果应以串行验证为准。
