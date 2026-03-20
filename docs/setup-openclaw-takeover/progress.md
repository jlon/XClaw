# 开发进度

## 当前状态

当前阶段：开发完成，待发布验收

当前批次进展：第八阶段“真实环境接管闭环与 Gateway 健康加固”已推进到可用状态。现在 setup 页面已经能在首步显示“接管 / 新建”分流，并消费 `setup-inspection / setup-plan / takeover-import / takeover-status / setup-activation` 全链路；takeover 与新建 setup 在当前会话中都会补跑关键启动副作用，gateway 端口链路也已经从 settings / GatewayManager / host api / renderer 回读打通，同时补了 workspace 路径规范化与 takeover 备份脱敏。本轮在真实环境里直接把 `settings.setupComplete` 临时回退到 pending，完成了一次真实 `pending -> takeover-import -> setup-activation -> 重启后不再进 setup` 链路验证；同时把 Gateway 健康检查从“WebSocket 打开即可”提升为“优先走 `system.health` round-trip，遇到不支持时降级回 socket liveness，并在连续 3 次健康失败后进入 `error + reconnect` 自愈”。随后又继续收掉了一条关键风险：如果出问题的是 XClaw 自己拉起的 Gateway，健康失败后的恢复现在会先终止该子进程，再进入 reconnect，避免重新附着回同一个坏进程。

## 里程碑

- [x] 明确 v1 功能范围
- [x] 建立仓库级功能文档工作流
- [x] 创建当前功能目录与跟踪文件
- [x] 完成第一轮设计复盘，补充“接管边界 / 平台兼容 / 只读检查模式”约束
- [x] 确认产品目标为“全面接管”，不再保留“只做运行时接管”的口径
- [x] 补充实现计划文档
- [x] 增加 setup 未决时的主进程只读检查模式
- [x] 实现主进程 setup inspection 工具
- [x] 实现 takeover plan 生成逻辑
- [x] 实现 provider 反向导入与默认项恢复
- [x] 实现 takeover backup / import / commit / rollback 流程
- [x] 实现 takeover 后的持续回收同步
- [x] 实现外部 Gateway / 并发写入阻断逻辑
- [x] 增加 setup inspection / apply 的 host API
- [x] 将 `setupComplete` 持久化到主进程 settings
- [x] 打通 gateway 端口配置链路
- [x] 增加 setup 入口页中的“接管 / 新建”UI
- [x] 增加 provider review 条件步骤与 takeover 状态轮询
- [x] 增加 setup 完成后的当前会话激活链路
- [x] 收紧 legacy footprint 判定，避免自动越过只读门禁
- [x] 补 workspace 路径规范化，覆盖 Windows 盘符/分隔符差异
- [x] 脱敏 takeover 备份中的敏感凭据
- [x] 补充单元测试
- [x] 执行 typecheck 与测试套件
- [x] 执行本机开发模式与 Host API 真实 smoke，确认只读 setup 检测会在真实 `~/.openclaw` 上触发
- [x] 修正 `setup-activation` 的成功边界，避免 Gateway 自动启动失败时仍写入 `setupComplete=true`
- [x] 为 takeover activation 增加导入完成前置守卫，避免乱序调用提前退出只读模式
- [x] 统一 setup inspection 与 runtime 启动对外部 Gateway 的握手判定
- [x] 在真实本机环境完成一次 pending 首次接管全链路 E2E
- [x] 将 Gateway 健康检查升级为优先 `system.health` round-trip
- [x] 为 Gateway 健康失败补连续失败阈值与自愈重连
- [x] 避免健康恢复时重新附着回同一个自管坏进程

## 下一步

1. 将 Windows 真机验收登记为单独遗留项，后续补齐端口占用、路径规范化、当前会话激活和回滚稳定性验证
2. 把“Gateway 托管增强”拆成独立 feature 推进，不再继续混在接管 feature 中扩 scope
3. 视发布需要决定是否补 macOS 的最终人工回归清单复跑

## 本轮已完成

