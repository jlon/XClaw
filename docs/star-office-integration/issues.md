# 问题与待确认项

## 当前已知问题

### `Star-Office-UI` 不是组件库，后续升级需要维护 vendored patch

当前方案选择的是最小化 vendoring，而不是 npm 包依赖或组件级接入。这意味着：

- 只读模式相关 patch 需要由 XClaw 维护
- 后续升级 upstream 时，需要重新核对只读 patch 是否还能套用

这不是当前方案的缺陷，而是集成方式的固有成本。

### 工作室新增体积无法压到“极小”

即使只保留最小运行时，也仍需要：

- Phaser 引擎
- 像素场景素材
- 角色动画素材
- 字体资源

因此新增体积只能做到“最小化”，不能做到“几 MB 内可忽略”。

### 损坏标记块不自动修复

当前设计明确：

- 完整标记块存在 -> 跳过
- 标记块缺失 -> 注入
- 单边标记存在 -> 视为损坏

这能避免重复注册，但也意味着 v1 不会自动修复用户手动破坏的块，只会提示可修复。

### 主状态自动推导与 `detail` 可能短时不一致

主状态由 XClaw 自动推导，`detail` 由 `STAR_OFFICE_DETAIL.txt` 或消息摘要补充。

因此可能存在：

- 状态已经切到 `executing`
- 但 `detail` 仍是上一段任务描述

这是当前方案接受的取舍，优先保证主状态稳定。

### Windows 下工作室 Python 环境准备曾可能无限等待

根因不是工作室页面的遮罩，而是底层环境准备链路存在两个空洞：

- 工作室依赖安装没有像 `setupManagedPython()` 一样提供镜像失败后的无镜像回退
- `uv python install`、`uv pip install`、依赖探针等子进程没有命令级超时

结果是：一旦镜像或网络进入半挂状态，工作室 runtime 会长期停在 `starting / restarting`，renderer 只能持续显示“正在重新准备 Python 环境并安装工作室依赖”。

这个问题已修复，当前实现已补上：

- 工作室依赖安装的无镜像回退
- Python / 工作室依赖准备相关子进程超时

当前剩余风险不再是“无限卡住”，而是会在超时后明确回到错误态，等待用户重试。

### Windows 下工作室环境准备曾会放大空控制台窗口问题

这不是“某个 shell 忘了关闭”那么简单，实际根因分两层：

- XClaw 自己之前会在 setup 状态刷新和工作室依赖准备过程中重复触发 Python / `uv` 探测
- `uv` 在 Windows 上本身存在弹空控制台窗口的上游已知问题时，这些重复调用会把体验放大成“很多空窗口”

当前实现已做的收口是：

- `setup:environment-status` 不再为同一次刷新重复探测 Python readiness
- 工作室 `.venv` 创建与依赖安装改成直接走 managed Python 的 `venv + pip`

当前剩余边界：

- managed Python 首次安装仍依赖 `uv`
- 如果 Windows 端后续仍出现少量空控制台窗口，更可疑的是 `uv` 自身启动阶段，而不是工作室依赖安装链路继续重复派生窗口

### upstream 原生 sender 仍未接入，但本地闭环已由 XClaw 内部桥接补齐

当前仓库已经实现：

- `studio.agent_status` 在 XClaw 主进程内的校验、session 取舍、TTL 回落与快照提交
- gateway 现有 `agent` notification 到工作室实时协议的内部桥接
- `main` 与本地其他 agent 的实时状态都能在不改 upstream runtime 的前提下进入同一快照链路

但尚未实现：

- agent runtime / gateway sender 侧真实发射原生 `studio.agent_status`

这意味着当前真实运行态的边界是：

- 对 XClaw 本地 agent：已经闭环，优先走 gateway `agent` 事件桥接，其次回退 `STAR_OFFICE_DETAIL.txt`
- 对未来 upstream 原生 sender：尚未落地，需要后续验证与当前桥接的优先级切换
- 对远端访客 agent：仍然不走本地 `join-agent` / `agent-push`

所以“多 agent 实时状态协议”当前是：

- 本地闭环已就绪
- upstream 原生 sender 仍是后续增强，而不是当前阻塞项

## 待确认项

### 工作室端口是否需要最终对用户可见

当前设计只要求：

- sidecar 使用独立 localhost 端口
- 不复用现有 XClaw 端口

但是否要在设置页公开这个端口，目前尚未决定。

### `STAR_OFFICE_DETAIL.txt` 是否需要在工作台里暴露编辑入口

v1 可以只让 agent 自己维护该文件，也可以在后续考虑：

- 在智能体工作台中把它作为可编辑工作区文件暴露出来

当前设计未将此列为必须项。

## v1 已接受的取舍

- 工作室为全局视图，不做单 agent 过滤
- 只读展示，不开放装修与资产编辑
- 不走本地 `join-agent` / `agent-push`
- 只注入 `AGENTS.md`
- 不自动覆盖已存在的完整工作室规则块
- 不自动修复损坏标记块

## 后续候选项

- 增加单 agent 聚焦模式
- 增加只读工作室的独立窗口
- 增加工作室设置页与日志页
- 为损坏标记块提供一键修复
- 评估是否将 `STAR_OFFICE_DETAIL.txt` 纳入工作台可视化编辑能力
