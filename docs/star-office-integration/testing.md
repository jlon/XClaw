# 测试方案

## 范围

本方案覆盖以下能力：

- `Star-Office-UI` 最小化 vendoring
- 工作室 sidecar 启动与健康管理
- `/studio` 路由与标题栏右上角入口
- 只读工作室嵌入
- 主进程状态同步
- 多 agent 实时状态协议接收侧与本地桥接闭环
- `AGENTS.md` 幂等注入
- setup 新建 / takeover / 新增 agent 三条链路的自动注入

## 单元测试

### 注入工具

- `AGENTS.md` 不存在标记块时，正确插入一次
- 已存在完整标记块时，不重复追加
- 仅存在 `BEGIN` 或仅存在 `END` 时，返回损坏状态
- setup 新建、takeover、新增 agent 都复用同一个注入工具

### 状态同步

- 主智能体状态能正确写入 `state.json`
- 本地 agent 状态能正确写入 `agents-state.json`
- `state.json`、`agents-state.json`、`manifest.json` 会带一致的 `schemaVersion` 与 `generation`
- 状态文件写入采用临时文件 + 原子替换，不会留下半截 JSON
- `manifest.json` 只会在两份状态文件都写入成功后最后提交
- sidecar 只接受 manifest 指向的同代快照，不会混读不同代文件
- 正式快照损坏或代际不一致时，能整体回退到 `last-known-good` 三件套
- 缺少必填字段、状态枚举非法或 `schemaVersion` 不匹配时，会拒绝该快照
- 写作 / 调研 / 执行 / 错误 / 空闲映射正确
- 多个状态事件同时出现时，按既定优先级收敛为单一状态
- 活动态在超过窗口后会稳定回落到 `idle`
- `detail` 能按 `STAR_OFFICE_DETAIL.txt -> 该 agent 最近一次有效状态事件摘要 -> 默认文案` 的顺序回退
- `studio.agent_status` 的 `schemaVersion`、`agentId`、`sessionKey`、`sessionStartedAt`、`sequence` 与 `status` 校验正确
- 同一 agent 的旧 session 事件不会覆盖新 session
- 同一 session 的旧 `sequence` 不会覆盖已接受事件
- `final=true` 且 `status=idle` 时，会立即让对应 agent 回落到 `idle`
- `main` 一旦观察到有效 `studio.agent_status`，粗粒度 gateway `chat/tool/agent` 事件不再覆盖其状态
- gateway 现有 `agent` notification 能桥接成内部实时状态事件
- `phase=started` 但无消息体时，会先进入 `syncing`
- synthetic start 之后，同 session 的真实 `seq=1` 事件仍能覆盖，不会被错误判成旧包
- `phase=completed|done|finished|end` 能让对应 agent 立即回落到 `idle`

### runtime 管理

- runtime 目录缺失关键资源时返回错误态
- sidecar 端口冲突时能稳定失败并给出错误摘要
- 首次端口冲突时能顺序探测新端口并持久化
- 后续启动优先复用已持久化的工作室端口
- Python 未就绪时能稳定返回 `python-missing`
- 仅解释器存在但依赖未安装时，不会误判为 ready
- 工作室 Python 依赖安装在镜像失败后会回退到无镜像重试
- 工作室 Python 依赖安装子进程超时后不会无限卡住
- smoke test 失败时不会误判为 ready
- sidecar 健康检查失败时进入错误态而不是卡死

### 只读模式

- `embedded=1&readonly=1` 下会隐藏控制栏
- `embedded=1&readonly=1` 下会隐藏资产抽屉入口
- `embedded=1&readonly=1` 下会隐藏 guest 操作按钮
- 只读模式下所有写接口返回拒绝，而不是仅隐藏前端按钮

### 嵌入承载

- renderer 通过受控接口获取最终工作室 URL，而不是自己拼接 localhost 地址
- 工作室页固定使用 `webview` 承载，而不是 `iframe`
- 页面挂载时会先拉取 `getStudioRuntimeSnapshot()`，而不是依赖 renderer 本地推断
- sidecar 端口变化或实例重启时，主进程会广播 `studioRuntimeChanged`
- `runtimeInstanceId` 变化时，renderer 会销毁旧 `webview` 并重建
- 非 `ready` 状态下不会残留旧 `webview`
- `webview` 只允许同源导航，不允许跳转到其他 origin
- `webview` 不允许 `new-window`、下载和非预期外链

## 集成测试

- 应用启动后，工作室 runtime 后台拉起但不阻塞聊天页
- 访问 `/studio` 时，能根据 runtime 状态显示 `starting / ready / python-missing / runtime-error`
- 工作室错误态下点击“重试运行时”后，主进程会重新准备 Python 环境并重装依赖
- 运行时重试期间，工作室页会显示环境初始化遮罩，并阻止重复触发
- `/studio` 在 ready 态下会渲染只读 `webview`
- 工作室 ready 时能成功加载内嵌页面
- 标题栏右上角 `工作室` 按钮能进入 `/studio`，`对话` 按钮能返回聊天页
- 工作室出错时，聊天、设置、智能体工作台仍可正常使用
- 从 `/studio` 点击右上角 `对话` 时，会回到最后激活的聊天会话或聊天首页
- sidecar 重启后，`/studio` 能基于新的 `runtimeInstanceId` 自动恢复加载
- sidecar 端口重分配后，renderer 不需要自己拼新地址也能恢复工作室展示
- setup fresh 完成后，主工作区 `AGENTS.md` 被幂等注入
- setup takeover 完成后，接管工作区 `AGENTS.md` 被幂等注入
- 智能体工作台新增 agent 后，新 agent 工作区具备注入规则且不会重复