1. 新增 `electron/main/setup-bootstrap.ts`，抽出 setup 状态判定与旧版 XClaw 足迹识别
2. 主进程启动流程接入只读门禁，在 setup 未确认时挂起技能安装、插件安装、workspace context 合并、Gateway 自动启动和 CLI 自动安装
3. 新增 `electron/main/setup-inspection.ts`，提供本地 OpenClaw 检测摘要、provider 导入摘要和 setup plan 构建
4. Host API 新增 `GET /api/app/setup-inspection` 与 `POST /api/app/setup-plan`
5. `setupComplete` 开始通过 `/api/settings/setupComplete` 持久化到主进程 settings
6. 新增 `electron/services/providers/provider-import.ts`，把 OpenClaw runtime provider 映射成 XClaw provider accounts / secrets / default account
7. 为 `provider-store` 和 `secret-store` 增加整批替换导入入口，并同步兼容旧的 `providers` / `apiKeys` 存储
8. 新增 `electron/main/takeover-import.ts`，实现 takeover 的备份、导入、提交、失败回滚与状态查询
9. Host API 新增 `POST /api/app/takeover-import`、`GET /api/app/takeover-status` 与 `POST /api/app/setup-activation`
10. 新增 `src/lib/setup-takeover.ts`，把 setup takeover 相关 Host API 访问从页面里抽成独立 helper
11. setup 首页新增“接管现有安装 / 从头创建”条件步骤流，并在 takeover 进行中轮询状态、在成功后补齐当前会话激活
12. 新增 `electron/main/takeover-runtime.ts`，抽出 takeover 运行时读取，避免 import / reconciler 各自维护一套 OpenClaw 读取逻辑
13. 新增 `electron/main/takeover-reconciler.ts`，实现指纹构建、Windows 路径规范化、provider 漂移刷新和非 provider 漂移回收
14. takeover import 在提交阶段会先写入 `takeoverFingerprint`，为后续启动期 reconciler 提供基线
15. gateway 端口链路已统一走 `settings -> GatewayManager -> host api / ipc fallback -> renderer api client`，避免继续写死 `18789`
16. legacy XClaw footprint 不再自动视为 setup 完成，避免旧残留直接绕过只读门禁
17. workspace 路径解析已经统一走规范化工具，覆盖 `~` 展开、Windows 盘符大小写、分隔符和尾部斜杠
18. takeover 备份文件已对 token / apiKey / OAuth access/refresh 等敏感字段做脱敏，避免明文落盘
19. `Setup` 页状态机已去掉会提前写入 `gatewayPort` store 的副作用，fresh 路径参数只在最终 activation 时落盘
20. `Setup` 页在检测到“已有进行中的 takeover”时会立即刷新一次 `takeover-status`，避免刷新后长期停留在过期中间态
21. 本机真实 smoke 已确认 `pnpm dev` 会拉起 Electron 进程、Host API 服务和只读 setup bootstrap；真实 `~/.openclaw/openclaw.json` 在 smoke 过程中未被改写
22. `fresh` 首屏已改成“新建 XClaw 配置”语义，直接展示当前工作区 / 推荐新工作区 / 当前端口 / 推荐新端口，而不是继续展示 takeover 摘要
23. `fresh` 模式的阻断与提醒标题已改成独立文案，不再错误复用“当前不能直接接管 / 接管提醒”
24. setup 首步页头会根据 `takeover / fresh` 选择切换标题与说明，减少“已选新建但页面还在讲接管”的割裂感
25. setup 主卡片、模式选择卡、fresh 运行配置卡与提示块已统一到更接近现有产品的圆角、浅表面与对比度体系
26. `takeover-import` 现已在提交阶段同步导入 `gatewayPort / gatewayToken`，避免接管后仍沿用 XClaw 本地旧 token / port
27. `setup-activation` 在 `takeover` 模式下会先把当前会话的 `GatewayManager` 端口对齐到主进程 settings，再决定是否自动启动 Gateway
28. 本机真实 smoke 已验证 `settings.gatewayPort / settings.gatewayToken` 与 `~/.openclaw/openclaw.json` 中的 `gateway.port / gateway.auth.token` 一致
29. 本机真实 smoke 已验证 Gateway 最终进入 `running`，之前的 `unauthorized token mismatch` 已消失；当前剩余噪音来自本地第三方插件 ABI 与重复插件告警，不是接管链路本身
30. 新增 `tests/unit/gateway-manager-stop.test.ts`，锁定“退出 app 时不要顺手 shutdown 外部 Gateway”的行为
31. `GatewayManager.stop()` 现支持显式选择是否 shutdown 外部 Gateway；`before-quit` 已改成只断开/清理，不再主动关闭复用中的外部 OpenClaw Gateway
32. 重新梳理了 setup 触发条件：setup 页由 `settings.setupComplete === false` 驱动，正常完成后不会自动二次弹出；但 setup side effects 仍会在后续启动时再次执行
33. 新增 `XClaw_USER_DATA_DIR` 开发态覆盖入口，允许在不污染真实 settings 的前提下构造隔离 `userData`
34. 隔离环境下已完成一次“首次接管”真实链路：首次启动落成 `source=legacy-footprint, readonly=true, startupSideEffects=false`，执行 `takeover-import + setup-activation` 后再次启动落成 `source=main-settings, readonly=false, startupSideEffects=true`
35. `setup-activation` 现已在 `awaitCriticalTasks=true` 时把 Gateway 自动启动失败升级为硬失败，不再允许 setup 被错误标记完成
36. `setup-activation` 路由现已为 `takeover` 模式增加导入完成前置守卫，要求 `takeover-status=complete` 或已有 `takeoverFingerprint`
37. setup inspection 对外部 Gateway 的识别现已改成 challenge-based probe，不再把“纯 WebSocket 可连通”的非 OpenClaw 服务误判为可复用 Gateway
38. 本机真实环境已完成一次“直接改回 pending -> 接管导入 -> setup 激活 -> 重启后不再进入 setup”的全链路 E2E，验证当前实现不需要依赖复制 `~/.openclaw` 样本
39. `GatewayManager.checkHealth()` 现已优先调用 `system.health`；若目标 Gateway 不支持该 RPC，会自动缓存能力缺失并回退到 WebSocket liveness
40. 定时 health check 现已在连续 3 次失败后主动将连接标记为 `error`、终止当前 socket 并触发 reconnect，自愈链路不再只依赖 `close / exit / pong timeout`
41. 如果连续 health 失败的是 XClaw 自己拉起的 Gateway，恢复流程现会先终止该子进程，再进入 reconnect，避免附着回同一个已失活但仍占端口的实例

