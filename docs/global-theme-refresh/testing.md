# 全局主题重构测试

## 测试目标

确认 `XClaw` 的主题系统已经从“网页产品主题”转向“工业级桌面应用主题”，并且真正落实了：

- `QClaw substrate`
- `XClaw accent`

而不是只做到“颜色更淡一些”。

## 当前判断

- 代码与自动化验证可以持续推进
- 最终验收仍不能只靠自动化
- 真正的完成判断，必须包含真实桌面窗口里的质感确认

## 必跑验证

### 代码级

- `pnpm exec vitest run tests/unit/theme-application.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/chat-layout.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/channel-config-modal.test.tsx tests/unit/setup-wizard-layout.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/theme-second-wave-pages.test.ts tests/unit/channels-page.test.tsx tests/unit/chat-theme-shell.test.ts --testTimeout=15000`
- `pnpm exec vitest run tests/unit/theme-second-wave-pages.test.ts tests/unit/channels-page.test.tsx tests/unit/chat-theme-shell.test.ts --testTimeout=15000 --reporter=dot`
- `pnpm exec vitest run tests/unit/dark-theme-compatibility.test.ts --reporter=dot`
- `pnpm exec vitest run tests/unit/dark-theme-compatibility.test.ts tests/unit/chat-layout.test.tsx tests/unit/settings-layout.test.tsx tests/unit/channels-page.test.tsx tests/unit/setup-wizard-layout.test.tsx --testTimeout=15000 --reporter=dot`
- `pnpm exec vitest run tests/unit/channel-config-modal.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/theme-second-wave-pages.test.ts --testTimeout=15000`
- `pnpm exec vitest run tests/unit/theme-second-wave-pages.test.ts -t "keeps the skills enabled switch on a token-driven accent in light theme instead of a hard black toggle" --reporter=dot`
- `pnpm exec vitest run tests/unit/channel-config-modal.test.tsx --testTimeout=15000 --reporter=dot`
- `pnpm exec vitest run tests/unit/theme-second-wave-pages.test.ts --testTimeout=15000 --reporter=dot`
- `pnpm exec vitest run tests/unit/channel-config-modal.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx tests/unit/chat-humanized-actions.test.tsx --testTimeout=15000 --reporter=dot`
- `pnpm exec vitest run tests/unit/ui-primitives-theme.test.tsx`
- `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx`
- `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx tests/unit/stores.test.ts tests/unit/chat-layout.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx tests/unit/chat-message.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx tests/unit/chat-message.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "shows a dedicated chats pane on the chat route" --testTimeout=15000`
- `pnpm exec vitest run tests/unit/chat-layout.test.tsx -t "does not mount the studio surface before setup is complete" --testTimeout=15000`
- `pnpm exec eslint src/components/layout/TitleBar.tsx src/components/layout/ChatSessionHeaderControls.tsx src/components/layout/GlobalTitleBarUtilities.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx tests/unit/chat-message.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/models-page.test.tsx --reporter=dot --testNamePattern='caps provider board columns|uses an auto-fit provider grid|lets the default board grow beyond four columns'`
- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx --reporter=dot --testNamePattern='keeps breakdown focused on models after selecting a provider|reveals breakdown and recent requests after entering provider focus|keeps provider focus stable when a missing provider is requested from the light overview|renders provider inspector in edit mode after clicking edit|consumes workbench contracts in the production models page and follows the provider-first shell'`
- `pnpm exec vitest run tests/unit/agents-store.test.ts tests/unit/cron-agent-targeting.test.tsx tests/unit/chat-session-actions.test.ts tests/unit/chat-target-routing.test.ts --reporter=dot`
- `pnpm run typecheck`
- `git diff --check`
- `pnpm exec eslint src/stores/agents.ts src/pages/Cron/index.tsx src/stores/chat.ts src/stores/chat/session-actions.ts tests/unit/agents-store.test.ts tests/unit/cron-agent-targeting.test.tsx tests/unit/chat-session-actions.test.ts --max-warnings=0`
- `pnpm exec eslint src/components/layout/MainLayout.tsx src/components/layout/WorkspacePage.tsx src/components/layout/Sidebar.tsx src/components/layout/TitleBar.tsx src/components/layout/ChatSessionsPane.tsx src/components/channels/ChannelConfigModal.tsx src/components/settings/ProvidersSettings.tsx src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx src/components/setup/SetupProviderStage.tsx src/components/setup/SetupCompleteStage.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/card.tsx src/components/ui/confirm-dialog.tsx src/pages/Agents/index.tsx src/pages/Cron/index.tsx src/pages/Skills/index.tsx src/pages/Models/index.tsx src/pages/Settings/index.tsx src/pages/Channels/index.tsx src/pages/Chat/ChatInput.tsx tests/unit/theme-application.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/chat-layout.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/channel-config-modal.test.tsx tests/unit/setup-wizard-layout.test.tsx tests/unit/channels-page.test.tsx tests/unit/chat-theme-shell.test.ts --max-warnings=0`
- `pnpm exec eslint src/components/layout/MainLayout.tsx src/components/layout/WorkspacePage.tsx src/components/layout/ChatSessionsPane.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx src/components/ui/textarea.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatMessage.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-layout.test.tsx tests/unit/ui-primitives-theme.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx tests/unit/chat-message.test.tsx --max-warnings=0`
- `pnpm exec eslint src/components/layout/MainLayout.tsx src/components/layout/TitleBar.tsx src/components/layout/Sidebar.tsx src/components/layout/ChatSessionsPane.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/stores/settings.ts tests/unit/workspace-page-layout.test.tsx tests/unit/stores.test.ts tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx --max-warnings=0`
- `pnpm exec eslint src/components/layout/workbench-button-styles.ts src/components/layout/WorkbenchHeaderIcon.tsx src/pages/Settings/index.tsx src/components/layout/ChatSessionsPane.tsx src/pages/Chat/ExecApprovalOverlay.tsx src/components/agents/AgentListPane.tsx src/pages/Agents/index.tsx src/pages/Skills/index.tsx src/components/channels/ChannelConfigEditor.tsx src/components/setup/SetupCompleteStage.tsx tests/unit/dark-theme-compatibility.test.ts --max-warnings=0`
- `pnpm exec eslint src/components/channels/ChannelConfigModal.tsx tests/unit/channel-config-modal.test.tsx --max-warnings=0`
- `pnpm exec eslint src/components/channels/ChannelConfigModal.tsx src/components/settings/ProvidersSettings.tsx src/pages/Settings/index.tsx src/pages/Chat/ChatInput.tsx src/pages/Chat/ChatToolbar.tsx src/pages/Chat/ChatMessage.tsx src/pages/Chat/index.tsx src/pages/Agents/index.tsx src/pages/Skills/index.tsx src/pages/Cron/index.tsx src/pages/Setup/index.tsx tests/unit/channel-config-modal.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/chat-theme-shell.test.ts tests/unit/chat-input.test.tsx tests/unit/chat-humanized-actions.test.tsx --max-warnings=0`
- `pnpm run typecheck`
- 如果 `build:vite` 报 `./assets/e-*.js from index.html` 这类错误，先检查根 `index.html` 是否被参考产物污染，确认入口仍是 `/src/main.tsx`
- `tests/unit/theme-second-wave-pages.test.ts` 现在同时锁住 `Settings / Providers` 的桌面 pane 语法，改动这两页时要同步维护这条回归锁
- `tests/unit/theme-second-wave-pages.test.ts` 现在也锁住了 `Skills` 浅色主题启用开关的开启态语义，任何把开启态重新改成硬黑色的修改都应视为回归
- `tests/unit/dark-theme-compatibility.test.ts` 现在额外锁住深色主题下最容易漏回去的残留浅色 hardcode：共享 workbench 主按钮、`Settings` 激活态、`ChatSessionsPane` 菜单与 utility、`ExecApprovalOverlay`、`Agents` 搜索/空态、`Skills` 图标壳、`ChannelConfigEditor` 开关和 `SetupCompleteStage` 的 pending 指示器

### 构建级

- `pnpm run build:vite`

## 手工验收

### 1. 浅色基底

1. 肉眼确认主基底已经回到冷中性桌面区间
2. 不再出现暖米色主底
3. 不再出现整页暖色 glow
4. 不再出现厚重 radial/mesh 气氛层
5. `Agents / Skills / Cron` 的头部、列表、详情侧栏与对话框要继续共享同一套冷中性 substrate，而不是各自回到 dashboard/web card

### 2. 壳层质感

1. `TitleBar / Sidebar / Source List / Workspace` 看起来像同一个应用壳层
2. rail 与聊天列表不再像两块拼起来的网页栏
3. `WorkspacePageShell` 不再像“浏览器里的大卡片”
4. 不同页面虽然内容不同，但都能明显看出共享同一套冷中性 desktop substrate

### 3. 控件语法

1. 搜索入口更像轻筛选器/trigger，而不是厚表单
2. source list 更像桌面列表，而不是卡片流
3. 输入区更像桌面编辑坞站，而不是网页表单
4. 桌面壳层要能实际验证 `window-drag-bar / resize handle / workspace tint` 三个结构 hook，而不是只看配色
4. modal / empty / stat panel 也必须共享同一套 desktop substrate
5. hover / active / destructive 默认足够克制
6. `Models` 页 provider 总览在宽窗口下必须连续扩列，不能再被固定断点锁死在 `4` 列以内；卡片最小宽度也必须稳定，不能为了追求更多列把内容压成窄条

### 4. 字体

1. 正文、标题、列表、按钮默认统一为系统无衬线
2. 全局字体栈必须与解包后的 `QClaw` 源码一致，回到单一系统 sans 栈，而不是 `SF Pro Text / SF Pro Display` 双栈猜测
3. serif 标题不再出现在主要工作区
4. 代码/ID 的 monospace 保留且语义合理

### 5. 品牌预算

1. 品牌铜红只出现在主按钮、焦点、激活态、状态点和 logo
2. 大面积列表、背景、面板不再依赖品牌色
3. 如果单页看起来“发热”，视为未通过

### 6. 聊天路径

1. 聊天列表默认单行，不再像双行资料卡
2. 聊天列表默认不展示身份章
3. 会话项 hover / active 更像 source list
4. 聊天消息区、输入区、工具轨统一到同一套桌面语法

### 7. 平台观感

1. mac 下足够轻、静、克制
2. Windows 下边界和分层足够清楚
3. 两端保持同一品牌气质，不分裂成两套产品

## 风险回归点

- 只改页面颜色，却没有改控件语法
- 只改颜色，不改 modal / empty / panel 的圆角、blur、阴影和表单厚度
- 搜索、列表、输入区重新长回厚表单感
- `Channels` 大文件测试在默认 5 秒超时下偶发超时；如果只验证这一页，统一使用 `--testTimeout=15000`，不要把资源抖动误判成回归
- `ChatInput` 的 composer 节奏已经收紧，相关源码断言目前以 `min-h-[82px] / min-h-[68px]` 为准；如果继续调整输入坞站高度，要同步修改 `chat-theme-shell` 里的结构断言
- `chat-layout.test.tsx` 全文件目前仍有若干和本批次无关的旧失败；本轮只验证了新增/修改的两条用例，不能把那些存量噪音误记到这次主题收口上
- `Chat` 当前虽然已经是单滚动层 + footer dock composer，但这仍然只是 `nexu` 结构对齐的一部分；如果继续调标题栏 toggle、工作区正文节奏或 pane 关系，必须同步维护 `chat-layout / chat-theme-shell / workspace-page-layout`
- `pnpm exec eslint` 当前不会处理 `src/styles/globals.css`；如果把 CSS 文件直接塞进命令，会收到 “File ignored because no matching configuration was supplied” 的噪音 warning，不要误判成代码回归
- `ChannelConfigModal` 已继续压平为桌面 modal / pane 语法；如果继续调标题、字段和底部动作，必须同步更新 `channel-config-modal` 的 class 断言
- `Settings / Providers / Channels / Chat / Setup` 这批热点已经证明“只改 token 不够”，后续调整必须同时检查 utility button、badge、picker、log panel 和 inspector 的局部语法
- 品牌色再次滑入背景层
- 浅色主题重新回暖
- 聊天列表、频道页、设置页各自形成新的局部风格
- 某个页面重新长出独立壳层，破坏全局冷中性 substrate
- `Agents / Skills / Cron` 的模态、统计卡和安装/详情侧栏继续回到网页设置中心语法

## 完成标准

只有同时满足以下条件，才允许宣称 `global-theme-refresh` 完成：

1. 浅色/深色都能稳定体现桌面基底，而非网页皮肤
2. 关键壳层和高频工作区的控件语法已统一
3. 字体、边界、hover、active、搜索、列表、输入区都已回到同一桌面语言体系
4. mac / Windows 真机观感已手工确认