## 手工测试

### 工作室启动链路

1. 启动 XClaw
2. 验证主界面可立即进入聊天页
3. 打开 `工作室`
4. 验证工作室最终能进入 ready
5. 验证主智能体已出现在办公室里

### Python 未就绪链路

1. 清理或隔离当前 `uv` 管理的 Python 3.12
2. 启动 XClaw
3. 打开 `工作室`
4. 验证出现“环境未就绪”提示
5. 验证仍可通过现有准备流程修复

### 运行时重试修复链路

1. 让工作室进入 `python-missing` 或 `runtime-error`
2. 点击 `重试运行时`
3. 验证页面出现“环境初始化中”遮罩
4. 验证 host-api 触发重新安装依赖而不是仅重启 sidecar
5. 验证工作室最终回到 ready

### setup 新建链路

1. 在 fresh setup 场景完成 setup
2. 检查主工作区 `AGENTS.md`
3. 验证工作室规则块仅出现一次

### setup takeover 链路

1. 准备已有 OpenClaw 环境
2. 执行 takeover
3. 检查接管后的主工作区 `AGENTS.md`
4. 验证工作室规则块仅出现一次

### 新增 agent 链路

1. 在智能体工作台新增 agent
2. 检查新 agent 工作区 `AGENTS.md`
3. 验证工作室规则存在
4. 再次执行相同创建前置检查
5. 验证不会重复注入第二份规则块

### 只读模式验证

1. 打开工作室页
2. 验证没有状态按钮区
3. 验证没有资产抽屉入口
4. 验证没有装修、生图、DIY 等入口
5. 验证没有访客管理动作按钮

### 运行时恢复验证

1. 启动 XClaw 并进入 `工作室`
2. 等待工作室进入 ready
3. 手动终止工作室 sidecar，触发主进程重启
4. 验证工作室页先进入错误或启动态，再自动恢复
5. 验证恢复后展示的是新实例页面，而不是旧 `webview` 残留内容

## 回归检查

- 现有聊天页标题栏布局不能被右上角工作室入口破坏
- 现有 setup 流程不能因工作室注入而提前报错
- 智能体工作台原有人格文件编辑能力不能被削弱
- 打包后应用体积增长需符合“最小化 vendoring”预期
- `studio.agent_status` 接收侧落地后，旧 sender 缺失时仍必须保持 mixed-mode 降级可用
- 本地桥接闭环落地后，XClaw 本地 agent 不得退化为 `/join-agent` / `/agent-push` 双写模型
- README 与多语言文档若对外行为变化，需同步更新

## 需要执行的命令

至少执行：

```bash
pnpm test
pnpm run typecheck
```

如果改动涉及现有通信链路或 runtime 事件分发，还需要执行：

```bash
pnpm run comms:replay
pnpm run comms:compare
```

## 当前状态

- 已完成的最小验证：
  - `pnpm test tests/unit/run-child-command.test.ts tests/unit/studio-python-env.test.ts`
  - `pnpm test tests/unit/uv-setup.test.ts`
  - `pnpm test tests/unit/studio-runtime-manager.test.ts`
  - `pnpm test tests/unit/ipc-setup-environment-handlers.test.ts`
  - `pnpm exec eslint electron/utils/run-child-command.ts electron/studio/python-env.ts electron/utils/uv-setup.ts tests/unit/run-child-command.test.ts tests/unit/studio-python-env.test.ts --max-warnings=0`
  - `pnpm run typecheck`
  - `node --check scripts/vendor-star-office-runtime.mjs`
  - `pnpm exec tsc --noEmit --pretty false`
  - `git diff --check`
  - `pnpm test tests/unit/studio-state-manager.test.ts`
  - `pnpm run test:e2e`
  - `python3 -m py_compile resources/star-office-runtime/backend/app.py resources/star-office-runtime/backend/store_utils.py resources/star-office-runtime/backend/memo_utils.py resources/star-office-runtime/backend/security_utils.py`
  - 本机 `uv` 与 managed Python 3.12 探针通过
  - 使用临时 venv 安装 vendored runtime 依赖后，Flask sidecar `/health` smoke 通过
  - 同一只读会话下，对 `/set_state` 的 POST 返回 `403 READONLY`
  - 当前 dev 实例下，`POST /api/studio/runtime/retry` 携带 `repairEnvironment=true` 后返回 `ready`
  - `tests/e2e/studio.spec.ts` 通过，覆盖工作室入口切换与 `/studio` ready 态嵌入
  - 全量 Playwright e2e 通过：`11 passed`
- 尚未执行：
  - `pnpm test`
  - 通信回归；当前闭环依赖 gateway 既有 `agent` 事件桥接，尚未补跑 comms replay / compare
