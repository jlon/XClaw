# Setup OpenClaw 全面接管实现计划

> **给执行型 agent 的说明：** 建议按任务顺序逐项实现，并在每个任务完成后更新 `progress.md`。本文档使用 `- [ ]` 复选框跟踪状态。

**目标：** 为已有 OpenClaw 环境引入“确认前只读、确认后全面接管”的启动与迁移流程，并确保 macOS / Windows 双端可发布。

**架构：** 先把主进程首启路径拆成“只读检查模式”和“正常启动模式”，用主进程 bootstrap 状态控制所有启动副作用；再引入 inspection、takeover plan、provider 反向导入和持续回收同步。实现顺序必须先控风险，再补功能面。

**技术栈：** Electron Main Process、React 19、Vite、TypeScript、Vitest、electron-store、OpenClaw 文件配置

---

### 任务 1：建立只读检查模式

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/main/setup-bootstrap.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/main/index.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/utils/store.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/setup-bootstrap.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/progress.md`

- [x] 第 1 步：先写失败测试，覆盖以下行为
  - `setupComplete = true` 时不进入只读模式
  - `setupComplete` 缺失且无 XClaw 既有痕迹时进入只读模式
  - `setupComplete` 缺失但存在 XClaw 既有痕迹时允许正常启动
  - 只读模式下应挂起技能安装、插件安装、workspace context 合并、Gateway 自动启动

- [x] 第 2 步：运行单测，确认测试先失败
  - 运行：`pnpm test tests/unit/setup-bootstrap.test.ts`

- [x] 第 3 步：实现 `setup-bootstrap.ts`
  - 提供 bootstrap 状态解析
  - 提供 legacy XClaw 痕迹判断
  - 提供主进程是否应执行启动副作用的统一判断

- [x] 第 4 步：把 `index.ts` 中现有启动副作用挂到 bootstrap 判断后面

- [x] 第 5 步：扩展主进程 settings，补入 setup 元字段，但保持对老用户的兼容推断

- [x] 第 6 步：再次运行单测，确认通过
  - 运行：`pnpm test tests/unit/setup-bootstrap.test.ts`

- [x] 第 7 步：更新 `progress.md`

### 任务 2：实现 setup inspection 与 takeover plan

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/main/setup-inspection.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/api/routes/app.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/setup-inspection.test.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/app-routes.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/progress.md`

- [x] 第 1 步：先写失败测试，覆盖 inspection 结果和 takeover plan 摘要
- [x] 第 2 步：运行相关测试，确认失败
  - 运行：`pnpm test tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts`
- [x] 第 3 步：实现 inspection 读取逻辑
- [x] 第 4 步：实现 `GET /api/app/setup-inspection` 与 `POST /api/app/setup-plan`
- [x] 第 5 步：再次运行测试，确认通过
- [x] 第 6 步：更新 `progress.md`

### 任务 3：实现 provider 反向导入与默认项恢复

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/services/providers/provider-import.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/services/providers/provider-store.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/services/secrets/secret-store.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/utils/openclaw-auth.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/provider-import.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/progress.md`

- [x] 第 1 步：先写失败测试，覆盖 API Key / OAuth / local / 默认项 / 冲突导入
- [x] 第 2 步：运行测试，确认失败
  - 运行：`pnpm test tests/unit/provider-import.test.ts`
- [x] 第 3 步：实现运行时 provider key -> XClaw account 的映射
- [x] 第 4 步：实现 secret-store 反向导入
- [x] 第 5 步：实现默认 provider 恢复与冲突标记
- [x] 第 6 步：再次运行测试，确认通过
- [x] 第 7 步：更新 `progress.md`

### 任务 4：实现 takeover backup / import / commit / rollback

**文件：**
- 新建：`/Users/jianglong/workspace/XClaw/electron/main/takeover-import.ts`
- 修改：`/Users/jianglong/workspace/XClaw/electron/api/routes/app.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/takeover-import.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/progress.md`

- [x] 第 1 步：先写失败测试，覆盖成功导入、部分失败回滚、外部 Gateway 阻断
- [x] 第 2 步：运行测试，确认失败
  - 运行：`pnpm test tests/unit/takeover-import.test.ts`
- [x] 第 3 步：实现 backup / import / commit / rollback 流程
- [x] 第 4 步：实现外部 Gateway / 并发写入阻断
- [x] 第 5 步：实现 `POST /api/app/takeover-import` 与 `GET /api/app/takeover-status`
- [x] 第 6 步：再次运行测试，确认通过
- [x] 第 7 步：更新 `progress.md`

### 任务 5：实现 setup 条件步骤流与持续回收同步

**文件：**
- 修改：`/Users/jianglong/workspace/XClaw/src/pages/Setup/index.tsx`
- 新建：`/Users/jianglong/workspace/XClaw/src/lib/setup-takeover.ts`
- 新建：`/Users/jianglong/workspace/XClaw/electron/main/takeover-reconciler.ts`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/setup-takeover.test.tsx`
- 测试：`/Users/jianglong/workspace/XClaw/tests/unit/takeover-reconciler.test.ts`
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/progress.md`

- [x] 第 1 步：先写失败测试，覆盖新步骤流、冲突 UI、接管后刷新
- [x] 第 2 步：运行测试，确认失败
  - 运行：`pnpm test tests/unit/setup-takeover.test.tsx tests/unit/takeover-reconciler.test.ts`
- [x] 第 3 步：实现 setup 条件步骤流
- [x] 第 4 步：实现 takeover 后的轻量 fingerprint 检查与增量刷新
- [x] 第 5 步：再次运行测试，确认通过
- [x] 第 6 步：更新 `progress.md`

### 收尾验证

**文件：**
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/testing.md`
- 文档：`/Users/jianglong/workspace/XClaw/docs/setup-openclaw-takeover/progress.md`

- [ ] 运行当前实现涉及的全部单测
  - 运行：`pnpm test`
- [ ] 运行类型检查
  - 运行：`pnpm run typecheck`
- [ ] 如果涉及通信路径改动，运行
  - `pnpm run comms:replay`
  - `pnpm run comms:compare`
- [ ] 更新 `progress.md` 与 `testing.md`
