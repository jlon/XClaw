# 开发进度

## 当前状态

当前阶段：v1.1 本地闭环落地与验证

当前结论已经确认：

- 工作室是全局工作室
- 聊天页与工作室页通过标题栏右上角入口切换
- 工作室在产品上是独立路由，不与单个聊天 session 绑死
- `Star-Office-UI` 采用最小化 vendoring
- XClaw 启动时后台拉起工作室 sidecar，但不阻塞主功能
- Python 复用现有 `uv + managed Python` 准备逻辑
- 状态由 XClaw 主进程自动维护
- 提示词注入只写入 `AGENTS.md`
- `AGENTS.md` 幂等注入器已接入 fresh setup、takeover 和新增 agent 创建链路
- 注入必须幂等，不能重复注册
- 共享状态快照采用 `state.json + agents-state.json + manifest.json` 的同代提交模型
- 工作室页面固定通过受控 `webview` handoff 加载，不允许 renderer 自行拼接地址
- 主进程 `StudioService`、runtime manager、状态快照落盘与 host-api 路由已接入第一版
- vendored runtime 已裁成最小 allowlist，并完成只读模式补丁与数据目录外置
- 当前聊天 agent 的场景内弱标记已接入工作室，只做轻提示，不引入强高亮或单 agent 视图
- 多 agent 实时状态协议的 XClaw 接收侧已落地，包含 `studio.agent_status` 校验、session 取舍、TTL 回落与快照提交
- 现有 gateway `agent` notification 已桥接到工作室实时协议，本地 main agent 与本地其他 agent 已形成 XClaw 内部闭环

## 里程碑

- [x] 完成现状调研
- [x] 明确 `Star-Office-UI` 不是可直接嵌入的 React 组件库
- [x] 明确工作室采用全局视图
- [x] 明确只读展示范围
- [x] 明确 Python 运行时复用现有 setup 逻辑
- [x] 明确状态来源为“主进程自动状态 + 提示词补 detail”
- [x] 明确注入只作用于 `AGENTS.md`
- [x] 明确“不能重复注册”是指提示词块不能重复注入
- [x] 完成功能设计文档
- [x] 创建 `design.md` / `testing.md` / `issues.md` / `progress.md`
- [x] 完成 3 轮子代理 spec review，并按第 3 轮 findings 收口文档
- [x] 根据 review 收敛状态快照一致性与 `webview` handoff 契约
- [x] 产出 `implementation-plan.md`
- [x] 完成 `Star-Office-UI` 最小化 vendoring 脚本与资源导入
- [x] 完成工作室 runtime 路径层、Python 环境准备层与快照 schema 第一版
- [x] 完成 `AGENTS.md` 幂等注入，并接入 fresh setup、takeover、新增 agent
- [x] 完成 `/studio` 页面、标题栏右上角工作室入口与只读 `webview` 宿主第一版
- [x] 完成 vendored runtime 只读补丁、数据目录切换与快照协议适配第一版
- [x] 完成工作室错误态下的“重试并重装依赖”恢复链路
- [x] 完成工作室环境初始化遮罩与初始化提示
- [x] 收口工作室容器尺寸、自适应与只读场景裁切问题
- [x] 收口工作室 Python 环境准备在 Windows 下可能无限等待的问题
- [x] 完成当前聊天 agent 的场景内弱标记接入
- [x] 完成多 agent 实时状态协议设计补充与流程图（`v1.1 / 后续增强`）
- [x] 完成多 agent 实时状态协议的 XClaw 接收侧实现与专用单测
- [x] 完成 gateway `agent` notification 到工作室实时协议的内部桥接，实现本地闭环
- [x] 补充工作室入口与 `/studio` 就绪态的 Playwright e2e
- [ ] 清理残留实现与补齐最终 README 描述

## 下一步

1. 清理未使用的 `StudioRouteTabs` 残留与未跟踪产物
2. 复核 README 是否需要补充“工作室会自动展示本地 agent 实时状态”的对外说明
3. 若未来接入 upstream 原生 `studio.agent_status` sender，需要验证其与当前内部桥接的优先级切换

## 当前风险

1. 最小 vendoring 仍会带来可见体积增长，需要在实现阶段严格控制资源清单
2. `Star-Office-UI` 的只读模式需要维护一层 XClaw 自己的 patch
3. 工作室 sidecar 的启动失败与降级链路必须先做好，避免影响聊天主路径
4. 共享状态快照的 schema 一旦落地，后续演进必须保持兼容纪律，不能在实现时临时加字段破坏协议
5. 当前 worktree 没有独立 `node_modules`，大部分验证只能先做语法级和结构级检查
6. 当前本地闭环依赖 gateway 已有 `agent` 事件形态；如果 upstream 后续改字段，需要同步校正桥接解析
7. 工作室 Python 环境准备当前已补上命令级超时与镜像失败回退，但首次冷启动仍取决于本机网络与镜像可达性

## 备注

- 当前实现由主线 + 并行子代理共同推进；工作室主功能已通，`studio.agent_status` 的主进程接收侧和本地桥接闭环都已落地
- 已完成的最小校验包括：vendoring 产物结构检查、`git diff --check`、新改文件语法级转译检查、工作室 runtime 强制重试恢复验证、`studio-state-manager` 专用单测、工作室入口 Playwright e2e、全量 Playwright e2e
- 2026-03-25 补充：工作室 Python 依赖安装链路已补上子进程超时与“镜像失败后无镜像重试”，避免 Windows 上卡在“正在重新准备 Python 环境并安装工作室依赖”
