# 频道中心重构测试

## 目标

确认频道页从“列表 + 弹窗”重构为“入口卡片板 + 聚焦编辑态 + 超宽三栏工作台”后，新增、编辑、验证、保存、删除、默认账号、绑定 Agent、高级配置显示都能稳定工作，并且不破坏 Win/mac 可用性、暖色/深色主题兼容性与缩放后的布局稳定性。

## 必跑验证

### 代码级

- `pnpm exec eslint src/components/layout/MainLayout.tsx src/components/layout/WorkspacePage.tsx src/pages/Channels/index.tsx src/pages/Agents/index.tsx src/pages/Cron/index.tsx src/pages/Models/index.tsx src/pages/Settings/index.tsx src/pages/Skills/index.tsx src/lib/channel-registry.ts src/types/channel.ts electron/api/routes/channels.ts electron/utils/channel-config.ts electron/utils/agent-config.ts tests/unit/agent-config.test.ts tests/unit/agents-page.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channel-config-modal.test.tsx tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-locale.test.ts tests/unit/workspace-page-layout.test.tsx tests/e2e/channels.spec.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run --testTimeout=15000 tests/unit/agent-config.test.ts tests/unit/agents-page.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channel-config-modal.test.tsx tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-locale.test.ts tests/unit/workspace-page-layout.test.tsx`
- `pnpm run test:e2e`

### 构建级

- `pnpm run build:vite`

## 当前验证缺口

- 当前仓库已补齐 `pnpm run test:e2e`
- `test:e2e` 当前通过仓库内自管脚本先构建前端，再拉起静态服务执行 smoke
- 现阶段 e2e 仍是浏览器态 Playwright smoke，不是完整 Electron 打包态回归
- 删除账号、默认账号切换、验证失败态等更深路径，暂时仍以单测和手工 smoke 为主
- Win/mac 的真实系统缩放、系统字体差异，仍需要手工确认

## 已完成验证

