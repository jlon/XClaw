# 测试方案

## 范围

本方案覆盖 setup 入口步骤中的以下能力：

- 检测本地是否已有 OpenClaw
- 提供“全面接管 / 新建”分流
- 在用户确认前保持只读检查模式
- 校验新建模式下的工作区与端口参数
- 校验全面接管模式下的边界提示、状态导入与持续同步
- 强制覆盖 macOS 与 Windows 双平台验收

## 单元测试

### Setup inspection 工具

- 当 `~/.openclaw` 不存在时，返回 `hasExistingOpenClaw = false`
- 当 `openclaw.json` 存在时，识别为已有安装
- 当配置中存在默认 workspace 时，正确提取并规范化路径
- 当配置缺失或损坏时，回退到 `~/.openclaw/workspace`
- 正确统计 agents/providers/channels/skills 数量
- 配置解析失败时不崩溃，并返回错误摘要
- 正确报告端口是否可用
- 当目标端口被占用时，返回建议的可用端口
- 当 takeover 端口被占用时，即使无法确认外部 Gateway 握手也会阻断
- inspection 默认实现只有在收到协议级 `connect.challenge` 时才把目标端口识别为可复用外部 Gateway
- 当 provider 仅存在于 OpenClaw 运行时而不存在于 XClaw store 时，返回“可导入”的状态
- 能读取 `auth-profiles.json` 并识别 `api_key` / `oauth` / `local`
- 能识别默认 provider 来源
- 能识别多 agent 认证冲突
- 能识别 takeover 时外部 Gateway 是否仍在运行
- 能识别关键配置文件在短时间内是否发生持续变化
- 当应用处于 setup 未决状态时，返回“禁止启动写入型初始化任务”的标记

### App route 测试

- `GET /api/app/setup-inspection` 返回检测结果
- `POST /api/app/setup-plan` 返回 takeover plan
- `POST /api/app/takeover-import` 正确执行备份、导入和提交
- `POST /api/app/takeover-import` 会同步 `gatewayPort / gatewayToken`
- `GET /api/app/takeover-status` 返回 takeover 的最新进度
- `POST /api/app/setup-activation` 在当前会话补跑关键启动副作用
- `POST /api/app/setup-activation` 在 `gatewayAutoStart=true` 时，如果 Gateway 自动启动失败，不会继续错误写入 `setupComplete=true`
- `POST /api/app/setup-activation` 在 `takeover` 模式下要求 takeover import 已完成或已有 `takeoverFingerprint`
- 新建模式会持久化 `gatewayPort`
- 新建模式会将默认 workspace 写入配置
- 接管模式不会覆盖现有 workspace 配置
- 接管模式会在当前会话复用 store 中的 `gatewayPort`，但不会重写 fresh 分支的 workspace / port 选择
- 退出 app 时，如果当前连接的是外部 Gateway，只会断开 XClaw 自己的连接，不会主动 `shutdown` 外部 Gateway
- 支持通过 `CLAWX_USER_DATA_DIR` 覆盖 `userData`，以便在隔离环境中验证首次接管
- 接管模式在确认前不会触发技能安装、插件安装、context 合并和 gateway 自动启动
- 接管确认后会导入 provider 账户、默认项和 secret-store
- 接管失败时会恢复 XClaw 本地 store，不会错误标记 setup 完成
- takeover 备份会对敏感 token / apiKey 做脱敏后再写盘

### Setup store / UI 测试

- setup 入口步骤能渲染 loading 状态
- 存在现有安装时渲染接管选择
- 存在现有安装时渲染“会复用 / 会追加 / 可能需重绑”的边界提示
- 能渲染 takeover plan 摘要，包括 provider 数量、默认项、冲突数
- 新建模式下非法端口会被校验拦截
- 端口被占用时显示冲突提示
- 必填项未完成时，“继续”按钮保持禁用
- 接管模式下如果存在冲突 provider，UI 明确标记该状态
- 接管成功后如导入完整，Provider 步骤自动跳过或进入 provider review
- takeover 进行中会轮询 `GET /api/app/takeover-status` 并显示中间步骤
- setup 最终完成前会调用 `POST /api/app/setup-activation`
- 显式 setup 完成过程中，如果 `gatewayAutoStart=true` 且 Gateway 启动失败，UI 不应继续进入主界面
- 外部 Gateway 未停止时，UI 给出明确阻断提示，而不是继续执行 takeover

