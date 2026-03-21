# Setup 引导页重构测试

## 目标

确认 `Setup` 在完成结构级重构后，既符合统一品牌主题，也符合标准 mac / Windows 桌面引导页的使用预期。

## 设计阶段验证

- 固定四阶段骨架已写入设计文档
- `fresh / takeover` 共用同一套步骤骨架
- 标准布局明确为“左侧步骤导航 + 右侧内容区 + 底部固定操作栏”
- `takeover` 路径也必须经过完成页
- 左侧步骤导航默认不允许直接跳步
- `完成` 阶段已明确拆成“应用变更中”和“完成摘要”两个子状态
- 完成前关闭窗口不得写入 `setupComplete`
- `complete.applying` 关闭窗口需要二次确认

## 实现阶段必跑验证

### 代码级

- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/*.tsx tests/unit/setup-*.test.ts* --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts tests/unit/setup-takeover.test.tsx`
- `pnpm run typecheck`

### 构建级

- `pnpm run build:vite`

## 手工测试

### 1. fresh 路径

1. 首次进入 `Setup`
2. 选择全新开始
3. 完成工作目录和端口配置
4. 完成 provider 接入
5. 确认经过完成页再进入首页

### 2. takeover 路径

1. 检测到现有 OpenClaw
2. 选择接管
3. 查看导入摘要、冲突和警告
4. 如需 provider review，在“模型与接入”阶段完成
5. 确认最终仍经过完成页

### 3. 高级路径

1. 展开日志和高级诊断
2. 触发 OAuth 主路径
3. 触发 OAuth 手动 code 兜底
4. 验证自定义 provider

### 4. 平台体验

1. mac 下确认壳层更轻、更静
2. Windows 下确认导航和内容区边界清晰
3. 缩放窗口时确认步骤导航、内容区和底部操作栏不乱
4. 在默认窗口宽度下不依赖用户手动拉宽
5. `complete.applying` 中关闭窗口时出现二次确认，确认退出后不会进入首页

## 回归风险

- `takeover` 旧逻辑很容易让完成页再次被绕过
- provider 与 OAuth 状态切换多，容易在拆组件时出现状态断裂
- 如果只改布局不改步骤建模，页面仍会像设置页而不是引导页
- 如果不补退出守卫，用户可能在完成前误关闭窗口并留下半完成状态

## 最新验证

- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts`
- `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx`
- `pnpm exec vitest run tests/unit/setup-takeover.test.tsx`
- `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-takeover.test.tsx`
- `pnpm exec vitest run tests/unit/setup-primary-action.test.ts tests/unit/setup-page-i18n.test.tsx tests/unit/setup-preparation-stage.test.tsx tests/unit/setup-locale.test.ts tests/unit/setup-wizard-flow.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-takeover.test.tsx`
- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/*.tsx src/components/setup/*.ts tests/unit/setup-*.ts tests/unit/setup-*.tsx --max-warnings=0`
- `pnpm run typecheck`
- `pnpm run build:vite`

结果：

- 四阶段模型与壳层测试通过
- `takeover` 11 条回归测试通过
- `Setup` 英文化、locale 覆盖和高级诊断折叠回归已通过
- `setup-primary-action / setup-page-i18n / setup-preparation-stage / setup-locale / setup-wizard-flow / setup-wizard-layout / setup-takeover` 聚合共 22 条测试通过
- `eslint`、`typecheck`、`build:vite` 通过
- 当前自动化层面已无阻塞，剩余只是真机手工 smoke