- 本轮“契约证据修正 + 折叠摘要”收口后，以下命令再次通过：
- `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts`
- `pnpm exec eslint src/pages/Channels/index.tsx src/lib/channel-registry.ts src/types/channel.ts electron/api/routes/channels.ts electron/utils/channel-config.ts tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run build:vite`
- 本轮“modal 主题适配 + 新增账号自动回落 + e2e 基础设施”收口后，新增以下验证：
- `pnpm exec vitest run tests/unit/channel-config-modal.test.tsx tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts`
- `pnpm run test:e2e`
- 本轮“默认轻量加载 + 全局留白收敛 + 文案人话化”收口后，新增以下验证：
- `pnpm exec vitest run tests/unit/channel-config-modal.test.tsx tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-locale.test.ts`
- `pnpm exec eslint src/pages/Channels/index.tsx src/components/layout/MainLayout.tsx src/lib/channel-registry.ts src/types/channel.ts electron/api/routes/channels.ts electron/utils/channel-config.ts tests/unit/channel-config-modal.test.tsx tests/unit/channel-config.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-locale.test.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run build:vite`
- `pnpm run test:e2e`
- 本轮“共享壳层统一 + 滚动条弱化 + 按钮层级收敛 + 说明文案减负”收口后，再次通过：
- `pnpm exec eslint src/components/layout/MainLayout.tsx src/components/layout/WorkspacePage.tsx src/pages/Channels/index.tsx src/pages/Agents/index.tsx src/pages/Cron/index.tsx src/pages/Models/index.tsx src/pages/Settings/index.tsx src/pages/Skills/index.tsx tests/unit/channels-page.test.tsx tests/unit/workspace-page-layout.test.tsx --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run --testTimeout=15000 tests/unit/agents-page.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channel-config.test.ts tests/unit/channel-config-modal.test.tsx tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-locale.test.ts tests/unit/workspace-page-layout.test.tsx`
- `pnpm run build:vite`
- `pnpm run test:e2e`
- 本轮“账号标识真实 rename + 状态摘要人话化 + 右栏紧凑对齐”收口后，再次通过：
- `pnpm exec eslint src/pages/Channels/index.tsx electron/utils/channel-config.ts electron/utils/agent-config.ts electron/api/routes/channels.ts tests/unit/channel-config.test.ts tests/unit/agent-config.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-page.test.tsx tests/e2e/channels.spec.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/channel-config.test.ts tests/unit/agent-config.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-page.test.tsx`
- `pnpm exec vitest run --testTimeout=15000 tests/unit/agent-config.test.ts tests/unit/agents-page.test.tsx tests/unit/chat-layout.test.tsx tests/unit/channel-config.test.ts tests/unit/channel-config-modal.test.tsx tests/unit/channels-page.test.tsx tests/unit/channel-registry.test.ts tests/unit/channel-routes.test.ts tests/unit/runtime-refresh-routes.test.ts tests/unit/channels-locale.test.ts tests/unit/workspace-page-layout.test.tsx`
- `pnpm run build:vite`
- `pnpm run test:e2e`
- 本轮“左栏绿点语义修正 + 基础配置单列压缩”收口后，再次通过：
- `pnpm exec eslint src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx`
- `pnpm run test:e2e`
- 本轮“共享 Select 替换原生下拉 + 中栏头部动作区收紧”收口后，再次通过：
- `pnpm exec eslint src/components/ui/select.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx tests/e2e/channels.spec.ts --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx`
- `pnpm run build:vite`
- `pnpm run test:e2e -- tests/e2e/channels.spec.ts`
- 本轮“分段式响应布局”收口后，再次通过：
- `pnpm exec eslint src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm run typecheck`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx -t "uses theme-compatible surfaces|uses a staged responsive workbench|uses subtle page scrollbars"`
- `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx`
- `pnpm run build:vite`
- 本轮“默认入口卡片板 + 渠道说明文案 + 搜索状态拆分”收口后，再次通过：
- `pnpm exec eslint src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx tests/unit/channel-center-layout.test.ts`
- `pnpm run build:vite`
- 本轮“聚焦编辑态 + 极简入口板收口”后，再次通过：
- `pnpm exec eslint src/pages/Channels/index.tsx src/components/channels/ChannelEntryBoard.tsx src/components/channels/ChannelFocusWorkspace.tsx src/components/channels/ChannelAccountList.tsx src/components/channels/ChannelConfigEditor.tsx tests/unit/channels-page.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx`

## 建议新增测试

### 单元测试

#### 1. schema 分层

文件：

- `tests/unit/channel-registry.test.ts`

覆盖点：

- 每个 v1 字段都声明真实 OpenClaw 路径或动作路由
- 每个字段都声明读写策略
- 每个字段都声明 `evidenceLevel`
- 基础字段、通用高级、渠道专属高级正确分层
- 当前工作台已展示的插件参数字段必须声明可读回策略，不能继续标成 `upstream-plugin-only`
- 同一字段不会同时出现在多个分组
- 不支持的字段不会在错误渠道显示

#### 2. 编辑器状态

文件：

- `tests/unit/channels-page.test.tsx`

覆盖点：

- 左栏切换渠道后，中栏和右栏正确联动
- 中栏切换账号后，右栏回填对应配置
- 折叠高级区会直接显示当前关键值摘要，空值时才退回数量文案
- 编辑器有未保存修改时，切换频道必须先弹确认，确认后才允许覆盖本地输入
- 主题相关高频 surface 不再依赖固定暖色 hex，而是使用兼容暖色 / 深色主题的样式
- 保存成功后会重新回读 editor-values，立即展示服务端标准化后的最终值
- modal 主题 surface 不再依赖固定暖色 hex
- 新增账号保存后，页面会自动切到新账号
- 右栏字段可按 label 稳定定位，避免自动化依赖 placeholder 或 DOM 猜测
- 首屏加载默认不主动 probe，只有手动刷新才请求 `?probe=1`
- 页面壳层会更充分使用宽屏空间，不再固定卡死在较窄的 `max-width`
- 主要工作区页面统一挂到共享壳层，避免全局留白策略再次分叉
- `MainLayout` 主内容区由容器接管滚动，不再默认让页面自己叠一层大外边距滚动
- 频道页工作区遵守“默认入口卡片板、选中后聚焦编辑、超宽三栏”的分段式规则，不再在标准窗口下硬挤两栏工作台
- 聚焦编辑态需要显式展示“返回全部频道”，并在未保存修改时拦截返回入口板
- 首屏入口板不再重复渲染第二组大标题和说明，默认窗口应保持极简首屏密度
- 入口板卡片摘要只显示渠道级说明与聚合状态，不泄露默认账号 ID 等账号级细节
- 从入口板筛选后进入频道时，工作台左栏不会继承旧搜索条件
- 左栏插件角标不会继续挤压频道卡片
- 新增账号进入空白编辑态
- 删除账号后，选中态正确回退
- 中文主文案不会回退成“绑定对象”“ID:”这类实现视角表达
- 页面主滚动与右栏内部滚动都采用弱化滚动条策略，并区分 mac / Windows
- 页面中只保留一个强主动作，其余按钮不再全部刷成主色
- 页面内不再出现原生 `<select>`，负责 Agent 与访问控制统一走共享自定义 Select
- 中栏头部动作区保持紧凑单行分组，不再在右上角松散换行

### 端到端 smoke

文件：

- `tests/e2e/channels.spec.ts`

覆盖点：

- 浅色主题下，频道页可以保存并立即回显服务端标准化值
- 浅色主题下，新增账号后会自动切到刚保存的账号
- 深色主题下，频道页与新增账号 modal 可正常打开
- 频道页中的 Agent / 策略下拉不再回落到浏览器原生 `<select>`，并能正常打开共享样式的选项面板

#### 3. 持久化兼容

文件：

- `tests/unit/channel-config.test.ts`

覆盖点：

- 旧配置仍能被正确回填
- 默认账号、渠道启停、绑定 Agent 等通用行为不丢失
- Telegram `allowedUsers <-> allowFrom` 继续按现有规则转换
- Feishu / WeCom `dmPolicy` 继续按现有规则清洗
- 若新增结构化高级字段，必须新增 round-trip 用例

## 手工测试

### 场景 1：首次进入频道页

1. 打开频道页
2. 确认首屏展示的是频道入口卡片板，而不是默认直接进入编辑工作台
3. 确认页面不会自动弹出旧 modal
4. 确认默认窗口宽度下可稳定展示 `3-4` 张频道卡片并排，而不是只剩一列长条
5. 确认默认不会自动钻进任一频道编辑态
6. 在浅色 / 深色主题下确认搜索框、卡片选中态、配置区层次一致
7. 放大窗口或调高系统缩放后，确认左右留白合理，卡片会先缩放和减列，而不是提前硬切三栏
8. 继续放大到超宽后，确认只有在存在选中上下文时才展开为三栏，且三栏都保持可读宽度
9. 确认状态摘要明确显示连接状态，而不是只剩彩点
10. 确认右栏字段可被 label 聚焦，而不是只能依赖 placeholder 点击

### 场景 2：新增渠道与账号

1. 在入口卡片板点击任一未配置频道的 `配置`
2. 进入对应频道的聚焦编辑态
3. 在配置区填写基础配置
4. 保存
5. 确认当前频道出现账号列表
6. 再新增第二个账号
7. 确认保存后页面直接切到新账号，而不是仍停留在旧账号
8. 确认账号列表能自然切换两个账号

### 场景 2.2：编辑已有账号标识

1. 打开任一已配置账号
2. 直接在右栏“账号标识”输入框里修改账号 ID
3. 点击保存
4. 确认账号列表切换到新账号 ID，旧账号 ID 消失
5. 如果原账号是默认账号，确认默认标识仍在新账号上
6. 如果原账号已绑定 Agent，确认“负责 Agent”不丢失

### 场景 2.1：未保存修改保护

1. 打开任一已配置频道账号
2. 在右栏修改一个字段，但不要保存
3. 点击另一个频道或账号
4. 确认页面先弹出“放弃修改并切换”确认框
5. 点击取消，确认当前编辑目标和输入仍保留
6. 再次切换并确认放弃，确认新目标配置被正确载入
7. 保存后确认页面会重新回显服务端标准化后的最终值

### 场景 3：通用高级配置

1. 打开任一支持高级项的渠道账号
2. 操作渠道启停、默认账号、Agent 绑定
3. 保存或立即触发相应动作
4. 刷新页面
5. 确认状态正确保留

### 场景 4：渠道专属高级配置与插件参数

#### Feishu / WeCom

1. 在未展开高级区前，先确认摘要直接可见
1. 展开访问策略分组
2. 修改 `dmPolicy`、`groupPolicy`
4. 保存
5. 重进页面确认回填正确

5. 确认插件源码支持的结构化字段已进入“插件参数”分组，且可正确回填

#### DingTalk

1. 在未展开高级区前，确认“应用标识”等折叠分组已显示当前摘要
1. 修改 `robotCode`、`corpId`、`agentId`
2. 保存
3. 确认配置回填和运行态不异常

#### QQ Bot

1. 确认 `markdownSupport`、`dmPolicy`、`allowFrom` 等插件参数出现在专属分组
2. 确认默认值展示正确，例如 `markdownSupport=true`

### 场景 5：验证与错误态

1. 填入错误凭证
2. 点击验证
3. 确认右栏显示明确错误
4. 修正配置再次验证
5. 保存后确认状态恢复

### 场景 6：删除与默认账号切换

1. 设定某账号为默认
2. 删除非默认账号
3. 确认默认账号不被误改
4. 删除默认账号
5. 确认页面有合理回退和提示

## 跨平台检查

### macOS

- 三栏高度与滚动区无明显抖动
- 默认窗口大小打开频道页时，右栏不会在未手动放大的前提下被直接截断
- 粘性操作区不遮挡表单
- 下拉、折叠、滚动条视觉与现有页面协调
- 自定义下拉展开后不回退成系统原生菜单，箭头和触发器文字保持对齐
- split-pane 三栏 section 不再像三张 dashboard 卡片，页头、搜索、列表项都更接近桌面 pane/source-list 语法

### Windows

- 默认窗口大小打开频道页时，右栏不会在未手动放大的前提下被直接截断
- 三栏布局在非 overlay scrollbar 环境下不挤压内容
- 滚动条宽度与 hover 表现可接受
- 输入框、下拉、折叠区在系统字体差异下不破版
- 自定义下拉触发器高度、箭头位置和选中态在系统字体缩放下不漂移
- 页头、rail、account list、右栏 editor 在系统字体差异下仍保持同一套 pane 语法，不会重新长回网页卡片感

## 回归风险

- 旧 `ChannelConfigModal` 兼容路径失效
- 多账号保存后默认账号错乱
- Agent 绑定入口迁移后状态不同步
- 字段契约表遗漏导致 UI 与 OpenClaw 配置漂移
- 未建立回填链路的高级字段被提前展示

## 通过标准

- 页面主流程不再依赖旧 modal
- 新增 / 编辑 / 验证 / 保存 / 删除 / 默认账号 / Agent 绑定全在工作台内可完成
- 高级配置分层清晰，支持的字段能正确回填与保存
- `pnpm run build:vite`、`pnpm run typecheck`、相关单测、`pnpm run test:e2e` 全部通过
- mac 与 Windows 手工检查不出现明显交互退化

## 最近一次验证

2026-03-22 频道中心“桌面化清理”验证结果：

- `pnpm exec eslint src/pages/Channels/index.tsx src/components/channels/ChannelEntryBoard.tsx src/components/channels/ChannelEntryCard.tsx src/components/channels/ChannelFocusWorkspace.tsx src/components/channels/ChannelAccountList.tsx src/components/channels/ChannelConfigEditor.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx`
- `pnpm run build:vite`
- `pnpm run typecheck`

结果：

- 上述命令全部通过
- `build:vite` 仍有既有 chunk size / dynamic import 提示，但不是本轮频道中心改动引入的新失败

2026-03-22 频道中心“review 闭环”验证结果：

- `pnpm exec vitest run tests/unit/workspace-page-layout.test.tsx -t "desktop shell chrome on theme tokens"`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx -t "theme-compatible surfaces|glossy desktop-web shadows|inspector rows"`
- `pnpm exec eslint src/components/channels/ChannelEntryCard.tsx src/components/channels/ChannelFocusWorkspace.tsx src/components/channels/ChannelAccountList.tsx src/components/channels/ChannelConfigEditor.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx tests/unit/workspace-page-layout.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/channels-page.test.tsx tests/unit/workspace-page-layout.test.tsx`
- `pnpm run build:vite`
- `pnpm run typecheck`

结果：

- review 中指出的 3 条问题已分别有回归约束：全局 shell token 化、频道卡片去 glossy shadow、右栏 inspector row 化
- `43/43` 相关单测通过
- `build:vite` 通过
- `typecheck` 通过
- `build:vite` 仍保留既有 chunk size / dynamic import 提示，不属于本轮新增失败
