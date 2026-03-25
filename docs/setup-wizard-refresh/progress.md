# Setup 引导页重构进度

## 当前状态

- [x] 完成现有 `Setup` 页结构 review
- [x] 明确 `setup-openclaw-takeover` 与 `setup-wizard-refresh` 的边界
- [x] 重写引导页合同，收成 `左轨 + 右单任务面 + 底部单 CTA`
- [x] 按新合同重构 `SetupShell / SetupStepRail / Start / Preparation`
- [x] 补新布局的源码级与页面级验证
- [x] 修复空环境被误判为 takeover 的探测链路
- [x] 修复 `fresh` 非原子激活、fresh 复用旧 workspace、takeover 状态串台
- [x] 修复 Win/mac 默认大小写不敏感文件系统下的路径比较、agent ID 合并与磁盘足迹误判
- [x] 收紧完成阶段：Python 作为核心要求，不允许通过“跳过增强”绕过
- [ ] 补 Win/mac 手工验证

## 当前结论

- 之前的 `Setup` 虽然有四阶段和 footer，但页面骨架仍然偏“工程后台”
- 当前真正需要执行的是新的引导页合同，而不是继续微调旧卡片布局
- 旧设计的问题核心不是主题，而是单任务面失败：开始和准备阶段同时承载过多职责
- `setup-inspection` 之前误用会创建 `~/.openclaw` 的配置读链，导致隔离 fresh 环境也会被错误判成 takeover
- `fresh` 和 `takeover` 真正要先修的是链路语义：路径、状态机、回滚必须先正确，视觉才能成立
- `uv / Python` 之前被做成了“可选增强”的隐式跳过语义，这和“Python 是核心要求”相冲突，必须收回
- `uv:install-all` 与 Gateway 后台自愈之前会并发触发 `uv python install 3.12`，在老机器上会把 CPU / IO / 内存压力同时拉高，必须收成单飞
- 下一步代码改造将优先落在：
  - `SetupProviderStage`
  - `ProviderContent`
  - provider review 的信息预算

## 下一步

1. 继续把 provider 步从“小应用”收成单任务面
2. 把 provider review 的摘要预算再压一层
3. 做 Win/mac 手工 smoke

## 本轮已完成

1. `SetupShell` 默认桌面宽度下已切成稳定左右布局，不再只在 `xl` 才出现左轨
2. `SetupStepRail` 已从大按钮卡改成紧凑被动进度轨
3. `SetupStartStage` 已删掉“hero + 二次摘要卡 + 运行卡”的旧结构，收成“路径选择 + 当前选择轻摘要”
4. `SetupPreparationStage` 的 takeover 面已从四张等权重摘要卡收成单一准备面
5. `fresh` 准备页的运行就绪区已从三张并列卡改成紧凑状态行
6. `ProviderContent` 已改成“左侧选择提供商 + 右侧完成接入”的双面板，不再是小应用式堆叠表单
7. `fresh / takeover` 起始面已经分流：只有检测到本地 OpenClaw 足迹才显示接管选择
8. `provider review` 的导入摘要卡已从四列 dashboard 收成两列桌面摘要面
9. `setup-inspection` 已改成纯只读探测：空的 `.openclaw` 目录和默认 `main` 推导不再触发 takeover
10. 全新隔离 `HOME + userData` 下，`/api/app/setup-inspection` 已实测返回 `hasExistingOpenClaw=false`
11. `fresh` 激活现在会先拍快照：失败时回滚 settings、`openclaw.json` 和新建 workspace
12. `fresh` 现在不能复用当前 OpenClaw 已配置的 workspace 路径
13. inspection 和 takeover import 的智能体发现逻辑已统一为“配置 + 磁盘”
14. `takeover-import` 路由现在只接受 `takeover` 模式
15. setup 前端只有在 `inspection.hasExistingOpenClaw=true` 时才会读取 takeover 状态
16. takeover 运行中禁止回到 start；takeover 完成待复核时禁止切换到 fresh
17. 开始阶段已移除 takeover/fresh 的重复摘要卡，准备阶段成为唯一环境摘要面
18. Setup 主内容滚动层已收敛到 shell main，不再默认依赖内层滚动
19. `fresh` 工作区复用校验已改成文件系统语义：Win 与默认 mac 不再因大小写不同漏检同一路径
20. inspection / takeover import 的 agent ID 合并已改成大小写不敏感去重，避免 `main / Main` 双计数
21. 磁盘足迹探测已忽略 `desktop.ini / Thumbs.db / .DS_Store` 等元数据文件，避免 Windows/mac 假阳性
22. `takeover` 准备页已从摘要卡墙收成“单一准备面 + 轻事实带”，`fresh` 准备页已从“表单块 + 状态块 + 诊断块”压成“配置主面 + 就绪主面”
23. `完成` 阶段新增 `enhancements` 子状态；`uv / Python` 未就绪时，必须先完成核心环境准备，不能直接进入应用
24. `OptionalEnhancementPanel` 现在会在准备完成后再次校验 `uv:status`；若 Python 仍未就绪，不会错误进入最终摘要
25. `takeover` 相关回归已更新为等待核心环境检查完成后再继续，避免测试把异步检查误当成立即可操作状态
26. `setupManagedPython()` 已加全局 single-flight；Setup 显式准备 Python 与 Gateway 后台自愈不再并发执行
27. Setup 未完成时，Gateway 后台已停止偷跑 Python 修复，只在 setup 完成后才允许后台补环境
28. `核心环境准备` 子步骤已改成真正的后台任务状态：主进程会持有运行态、失败态和取消态，不再只有一次性阻塞调用
29. `OptionalEnhancementPanel` 现在会显示可折叠的实时安装日志，并在运行中提供明确的取消按钮，而不是只把动作置灰
30. `setupManagedPython()` 与 `ensureStudioPythonEnv()` 已补 AbortSignal 中断能力；Windows 会用进程树终止，mac/Linux 会走信号终止