## 本轮验证

1. `node node_modules/vitest/vitest.mjs run tests/unit/settings-routes.test.ts`
2. `node node_modules/vitest/vitest.mjs run tests/unit/setup-takeover.test.tsx`
3. `node node_modules/vitest/vitest.mjs run tests/unit/settings-routes.test.ts tests/unit/setup-takeover.test.tsx tests/unit/app-routes.test.ts tests/unit/stores.test.ts`
4. `node node_modules/vitest/vitest.mjs run tests/unit/setup-bootstrap.test.ts tests/unit/setup-inspection.test.ts`
5. `node node_modules/vitest/vitest.mjs run tests/unit/workspace-path.test.ts tests/unit/setup-bootstrap.test.ts tests/unit/setup-inspection.test.ts tests/unit/takeover-reconciler.test.ts`
6. `node node_modules/vitest/vitest.mjs run tests/unit/takeover-import.test.ts`
7. `node node_modules/vitest/vitest.mjs run tests/unit/workspace-path.test.ts tests/unit/setup-bootstrap.test.ts tests/unit/setup-inspection.test.ts tests/unit/setup-takeover.test.tsx tests/unit/takeover-import.test.ts tests/unit/takeover-reconciler.test.ts tests/unit/provider-import.test.ts tests/unit/settings-routes.test.ts tests/unit/app-routes.test.ts tests/unit/stores.test.ts`
8. `node node_modules/typescript/bin/tsc --noEmit`
9. `pnpm dev`
10. `curl -s http://127.0.0.1:3210/api/app/setup-inspection | jq ...`
11. `curl -s -X POST http://127.0.0.1:3210/api/app/setup-plan -H 'content-type: application/json' -d '{"mode":"takeover"}' | jq ...`
12. `curl -s -X POST http://127.0.0.1:3210/api/app/setup-plan -H 'content-type: application/json' -d '{"mode":"fresh","gatewayPort":18790,"workspacePath":"/Users/jianglong/.openclaw/workspace-xclaw-test"}' | jq ...`
13. `node node_modules/vitest/vitest.mjs run tests/unit/setup-takeover.test.tsx tests/unit/setup-inspection.test.ts`
14. `node node_modules/vitest/vitest.mjs run tests/unit/takeover-import.test.ts tests/unit/setup-activation.test.ts`
15. `node node_modules/vitest/vitest.mjs run tests/unit/setup-takeover.test.tsx tests/unit/setup-inspection.test.ts tests/unit/takeover-import.test.ts tests/unit/setup-activation.test.ts tests/unit/app-routes.test.ts tests/unit/stores.test.ts`
16. `curl -s http://127.0.0.1:3210/api/gateway/status | jq '{state, port, error, pid}'`
17. `curl -s http://127.0.0.1:3210/api/settings | jq '{setupComplete, gatewayPort, gatewayToken}'`
18. `jq '{gatewayPort: .gateway.port, gatewayToken: .gateway.auth.token}' ~/.openclaw/openclaw.json`
19. `node node_modules/typescript/bin/tsc --noEmit`
20. `node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts`
21. `node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts tests/unit/takeover-import.test.ts tests/unit/setup-activation.test.ts`
22. `node node_modules/vitest/vitest.mjs run tests/unit/user-data-override.test.ts`
23. `HOME=/tmp/... XClaw_USER_DATA_DIR=/tmp/.../Library/Application\\ Support/XClaw pnpm dev`
24. `curl -s http://127.0.0.1:3210/api/app/setup-inspection | jq ...`
25. `curl -s -X POST http://127.0.0.1:3210/api/app/setup-plan -H 'content-type: application/json' -d '{"mode":"takeover"}' | jq ...`
26. `curl -s -X POST http://127.0.0.1:3210/api/app/takeover-import -H 'content-type: application/json' -d '{"mode":"takeover"}' | jq ...`
27. `curl -s -X POST http://127.0.0.1:3210/api/app/setup-activation -H 'content-type: application/json' -d '{"mode":"takeover"}' | jq .`
28. `node node_modules/vitest/vitest.mjs run tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/gateway-manager-stop.test.ts tests/unit/user-data-override.test.ts`
29. `node node_modules/vitest/vitest.mjs run tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts tests/unit/gateway-manager-stop.test.ts tests/unit/user-data-override.test.ts`
30. `node node_modules/typescript/bin/tsc --noEmit`
31. `node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts`
32. `node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts`
33. `pnpm dev`
34. `curl -s http://127.0.0.1:3210/api/gateway/status`
35. `curl -s http://127.0.0.1:3210/api/gateway/health`
36. 真实环境下临时将 `settings.setupComplete=false`、清空 `takeoverFingerprint`，再执行 `setup-inspection / setup-plan / takeover-import / setup-activation`
37. 真实环境接管后重启 `pnpm dev`，确认日志落成 `readonly=false, startupSideEffects=true` 且不会再次进入 setup
38. `node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-health.test.ts`
39. `node node_modules/vitest/vitest.mjs run tests/unit/gateway-manager-stop.test.ts tests/unit/setup-inspection.test.ts tests/unit/app-routes.test.ts tests/unit/setup-activation.test.ts`
40. `node node_modules/typescript/bin/tsc --noEmit`
41. `pnpm dev`
42. `curl -s http://127.0.0.1:3210/api/gateway/status`
43. `curl -s http://127.0.0.1:3210/api/gateway/health`

