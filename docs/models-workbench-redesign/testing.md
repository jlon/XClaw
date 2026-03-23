# 模型工作台重构测试

## 目标

确认 `/models` 从“provider 设置页 + token 报表”重构为“模型工作台”后，以下能力都稳定成立：

- provider 首屏优先，用户进入页面先看到的是 provider 资源入口
- provider 卡片板能按内容容器宽度自适应
- provider 选择、时间窗口和 token 图表存在真实联动
- provider 编辑退出卡片内联展开，改为独立 inspector 模态 / pane
- token 图表与明细在暖色 / 深色主题下都保持可读
- mac / Windows 下布局和交互语义一致

## 必跑验证

### 代码级

- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-charts.test.tsx tests/unit/models-usage-history.test.ts tests/unit/provider-account-form-sections.test.tsx tests/unit/token-usage.test.ts tests/unit/usage-routes.test.ts`
- `pnpm exec vitest run tests/unit/models-charts.test.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-usage-history.test.ts tests/unit/token-usage.test.ts tests/unit/provider-account-form-sections.test.tsx`
- `pnpm exec eslint src/pages/Models/index.tsx src/pages/Models/components/ProviderBoard.tsx src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/ProviderInspectorView.tsx src/pages/Models/components/ProviderInspectorEditor.tsx src/pages/Models/components/UsageMetricToggle.tsx src/pages/Models/components/UsageTrendChart.tsx src/pages/Models/components/UsageBreakdownChart.tsx src/pages/Models/components/UsageRecentRequests.tsx src/pages/Models/components/UsageKpiStrip.tsx src/pages/Models/usage-history.ts src/pages/Models/workbench-layout.ts src/pages/Models/workbench-view-model.ts src/components/settings/providers/ProviderAccountFormSections.tsx src/components/settings/ProvidersSettings.tsx tests/unit/models-charts.test.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-usage-history.test.ts tests/unit/token-usage.test.ts tests/unit/provider-account-form-sections.test.tsx --max-warnings=0`
- `pnpm run typecheck`

### 构建级

- `pnpm run build:vite`

## 建议新增测试

### 1. 页面结构

文件：

- `tests/unit/models-page.test.tsx`
- `tests/unit/models-workbench-render.test.tsx`

覆盖点：

- 页头只保留轻量标题、副标题和主动作
- provider 区先于 token intelligence 渲染
- 首屏不再渲染大号 KPI 卡
- provider 区不再直接渲染旧的纵向 `ProvidersSettings` 页面骨架
- `添加提供商` 打开独立对话框，而不是展开 legacy manager
- 页面默认不再是 provider 表单长页

### 2. Provider 卡片板

文件：

- `tests/unit/models-page.test.tsx`

覆盖点：

- provider 列表按内容容器宽度进入 `1 / 2 / 3 / 4` 列
- 卡片不再存在内联展开整段编辑表单
- 卡片展示默认标记、凭证状态和 usage 摘要
- 选中 provider 后卡片存在明确选中态
- 单击卡片直接进入配置聚焦态，而不是只做过滤

### 3. Provider 与图表联动

文件：

- `tests/unit/models-page.test.tsx`

覆盖点：

- 点击 provider 卡片后，摘要带、图表、明细同步过滤
- 点击 provider 卡片后，默认宽度下完整 Provider Board 折叠为当前 provider 头部
- 只有超宽态保留左侧 provider rail
- 清除 provider 过滤后恢复全局视角
- 从 ranking / 明细点击 provider 也能反向选中卡片
- 从 ranking / 明细点击 provider 后，会同步进入该 provider 的聚焦态

### 4. 时间窗口与主指标切换

文件：

- `tests/unit/models-page.test.tsx`
- `tests/unit/models-usage-history.test.ts`

覆盖点：

- `7d / 30d / all` 会同步影响卡片 usage 摘要和图表数据
- `Tokens / Cost` 切换会同步更新摘要带与图表
- Token Intelligence 顶部稳定包含“摘要带 + 主指标切换 + 时间窗口”这一套 chrome
- 全局态与聚焦态的分组维度切换仍保持正确：全局优先 provider，聚焦后优先 model / request
- 主图默认不再依赖柱顶大号精确数值标签

### 5. Inspector 交互

文件：

- `tests/unit/models-page.test.tsx`

覆盖点：

- 宽屏下选中 provider 后显示常驻 inspector
- 非超宽宽度统一进入居中宽 modal inspector
- 超宽宽度进入常驻 pane inspector
- 保存、设默认、删除动作不破坏当前过滤态和窗口状态
- 共享 provider 表单 section 不再绑死 `ProvidersSettings` 局部状态

### 6. 主题与平台兼容

文件：

- `tests/unit/models-page.test.tsx`

覆盖点：

- 暖色 / 深色主题下主要 surface 不出现写死浅色
- Windows 分支不继承 mac 独有 inset / 标题栏留白逻辑
- 图表色板在深色主题下仍有足够对比度

## 手工测试

### 场景 1：默认进入页面

1. 打开 `/models`
2. 确认首屏先看到的是轻页头、provider 卡片板和 token intelligence
3. 确认 provider 卡片板先于 token intelligence 出现，且首屏没有大号 KPI 卡
4. 确认 provider 卡片板默认最多展示 2 行，主图仍在首屏可见
5. 确认页面不是旧的 provider 长表单
6. 调整窗口大小，确认 provider 卡片列数按内容容器宽度自适应变化

### 场景 2：选择 provider

1. 点击任一 provider 卡片
2. 确认卡片高亮
3. 确认直接进入该 provider 的聚焦态
4. 确认默认宽度下完整 Provider Board 已折叠成当前 provider 头部
5. 确认摘要带、图表、明细同步切换到该 provider
6. 确认 inspector 正确显示当前 provider 配置
7. 在默认宽度、窄宽度、超宽度下分别确认 inspector 切到对应承载形态，且只有超宽态保留左侧 provider rail

### 场景 3：切换时间窗口

1. 分别切到 `7d / 30d / all`
2. 确认 provider 卡片 footer usage 摘要同步变化
3. 确认主趋势图、ranking 和明细数量同步变化

### 场景 4：编辑 provider

1. 选中 provider 并打开编辑区
2. 修改基础配置、回退策略和 API Key
3. 保存
4. 确认卡片摘要和 inspector 内容同步更新
5. 确认 token intelligence 的过滤态没有丢失
6. 确认退出编辑态后仍停留在当前 provider 的查看态

### 场景 5：深色主题

1. 切到深色主题
2. 确认 provider 卡片、图表面板、摘要带、明细区层级清晰
3. 确认图表颜色不糊成一片

## 当前验证缺口

- Windows 真实系统缩放和字体渲染仍需手工 smoke
- 当前共享表单 section 已验证编辑 contract 和旧设置页复用，但仍缺一条 `/models` inspector 编辑态保存的更完整交互断言
- Provider 多账号共享同一 runtime key 时，仍需补一条“聚焦哪个账号”的更明确交互验证
- Add Provider Dialog 仍需一条按 `WU-02 / WU-03` 的手工审视，确认没有重新长回网页 settings 模态
- Add Provider Dialog 仍需实机确认在较小高度窗口下是否会再次出现内部滚动条，但默认桌面窗口下已改成“左网格 + 右 pane”的宽模态，不再走列表向导

## 本轮已完成验证

- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-charts.test.tsx`
- `pnpm exec vitest run tests/unit/models-page.test.tsx -t "browser fallback mode without electron platform bindings"`
- `pnpm exec vitest run tests/unit/models-page.test.tsx -t "lets the inspector switch between accounts that share one runtime provider scope|keeps provider focus stable when historical usage points to an unconfigured provider"`
- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx`
- `pnpm exec eslint src/components/settings/providers/AddProviderDialog.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx`
- `pnpm exec vitest run tests/unit/models-workbench-render.test.tsx tests/unit/models-page.test.tsx`
- `pnpm exec eslint src/pages/Models/components/ProviderBoardCard.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx`
- `pnpm exec eslint src/pages/Models/index.tsx src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/ProviderInspectorView.tsx src/pages/Models/components/ProviderInspectorEditor.tsx tests/unit/models-page.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Models/index.tsx src/pages/Models/components/ProviderBoard.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Models/components/ProviderBoardCard.tsx src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/ProviderInspectorEditor.tsx src/components/settings/providers/ProviderAccountFormSections.tsx src/pages/Models/workbench-view-model.ts tests/unit/models-workbench-render.test.tsx tests/unit/models-page.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/ProviderInspectorView.tsx src/components/settings/providers/ProviderAccountFormSections.tsx src/pages/Models/components/ProviderInspectorEditor.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/provider-account-form-sections.test.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx`
- `pnpm exec vitest run tests/unit/models-charts.test.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx`
- `pnpm exec eslint src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/ProviderInspectorView.tsx src/pages/Models/components/ProviderInspectorEditor.tsx src/components/settings/providers/ProviderAccountFormSections.tsx tests/unit/provider-account-form-sections.test.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Models/index.tsx src/pages/Models/components/UsageKpiStrip.tsx src/pages/Models/components/UsageMetricToggle.tsx src/pages/Models/components/UsageBreakdownChart.tsx src/pages/Models/components/UsageRecentRequests.tsx tests/unit/models-charts.test.tsx tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Models/components/ModelsWorkbenchHeader.tsx src/pages/Models/components/ProviderBoard.tsx src/pages/Models/components/ProviderBoardCard.tsx src/pages/Models/components/ProviderInspector.tsx src/pages/Models/components/ProviderInspectorView.tsx src/pages/Models/components/UsageKpiStrip.tsx src/pages/Models/components/UsageMetricToggle.tsx src/pages/Models/components/UsageTrendChart.tsx src/pages/Models/components/UsageBreakdownChart.tsx src/pages/Models/components/UsageRecentRequests.tsx src/pages/Models/index.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/models-page.test.tsx tests/unit/models-workbench-render.test.tsx tests/unit/models-charts.test.tsx`
- `pnpm run build:vite`
- `pnpm run typecheck`
- 浏览器 fallback 手工验收：`/models` 在无 Electron preload 环境下不再崩溃，空 provider 态能正常显示

## 本轮验证策略调整

- 停止继续堆叠纯样式、纯层级、纯 className 型前端测试
- 仅保留会阻断真实回归的契约测试：
  - 多账号 provider scope 的显式切换
  - 历史 usage 指向失效 provider 的退化路径
  - `/models` 挂载时主动刷新 provider snapshot
  - 浏览器 fallback 不崩
  - 构建可通过
- `typecheck` 当前仍被仓库里无关的 `src/pages/Agents/index.tsx` 存量错误阻塞，本轮未扩散修复那条功能线