### 路径与指纹测试

- Windows 路径会统一盘符大小写、分隔符和尾部斜杠
- `~` 路径会在检测、bootstrap 与 workspace context 逻辑中统一展开
- 相同 workspace 的 Windows 变体路径不会生成不同的 takeover fingerprint

## 集成测试

- 首次启动且存在 `openclaw.json` 时显示接管提示
- 首次启动且不存在本地配置时显示新建表单
- setup 中修改 gateway 端口后，runtime 检查使用新端口
- setup 完成后，`setupComplete` 持久化不再只依赖 renderer 本地状态
- setup 完成后的当前会话会补跑 gateway 自动启动、workspace context 合并与 CLI 安装
- setup 正常完成后，后续启动不应再次自动进入 setup 页；但启动期 side effects 允许再次执行
- setup 未确认前，现有 `~/.openclaw` 的 `skills/`、`extensions/`、workspace 文件和 `openclaw.json` 都不应发生变化
- takeover 导入完成后，`settings.gatewayPort / settings.gatewayToken` 应与 `~/.openclaw/openclaw.json` 中的 `gateway.port / gateway.auth.token` 对齐
- 首次接管的隔离 E2E 中，第一次启动应落成 `readonly=true`，完成接管后第二次启动应落成 `readonly=false`
- 若 activation 阶段 Gateway 自动启动失败，不应写入 `setupComplete=true`
- 接管确认后，聊天、Agent、Channel、Skills、Provider Settings 页面应能基于现有 OpenClaw 正常工作
- 接管完成后，默认 provider 与 OpenClaw 中默认模型前缀一致
- 接管完成后，退出重启应用不应再次进入 setup
- 接管完成后，外部修改 OpenClaw provider 配置，再次启动时 XClaw 能刷新派生状态
- Gateway 健康检查优先走 `system.health` round-trip；若目标 Gateway 不支持该 RPC，会稳定降级到 WebSocket liveness，而不是直接误判故障
- Gateway 连续 3 次 health 失败后，应进入 `error` 并触发 reconnect，而不是长期停留在“socket 还在、但服务失活”的假健康状态
- 如果连续 health 失败的是 XClaw 自己管理的 Gateway 子进程，应先终止该子进程，再重新启动；不能重新附着回同一个已失活实例

## 手工测试

### 已有安装路径

1. 准备一个真实的 `~/.openclaw/openclaw.json`，包含 provider 和 workspace 内容
2. 在没有 setup 完成状态的情况下启动 XClaw
3. 确认出现接管提示
4. 选择接管
5. 验证 provider 和 workspace 配置未被改写
6. 验证在点击“确认接管”之前，`skills/`、`extensions/` 和 workspace 文件没有被 XClaw 追加内容
7. 验证接管后 Chat、Agents、Channels、Skills 页面都能使用现有环境
8. 验证 Provider Settings 能看到已导入账户、默认项和认证状态
9. 验证 takeover 完成后当前会话无需重启也会补跑 gateway / CLI / context merge
10. 重启应用，确认不再进入 setup
11. 验证 `settings.gatewayPort / settings.gatewayToken` 与 `~/.openclaw/openclaw.json` 对齐
12. 验证 Gateway 最终能完成握手并进入 `running`

### 已有安装但存在 Provider 断层

1. 准备一个已有可运行 Provider 的 OpenClaw 环境
2. 清空 XClaw 自己的 provider store
3. 启动 XClaw 并选择接管
4. 验证页面不会错误显示“完全未配置”
5. 验证应直接看到已导入的 provider 账户，而不是依赖手动补录

