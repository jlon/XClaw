# Setup 引导页重构进度

## 当前状态

- [x] 完成现有 `Setup` 页结构 review
- [x] 明确 `setup-openclaw-takeover` 与 `setup-wizard-refresh` 的边界
- [x] 重写引导页合同，收成 `左轨 + 右单任务面 + 底部单 CTA`
- [ ] 按新合同重构 `SetupShell / SetupStepRail / Start / Preparation`
- [ ] 补新布局的源码级与页面级验证
- [ ] 补 Win/mac 手工验证

## 当前结论

- 之前的 `Setup` 虽然有四阶段和 footer，但页面骨架仍然偏“工程后台”
- 当前真正需要执行的是新的引导页合同，而不是继续微调旧卡片布局
- 旧设计的问题核心不是主题，而是单任务面失败：开始和准备阶段同时承载过多职责
- 下一步代码改造将优先落在：
  - `SetupShell`
  - `SetupStepRail`
  - `SetupStartStage`
  - `SetupPreparationStage`

## 下一步

1. 让默认桌面宽度下稳定进入左右布局，不再只在超大断点才出现左轨
2. 把开始页重写成“路径选择 + 选中摘要”
3. 把准备页重写成“环境就绪确认面”，技术细节下沉
4. 补新的布局与流程验证，再做 Win/mac 手工 smoke

## 本轮已完成

1. `SetupShell` 默认桌面宽度下已切成稳定左右布局，不再只在 `xl` 才出现左轨
2. `SetupStepRail` 已从大按钮卡改成紧凑被动进度轨
3. `SetupStartStage` 已删掉“hero + 二次摘要卡 + 运行卡”的旧结构，收成“路径选择 + 当前选择轻摘要”
4. `SetupPreparationStage` 的 takeover 面已从四张等权重摘要卡收成单一准备面
5. `fresh` 准备页的运行就绪区已从三张并列卡改成紧凑状态行

## 最新验证

- `pnpm exec eslint src/components/setup/SetupShell.tsx src/components/setup/SetupStepRail.tsx src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx tests/unit/setup-wizard-layout.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts --reporter=dot`

结果：

- `eslint` 通过
- `setup-wizard-layout + setup-wizard-flow` 共 `6` 条通过