## 当前阻塞

1. `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit` 仍被仓库现有 Node 侧类型错误阻断，当前看到的问题集中在 `electron/api/routes/channels.ts`、`electron/api/routes/skills.ts`、`electron/gateway/clawhub.ts`、`electron/utils/device-identity.ts` 等旧文件，不是这次改动新引入的首个报错
2. Windows 真机手工验收尚未执行，因此功能还不能按“双端发布完成”结论对外宣称
3. 本地第三方插件 `memos-local-openclaw-plugin` 存在 `better-sqlite3` ABI 不匹配告警，Gateway 最终仍能跑起来，但它会污染启动日志并增加排障噪音
4. 仅修改 shell 的 `HOME` 不足以隔离 Electron 的 `userData`；想做“首次接管”的隔离 E2E，需要显式覆盖 `app.getPath('userData')` 或使用受控备份/恢复方式切换真实 settings
5. Gateway 健康检查虽已提升到“优先 round-trip + 连续失败自愈”，但离“99.99% 完全托管”仍差一个等级：当前没有 out-of-process watchdog、crash ledger 和 last-known-good 运行时回退
6. 复用外部 Gateway 时，“退出应用只 detach、不主动 shutdown”已经修好，但手动 stop / restart 仍沿用会主动关闭外部 Gateway 的旧语义，产品定义尚未完全收口

## 备注

- 该功能必须从“只读检测 + 显式确认”开始推进
- 完整的 OpenClaw 根目录迁移能力延后处理
- 当前最大风险不是 UI，而是用户确认前现有环境就被改写
- 当前最大设计工作量集中在 Provider 导入与接管后的持续同步
- macOS 与 Windows 双端通过是硬门槛，不接受单端先行视为完成
- 当前 feature 的开发闭环已经完成，可以停止继续扩 scope；剩余项以“发布验收 / 环境治理 / 后续增强 feature”方式管理