### 已有安装但存在多 Agent 认证冲突

1. 为同一 provider 准备两个不同 agent 的不同认证
2. 启动 XClaw 并选择接管
3. 验证 takeover plan 明确展示冲突
4. 验证接管后进入 provider 修正步骤或展示冲突处理入口

### 接管时存在外部 Gateway

1. 启动一个使用当前 `~/.openclaw` 的外部 Gateway
2. 启动 XClaw 并选择接管
3. 验证 setup inspection / setup plan 会识别该 Gateway 为可复用实例，而不是直接阻断 takeover
4. 验证 takeover 完成后，当前会话会附着到该 Gateway，并保持 `gatewayPort / gatewayToken` 对齐
5. 验证退出 XClaw 时只 detach，不会顺手关闭该外部 Gateway

### 接管回滚路径

1. 在导入阶段人为制造 provider store 写入失败
2. 验证 setup 不会被标记为完成
3. 验证 XClaw 本地 store 回滚成功
4. 验证现有 OpenClaw 环境未被留下半迁移状态

### 新建路径

1. 删除或隔离现有 `~/.openclaw` 状态
2. 启动 XClaw
3. 选择自定义 workspace 路径
4. 选择一个空闲的非默认端口
5. 继续 setup，确认 runtime/gateway 检查使用所选端口
6. 验证 setup 完成后的当前会话也会补跑关键启动副作用

### 端口冲突路径

1. 用测试进程占用默认端口
2. 启动 XClaw 首次 setup
3. 确认在 runtime 检查之前就显示冲突状态
4. 接受建议端口
5. 验证 setup 能继续完成

### takeover 备份脱敏路径

1. 准备包含 API key / OAuth token 的 OpenClaw 环境
2. 执行 takeover
3. 打开 `userData/takeover-backups/` 下最新备份
4. 验证结构仍可读，但 token / apiKey / access / refresh 已脱敏，不是明文

### 平台矩阵

#### macOS

- 验证 `homedir()/.openclaw` 识别正确
- 验证 `CLAWX_USER_DATA_DIR` 能正确隔离 Electron `userData`
- 验证端口被占用但不是 Gateway 时，takeover 仍会阻断
- 验证工作区路径支持 `~/...` 展开
- 验证 setup 完成后的当前会话激活稳定
- 验证回滚后重启应用仍能正常读取原环境

#### Windows

- 验证 `%USERPROFILE%\\.openclaw` 识别正确
- 验证端口被占用但不是 Gateway 时，takeover 仍会阻断
- 验证工作区路径支持盘符路径，非法保留名和无权限路径会被拦截
- 验证路径规范化不会因为盘符大小写或分隔符不同生成重复 workspace
- 验证当前会话激活不会因为慢 I/O 或安全软件干扰失效
- 验证 Defender / 慢 I/O 条件下导入回滚与备份脱敏仍然稳定

## 回归检查

- 普通老用户不应被强制重新进入 setup，除非当前确实只剩 legacy footprint 且没有明确完成状态
- 现有 provider 保存和更新行为不应变化
- setup 完成后 gateway 自动启动仍应正常工作
- workspace bootstrap 文件的上下文合并逻辑仍应基于配置中的 workspace
- workspace 路径规范化后，不应因为盘符大小写、分隔符或尾部斜杠差异生成重复 workspace
- setup 未决状态不会偷偷触发原有的启动写入流程
- macOS 与 Windows 下首次打开 app 都不会因为 setup 检测导致明显卡顿
- 全面接管完成后，XClaw 本地 provider store 与 OpenClaw 运行时状态保持一致
- macOS 与 Windows 任一端未通过时，功能不能视为可发布

## 需要执行的命令

至少执行：

```bash
pnpm test
pnpm run typecheck
```

如果实现过程中涉及 gateway 通信路径改动，还需要执行：

```bash
pnpm run comms:replay
pnpm run comms:compare
```

