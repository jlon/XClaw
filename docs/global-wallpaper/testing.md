# 全局壁纸测试

## 目标

- 验证整窗壁纸能被稳定导入、显示、关闭和清除
- 验证主壳层在壁纸模式下仍保持可读性和结构稳定

## 单元与静态验证

- `pnpm run typecheck`
- 与设置页、主壳层相关的单测

## 已执行结果

- `pnpm test tests/unit/app-routes.test.ts tests/unit/global-wallpaper-layout.test.tsx`
- `pnpm test tests/unit/settings-layout.test.tsx`
- `pnpm test tests/unit/global-wallpaper-layout.test.tsx tests/unit/global-wallpaper-material-contract.test.ts`
- `pnpm test tests/unit/global-titlebar-utilities.test.tsx tests/unit/sidebar-chrome-surfaces.test.tsx tests/unit/workspace-page-layout.test.tsx`
- `pnpm test tests/unit/chat-theme-shell.test.ts tests/unit/chat-message.test.tsx tests/unit/global-wallpaper-material-contract.test.ts`
- `pnpm test tests/unit/chat-layout.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/global-titlebar-utilities.test.tsx tests/unit/workspace-page-layout.test.tsx`
- `pnpm test tests/unit/global-wallpaper-layout.test.tsx tests/unit/global-wallpaper-material-contract.test.ts tests/unit/global-titlebar-utilities.test.tsx tests/unit/sidebar-chrome-surfaces.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-message.test.tsx`
- `pnpm test tests/unit/global-wallpaper-layout.test.tsx tests/unit/global-wallpaper-material-contract.test.ts tests/unit/global-titlebar-utilities.test.tsx tests/unit/sidebar-chrome-surfaces.test.tsx tests/unit/workspace-page-layout.test.tsx tests/unit/chat-theme-shell.test.ts tests/unit/chat-message.test.tsx tests/unit/chat-layout.test.tsx`
- `pnpm test tests/unit/settings-layout.test.tsx`
- `pnpm test tests/unit/channels-page.test.tsx --testNamePattern="renders entry cards with icon, action, summary, and breathing indicator|uses theme-compatible surfaces instead of fixed warm-only fills"`
- `pnpm test tests/unit/agents-workbench-layout.test.tsx --testNamePattern="renders adaptive my-agents browse mode with a separate detail workbench"`
- `pnpm test tests/unit/models-workbench-render.test.tsx --testNamePattern="consumes workbench contracts in the production models page and follows the provider-first shell"`
- `pnpm test tests/unit/skills-page-layout.test.tsx --testNamePattern="renders a qclaw-style desktop skills center with local search and card grid"`
- `pnpm test tests/unit/cron-agent-targeting.test.tsx --testNamePattern="uses wallpaper-aware surfaces for cron cards and dialog inputs"`
- `pnpm run typecheck`
- 真实 Electron 窗口截图验收 1 轮（聊天页，开启壁纸）

以上命令已通过。

## 本轮额外验证结论

- 已确认 `MainLayout` 改为单一 `shell material layer`，不再依赖分离的标题栏/侧栏背板
- 已确认 mac 标题栏不再使用独立 `window-drag-bar` 覆盖层，右上角工具按钮具备 `no-drag` 语义
- 已确认标题栏、侧栏、工作区共享同一套桌面壳层材质 token
- 已在真实 Electron 窗口中检查聊天页：侧栏、标题栏、消息区和 composer 均能透出同一张整窗壁纸，未见明显顶底分层断带
- 已在真实 Electron 窗口中检查设置页侧栏底部 `设置` 入口：上方硬分隔线已消失，utility 区不再穿出突兀横线
- 已通过静态契约验证聊天页新材质：`app-chat-main-stage` 存在独立阅读底板，assistant bubble 已改为文档流，composer 改为聊天专属玻璃 token
- 已通过聊天布局回归验证新头部职责：`chat-titlebar-session-slot` 仅承载会话控制，品牌与搜索保留在侧栏 pane 顶部，焦点模式下仅保留标题栏显隐切换
- 已通过设置页回归验证：`网关` 与 `更新` 分区内部新增语义化 surface contract，不再依赖私有 `bg-[hsl(...)]` 面板背景
- 已通过工作台回归验证：`Models / Agents / Channels / Skills / Cron` 的主卡片、主 pane 与核心检索控件已补齐共享 surface contract
- 已通过工作台次级 surface 回归验证：频道账号行、Agent 人格文件空状态、模型卡片 badge、技能页 tab shell 与 provider 搜索结果卡片已补齐共享 surface contract
- 模型页、设置页、Studio 页仍建议继续做抽样肉眼检查，避免页面私有表面重新引入硬底

## 手工验证

### 基础链路

1. 打开 `Settings > Appearance`
2. 上传一张本地图片
3. 确认聊天页、模型页、设置页、工作台都能看到同一张整窗壁纸
4. 确认左侧栏和顶部标题栏也能透出壁纸

### 状态切换

1. 上传壁纸后关闭壁纸开关
2. 确认界面回到默认壳层
3. 再次开启，确认仍能恢复同一张壁纸
4. 点击清除，确认壁纸被彻底移除

### 透明度

1. 上传壁纸后拖动透明度滑杆
2. 确认壁纸透出强度变化
3. 确认正文、侧栏、标题栏文字仍可读

### 回退

1. 上传壁纸后，手动删除 `userData/wallpaper/` 中的受控文件
2. 重启应用
3. 确认应用自动回退到无壁纸状态，不出现坏背景

## 回归关注

- 主壳层圆角与分隔线不要丢
- macOS vibrancy 与现有背景材质不要互相覆盖错位
- Studio 与聊天页不应各自重复铺背景
- 聊天页不能把工作台 pane glass 直接复用到消息正文，否则会重新引入暖色污染和整块脏雾感
- 聊天侧栏头部不能再次拆回 titlebar 和 pane 两层，否则左上角会重新出现结构割裂
- 品牌锁定点不能再被抬到 traffic lights 所在的标题栏行，否则会立刻产生格式错乱
- 次级中性 badge、row 和 empty state 不应重新落回页面私有 `bg-[hsl(...)]`，否则会再次出现“主面统一、局部掉队”的观感断层

## 本轮验证命令

- `pnpm test tests/unit/channels-page.test.tsx --testNamePattern="enters a channel when clicking the card action or the card itself"`
- `pnpm test tests/unit/agents-workbench-layout.test.tsx --testNamePattern="keeps the current detail tab when switching between local agent cards"`
- `pnpm test tests/unit/models-workbench-render.test.tsx --testNamePattern="consumes workbench contracts in the production models page and follows the provider-first shell"`
- `pnpm test tests/unit/skills-page-layout.test.tsx --testNamePattern="renders a qclaw-style desktop skills center with local search and card grid|loads top 50 provider results by default and filters out already installed skills"`
- `pnpm run typecheck`
