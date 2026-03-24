# 测试方案

## 范围

本方案覆盖以下能力：

- `Star-Office-UI` 最小化 vendoring
- 工作室 sidecar 启动与健康管理
- `/studio` 路由与顶部双 tab
- 只读工作室嵌入
- 主进程状态同步
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
- 写作 / 调研 / 执行 / 错误 / 空闲映射正确
- `detail` 能按 `STAR_OFFICE_DETAIL.txt -> 最近用户消息摘要 -> 默认文案` 的顺序回退

### runtime 管理

- runtime 目录缺失关键资源时返回错误态
- sidecar 端口冲突时能稳定失败并给出错误摘要
- Python 未就绪时能稳定返回 `python-missing`
- sidecar 健康检查失败时进入错误态而不是卡死

### 只读模式

- `embedded=1&readonly=1` 下会隐藏控制栏
- `embedded=1&readonly=1` 下会隐藏资产抽屉入口
- `embedded=1&readonly=1` 下会隐藏 guest 操作按钮

## 集成测试

- 应用启动后，工作室 runtime 后台拉起但不阻塞聊天页
- 访问 `/studio` 时，能根据 runtime 状态显示 `starting / ready / python-missing / runtime-error`
- 工作室 ready 时能成功加载内嵌页面
- 工作室出错时，聊天、设置、智能体工作台仍可正常使用
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

## 回归检查

- 现有聊天页标题栏布局不能被新 tab 破坏
- 现有 setup 流程不能因工作室注入而提前报错
- 智能体工作台原有人格文件编辑能力不能被削弱
- 打包后应用体积增长需符合“最小化 vendoring”预期
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

- 设计阶段，尚未执行实现验证