## 最近一次执行结果

- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/settings-routes.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/setup-takeover.test.tsx`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/settings-routes.test.ts tests/unit/setup-takeover.test.tsx tests/unit/app-routes.test.ts tests/unit/stores.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/setup-bootstrap.test.ts tests/unit/setup-inspection.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/workspace-path.test.ts tests/unit/setup-bootstrap.test.ts tests/unit/setup-inspection.test.ts tests/unit/takeover-reconciler.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/takeover-import.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/workspace-path.test.ts tests/unit/setup-bootstrap.test.ts tests/unit/setup-inspection.test.ts tests/unit/setup-takeover.test.tsx tests/unit/takeover-import.test.ts tests/unit/takeover-reconciler.test.ts tests/unit/provider-import.test.ts tests/unit/settings-routes.test.ts tests/unit/app-routes.test.ts tests/unit/stores.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/takeover-import.test.ts tests/unit/setup-activation.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/setup-takeover.test.tsx tests/unit/setup-inspection.test.ts tests/unit/takeover-import.test.ts tests/unit/setup-activation.test.ts tests/unit/app-routes.test.ts tests/unit/stores.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts tests/unit/takeover-import.test.ts tests/unit/setup-activation.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/user-data-override.test.ts`
- 已执行：`node node_modules/typescript/bin/tsc --noEmit`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/gateway-manager-stop.test.ts tests/unit/user-data-override.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/gateway-manager-stop.test.ts tests/unit/user-data-override.test.ts`
- 已执行：`node node_modules/typescript/bin/tsc --noEmit`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts`
- 已执行：`node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts`
- 已执行：`node node_modules/typescript/bin/tsc --noEmit`
- 已执行：`pnpm dev`
- 已执行：`curl -s http://127.0.0.1:3210/api/app/setup-inspection | jq ...`
- 已执行：`curl -s -X POST http://127.0.0.1:3210/api/app/setup-plan -H 'content-type: application/json' -d '{"mode":"takeover"}' | jq ...`
- 已执行：`curl -s -X POST http://127.0.0.1:3210/api/app/setup-plan -H 'content-type: application/json' -d '{"mode":"fresh","gatewayPort":18790,"workspacePath":"/Users/jianglong/.openclaw/workspace-xclaw-test"}' | jq ...`
- 已执行：`curl -s http://127.0.0.1:3210/api/gateway/status | jq '{state, port, error, pid}'`
- 已执行：`curl -s http://127.0.0.1:3210/api/gateway/health`
- 已执行：更新后的最新代码在真实环境完成一次 `pnpm dev -> /api/gateway/status -> /api/gateway/health` smoke，最终态为 `running + ok=true`
- 已执行：`curl -s http://127.0.0.1:3210/api/settings | jq '{setupComplete, gatewayPort, gatewayToken}'`
- 已执行：`jq '{gatewayPort: .gateway.port, gatewayToken: .gateway.auth.token}' ~/.openclaw/openclaw.json`
- 已执行：直接在真实 `~/Library/Application Support/clawx` 上临时回退到 pending，完成 `setup-inspection -> setup-plan -> takeover-import -> setup-activation`
- 已执行：真实环境 takeover 后重启 `pnpm dev`，确认不会二次进入 setup，且可附着现有 Gateway
- 已执行：`HOME=/tmp/... CLAWX_USER_DATA_DIR=/tmp/.../Library/Application\\ Support/clawx pnpm dev`
- 已执行：隔离环境首次启动日志验证 `source=legacy-footprint, readonly=true, startupSideEffects=false`
- 已执行：隔离环境 `takeover-import + setup-activation`
- 已执行：隔离环境第二次启动日志验证 `source=main-settings, readonly=false, startupSideEffects=true`
- 未执行：`pnpm test`
- 未执行：`pnpm run typecheck`
- 未执行：`pnpm run comms:replay`
- 未执行：`pnpm run comms:compare`
- 未执行：Windows 上的首次接管隔离 E2E