## 最新验证

- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/SetupShell.tsx src/components/setup/SetupStepRail.tsx src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx tests/unit/setup-wizard-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint electron/main/setup-inspection.ts tests/unit/setup-inspection.test.ts --max-warnings=0`
- `pnpm exec eslint electron/main/setup-inspection.ts electron/main/takeover-runtime.ts --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-inspection.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts --reporter=dot`
- `pnpm exec vitest run tests/unit/setup-wizard-flow.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-takeover.test.tsx --testTimeout=15000`
- `pnpm exec vitest run tests/unit/uv-setup.test.ts tests/unit/gateway-supervisor.test.ts tests/unit/setup-wizard-flow.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-takeover.test.tsx --testTimeout=15000`
- `curl -s http://127.0.0.1:3210/api/app/setup-inspection`（隔离 `HOME + userData` 实测）
- `corepack pnpm exec eslint electron/main/ipc-handlers.ts electron/main/setup-environment-task.ts electron/preload/index.ts electron/studio/python-env.ts electron/utils/run-child-command.ts electron/utils/uv-setup.ts src/pages/Setup/index.tsx tests/unit/ipc-setup-environment-handlers.test.ts tests/unit/preload-ipc-channels.test.ts tests/unit/setup-takeover.test.tsx`
- `corepack pnpm test tests/unit/preload-ipc-channels.test.ts tests/unit/ipc-setup-environment-handlers.test.ts tests/unit/setup-takeover.test.tsx`
- `corepack pnpm run typecheck`

结果：

- `eslint` 通过
- `setup-inspection + setup-wizard-layout + setup-wizard-flow` 共 `20` 条通过
- `setup-wizard-flow + setup-wizard-layout + setup-takeover` 共 `19` 条通过
- `uv-setup + gateway-supervisor + setup-wizard-flow + setup-wizard-layout + setup-takeover` 共 `27` 条通过
- `setup preload + setup environment IPC + setup-takeover` 共 `19` 条通过
- 隔离环境返回 `hasExistingOpenClaw=false`、`suggestedMode=fresh`
- `setup-inspection / takeover-runtime` 的定向 `eslint` 通过
- 新增 `setup environment` 相关定向 `eslint` 与 `typecheck` 通过

## 本轮说明

- 本轮按用户要求优先直接修复链路，没有先补跑新的回归测试
- 新增修复集中在：
  - `electron/main/setup-inspection.ts`
  - `electron/main/setup-activation.ts`
  - `electron/main/takeover-runtime.ts`
  - `electron/main/takeover-import.ts`
  - `electron/api/routes/app.ts`
  - `src/pages/Setup/index.tsx`
  - `src/components/setup/SetupShell.tsx`
  - `src/components/setup/SetupStartStage.tsx`
