# Setup 引导页重构测试

## 目标

确认 `Setup` 在完成本轮重构后，真正符合“左轨 + 右单任务面 + 底部单 CTA”的桌面引导合同，而不是继续停留在工程后台式流程页。

## 设计阶段验证

- 固定四阶段骨架已写入设计文档
- `fresh / takeover` 共用同一套步骤骨架
- 只有检测到本地 OpenClaw 足迹时才允许显示接管选择
- 空环境不得读取 takeover 状态，也不得被历史 takeover 状态推进阶段
- 默认桌面宽度下必须稳定出现左轨
- 右侧只承载当前一步的单任务工作面
- 底部固定操作栏是唯一主动作入口
- `takeover` 路径也必须经过完成页
- 左侧步骤导航默认不允许直接跳步
- `fresh` 不能复用已配置 OpenClaw workspace
- `takeover-import` 只允许 `takeover` 模式
- `完成` 阶段已明确拆成“应用变更中”和“完成摘要”两个子状态
- 完成前关闭窗口不得写入 `setupComplete`
- `complete.applying` 关闭窗口需要二次确认

## 实现阶段必跑验证

### 代码级

- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/*.tsx tests/unit/setup-*.test.ts* --max-warnings=0`
- `pnpm exec eslint electron/main/setup-inspection.ts tests/unit/setup-inspection.test.ts --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-inspection.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts tests/unit/setup-takeover.test.tsx`
- `pnpm run typecheck`

### 构建级

- `pnpm run build:vite`

## 手工测试

### 1. fresh 路径

1. 首次进入 `Setup`
2. 选择全新开始
3. 确认开始页只看到“路径选择”
4. 确认 `/api/app/setup-inspection` 返回 `hasExistingOpenClaw=false`
5. 进入准备页，只看到目录/端口/环境就绪确认
6. 完成 provider 接入
7. 确认经过完成页再进入首页

补充：

- fresh 路径首步不得出现“接管现有安装 / 从头创建”二选一
- 空的 `.openclaw` 目录、默认工作区路径或隐式 `main` 推导都不得被当成 takeover 足迹
- fresh 失败后不得留下新的 `openclaw.json`、新 workspace 或 takeover 指纹
- fresh 不允许选择当前 OpenClaw 已配置的 workspace
- Win / 默认 mac 大小写差异不得绕过 workspace 冲突校验
- provider 步必须是“左侧选择提供商 + 右侧完成接入”的单任务面

### 2. takeover 路径

1. 检测到现有 OpenClaw
2. 选择接管
3. 确认开始页只看到路径选择与轻摘要，不出现日志/工程事实堆叠
4. 在准备页查看导入摘要、冲突和警告
5. 如需 provider review，在“模型与接入”阶段完成
6. 确认最终仍经过完成页
7. takeover 开始后，不得再切换到 fresh
8. `main / Main` 这类大小写差异不得导致智能体数量或 provider 账号数量双计

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
5. 不允许首步或准备页默认就出现内部滚动条
6. `complete.applying` 中关闭窗口时出现二次确认，确认退出后不会进入首页
7. Windows 的 `desktop.ini / Thumbs.db` 和 mac 的 `.DS_Store` 不得触发 takeover 检测

## 回归风险

- `takeover` 旧逻辑很容易让完成页再次被绕过
- provider 与 OAuth 状态切换多，容易在拆组件时出现状态断裂
- 如果只改布局不改步骤建模，页面仍会像设置页而不是引导页
- 如果不补退出守卫，用户可能在完成前误关闭窗口并留下半完成状态

## 最新验证

- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/SetupShell.tsx src/components/setup/SetupStepRail.tsx src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx tests/unit/setup-wizard-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint electron/main/setup-inspection.ts tests/unit/setup-inspection.test.ts --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-inspection.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts --reporter=dot`

结果：

- `eslint` 通过
- `setup-inspection + setup-wizard-layout + setup-wizard-flow` 共 `20` 条测试通过
