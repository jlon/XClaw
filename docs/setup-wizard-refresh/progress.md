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
- [ ] 补 Win/mac 手工验证

## 当前结论

- 之前的 `Setup` 虽然有四阶段和 footer，但页面骨架仍然偏“工程后台”
- 当前真正需要执行的是新的引导页合同，而不是继续微调旧卡片布局
- 旧设计的问题核心不是主题，而是单任务面失败：开始和准备阶段同时承载过多职责
- `setup-inspection` 之前误用会创建 `~/.openclaw` 的配置读链，导致隔离 fresh 环境也会被错误判成 takeover
- `fresh` 和 `takeover` 真正要先修的是链路语义：路径、状态机、回滚必须先正确，视觉才能成立
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

## 最新验证

- `pnpm exec eslint src/pages/Setup/index.tsx src/components/setup/SetupShell.tsx src/components/setup/SetupStepRail.tsx src/components/setup/SetupStartStage.tsx src/components/setup/SetupPreparationStage.tsx tests/unit/setup-wizard-layout.test.tsx --max-warnings=0`
- `pnpm exec eslint electron/main/setup-inspection.ts tests/unit/setup-inspection.test.ts --max-warnings=0`
- `pnpm exec eslint electron/main/setup-inspection.ts electron/main/takeover-runtime.ts --max-warnings=0`
- `pnpm exec vitest run tests/unit/setup-inspection.test.ts tests/unit/setup-wizard-layout.test.tsx tests/unit/setup-wizard-flow.test.ts --reporter=dot`
- `curl -s http://127.0.0.1:3210/api/app/setup-inspection`（隔离 `HOME + userData` 实测）

结果：

- `eslint` 通过
- `setup-inspection + setup-wizard-layout + setup-wizard-flow` 共 `20` 条通过
- 隔离环境返回 `hasExistingOpenClaw=false`、`suggestedMode=fresh`
- `setup-inspection / takeover-runtime` 的定向 `eslint` 通过

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
