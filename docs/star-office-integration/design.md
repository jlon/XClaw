# Star Office 集成设计

## 问题背景

XClaw 当前已经有成熟的聊天、智能体工作台、setup 接管和 `uv + managed Python` 运行时能力，但还没有一个“工作可视化总览”页面，用户无法在桌面应用内直观看到：

- 主智能体当前是否在工作
- 本地多个智能体当前处于什么状态
- 所有智能体是否汇聚在同一个统一工作室里

现有的 `Star-Office-UI` 已经提供了成熟的像素办公室可视化能力，但它本质上不是 React 组件库，而是一套：

- Python/Flask 本地服务
- 静态前端页面
- 基于 JSON 文件的状态读写

因此，本功能不是“把一个 React 页面复制进 XClaw”，而是要把 `Star-Office-UI` 裁剪成一个由 XClaw 托管的最小运行时，并以内嵌页面的方式展示。

## 本轮设计结论

本功能按以下产品边界落地：

- 工作室是全局工作室，不跟随某个聊天会话单独变化
- 聊天页顶部增加 `对话 / 工作室` 双 tab，但工作室实际对应独立路由
- `Star-Office-UI` 以最小化 vendoring 的方式打包进 XClaw
- XClaw 启动时后台拉起工作室 sidecar，但不阻塞主界面进入
- 工作室页面只读展示，不开放装修、资产编辑、访客管理等控制入口
- 本地智能体状态由 XClaw 主进程自动维护
- 提示词注入只负责补充 `detail` 语义，不负责主状态切换
- 提示词注入只写入 `AGENTS.md`
- 注入必须幂等，不能重复追加相同规则块

## 目标

- 在 XClaw 内提供一个稳定、全局的工作室页面
- 让主智能体和本地 agent 都能显示在同一个办公室场景中
- 复用 XClaw 现有 `uv + managed Python 3.12` 准备逻辑
- 将 `Star-Office-UI` 新增体积控制在“只读工作室所需最小资源”范围内
- setup 新建、setup 接管、智能体工作台新增 agent 三条链路都支持自动注入工作室规则
- 注入逻辑必须幂等，不能重复注册同一提示词块

## 非目标

- 不在 v1 重写 `Star-Office-UI` 为原生 React 页面
- 不在 v1 开放装修、Gemini、生图、资产抽屉、访客审批等高级能力
- 不在 v1 提供单 agent 过滤视图或聚焦模式
- 不在 v1 让本地 agent 伪装成远端访客走 `join-agent` / `agent-push`
- 不在 v1 通过 `SOUL.md` 注入工作室规则
- 不在 v1 自动修复损坏的注入标记块

## 方案选择

### 方案 A：最小 vendoring + 受管 sidecar + 只读嵌入

做法：

- 将 `Star-Office-UI` 裁剪为最小运行时资源随 XClaw 打包
- 由 XClaw 主进程后台拉起独立 Flask 服务
- renderer 通过内嵌页面展示只读工作室
- XClaw 主进程直接维护 `state.json` / `agents-state.json`

优点：

- 边界清晰
- 对现有 XClaw React 架构侵入小
- 最大化复用 `Star-Office-UI` 现有视觉效果
- 后续升级 vendored runtime 时成本可控

缺点：

- 仍然是双运行时模型，Electron 与 Python 需要共同维护

结论：

采用。

### 方案 B：最小 vendoring + 通过 HTTP 调用 `Star-Office-UI` 本地接口同步状态

优点：

- 看起来更贴近 `Star-Office-UI` 的现有接口设计

缺点：

- 本地状态同步多一层无必要网络调用
- 本地异常链路更长
- 不能利用 XClaw 主进程已有的状态主事实源

结论：

不采用。

### 方案 C：重写为原生 React 工作室

优点：

- 最统一
- 后续扩展自由度最高

缺点：

- 明显超出 v1
- 偏离 upstream
- 成本和风险都过高

结论：

不采用。

## 资源最小化策略

### 保留资源

仅保留只读工作室运行所必需的内容：

- `backend/app.py`
- `backend/memo_utils.py`
- `backend/security_utils.py`
- `backend/store_utils.py`
- `backend/requirements.txt`
- `frontend/electron-standalone.html`
- `frontend/vendor/phaser-3.80.1.min.js`
- 只读场景实际加载的静态素材与字体
- XClaw 侧初始化生成的默认状态模板

### 明确裁掉的资源

以下内容不进入 XClaw 打包产物：

- `desktop-pet/`
- `electron-shell/`
- `docs/`
- `dist/`
- `scripts/`
- `frontend/join.html`
- `frontend/invite.html`
- `frontend/office-agent-push.py`
- `frontend/join-office-skill.md`
- 字体压缩包等纯分发辅助文件
- 装修流程不需要的额外发布材料

### 目录形态

建议在 XClaw 产物中拆成两类目录：

- 只读 runtime 目录：存放 vendored `Star-Office-UI` 代码和静态资源
- 可写 data 目录：存放 `state.json`、`agents-state.json`、`runtime-config.json`

这样可以避免：

- macOS 应用包内资源不可写
- Windows 安装目录权限问题
- 升级安装时覆盖用户运行态数据

## 总体架构

### 1. `StudioRuntimeManager`

主进程新增工作室运行时管理器，职责包括：

- 解析工作室 runtime 目录与 data 目录
- 检查 runtime 资源是否完整
- 在应用启动时后台拉起 Flask sidecar
- 进行健康检查
- 管理端口分配、停止、重试和错误态

关键原则：

- 工作室随应用启动，但不得阻塞聊天页进入
- sidecar 启动失败时，XClaw 主功能仍可正常使用

### 2. `StudioStateManager`

主进程新增状态同步管理器，职责包括：

- 维护主智能体 `state.json`
- 维护本地 agent `agents-state.json`
- 将 XClaw 运行时事件映射为工作室状态
- 从 `STAR_OFFICE_DETAIL.txt` 或其他回退来源补充 `detail`

本管理器是工作室状态的唯一主事实源，renderer 只消费结果，不直接写状态。

### 3. `StudioPromptInjector`

新增统一的提示词注入工具，职责包括：

- 对主工作区 `AGENTS.md` 做幂等注入
- 对新建 agent 工作区 `AGENTS.md` 做幂等注入
- setup 新建与 takeover 时复用同一套注入逻辑

关键原则：

- 只注入 `AGENTS.md`
- 不注入 `SOUL.md`
- 已存在完整标记块时直接跳过

### 4. renderer 工作室页面

renderer 新增 `/studio` 路由与页面容器，职责包括：

- 展示顶部 `对话 / 工作室` tab
- 根据工作室运行态展示 `starting / ready / python-missing / runtime-error`
- 在 `ready` 态下嵌入只读工作室页面

## 路由与导航设计

### 顶部 tab

在聊天页和工作室页顶部统一显示：

- `对话`
- `工作室`

它们是视觉上的 segmented control，但行为上对应路由切换：

- `对话` -> 当前聊天页
- `工作室` -> `/studio`

这样做的原因：

- 工作室是全局视图，不应该跟某个 session 的 DOM 生命周期绑死
- 不会破坏当前聊天页的流式状态、滚动状态和输入状态
- 更符合产品上“所有聊天共用同一个办公室”的定义

## 工作室只读嵌入设计

### 嵌入方式

工作室页面内嵌 vendored `Star-Office-UI` 页面，不直接重写 UI。

### 只读模式补丁

对 vendored `frontend/electron-standalone.html` 做最小 patch，新增：

- `embedded=1`
- `readonly=1`

在只读模式下隐藏：

- 状态控制栏
- 资产抽屉
- 搬家 / DIY / broker / Gemini 入口
- guest 列表里的操作按钮
- 其他会产生写操作的 UI

保留：

- 像素办公室场景
- 主智能体与本地 agent 的展示
- 访客列表的只读摘要

## 运行时与端口策略

### 启动策略

工作室 sidecar 在 XClaw 启动时后台拉起。

但必须满足：

- 不等待它完成才进入主界面
- 启动慢时只影响工作室页
- 聊天、设置、工作台等核心页面不被阻塞

### 端口策略

不复用 XClaw 现有端口。

原因：

- `Star-Office-UI` 本质是独立 Flask 服务
- 强行复用 XClaw host-api 或 renderer 端口会打乱边界
- 后续维护成本显著升高

建议：

- 工作室 sidecar 使用单独 localhost 端口
- 运行时动态探测空闲端口或使用稳定可配置专用端口

## Python 运行时策略

工作室 sidecar 复用 XClaw 现有 setup 里的 `uv + managed Python 3.12` 逻辑。

### 行为定义

- 若 `uv` 可用且 `uv python find 3.12` 成功，则直接复用
- 若未就绪，则通过现有 `uv:install-all` 准备环境

### UI 降级

当 Python 未就绪时：

- 聊天页仍可正常使用
- 工作室页展示“环境未就绪”
- 提供通向现有准备流程的操作入口

## 状态同步设计

### 状态来源

工作室状态由 XClaw 主进程自动推导，不要求 agent 自己切换主状态。

v1 状态映射采用小而稳的规则：

- 会话输出中 -> `writing`
- 搜索 / 浏览 / 调研类工具 -> `researching`
- 命令执行 / 任务执行类工具 -> `executing`
- 同步类内部动作 -> `syncing`
- 运行错误 -> `error`
- 空闲或完成后回落 -> `idle`

### 本地 agent 展示方式

本地 agent 直接写入 `agents-state.json`，不走 `/join-agent` / `/agent-push` 的远端访客链路。

原因：

- 远端访客机制包含 joinKey、审批、离线恢复等本地不需要的复杂状态机
- XClaw 本地 agent 已有稳定 agent id，可直接作为工作室 agent id 使用

### `detail` 来源优先级

按以下优先级生成展示文案：

1. 工作区 `STAR_OFFICE_DETAIL.txt`
2. 当前会话最近一条用户消息的裁剪摘要
3. 默认回退文案

## 提示词注入设计

### 注入目标

仅注入 `AGENTS.md`。

不注入 `SOUL.md`，因为：

- `AGENTS.md` 更适合承载工作流规则
- `SOUL.md` 更适合人格与行为准则
- 将工作室同步规则写进 `SOUL.md` 会混淆职责

### 注入时机

需要覆盖三条链路：

1. setup 新建流程完成时
2. setup takeover 现有 OpenClaw 时
3. 智能体工作台新增 agent 时

### 注入规则块

建议采用固定标记块，例如：

```md
## XClaw Star Office

<!-- XCLAW:STAR_OFFICE:BEGIN -->
...规则正文...
<!-- XCLAW:STAR_OFFICE:END -->
```

### 幂等策略

- 找到完整 `BEGIN + END`：视为已注入，直接跳过
- 完全不存在标记块：注入一次
- 只有单边标记：视为损坏，不自动补第二份，提示可修复

这里的关键结论是：

- 幂等插入
- 不自动覆盖用户已存在的完整块
- 不允许重复追加同一规则块

## `STAR_OFFICE_DETAIL.txt` 设计

为避免让 agent 负责主状态切换，工作室规则只要求 agent 在合适时机维护一份轻量 detail 文件：

- 文件名：`STAR_OFFICE_DETAIL.txt`
- 内容：一行短句
- 作用：辅助工作室气泡和状态文案

它的职责仅是补充描述，不承担状态机职责。

## 失败与降级设计

### 注入失败

- setup 阶段：不阻塞整个 XClaw 使用，但记录“工作室未完成配置”
- 新增 agent 阶段：agent 可以继续创建成功，但工作台需要给出警告和修复入口

### runtime 启动失败

- 主功能不受影响
- 工作室页展示错误态
- 提供重试和查看日志入口

### detail 文件缺失

- 直接回退到自动摘要或默认文案
- 不中断工作室展示

## 测试与验收要求

至少覆盖：

- `AGENTS.md` 注入幂等
- 损坏标记块检测
- setup 新建与 takeover 自动注入
- 新增 agent 自动继承且不重复
- 工作室 sidecar 启动、降级和重试
- 状态映射
- `/studio` 路由和顶部 tab 跳转
- 只读工作室隐藏所有写操作入口

## 复杂度评估

复杂度：中等偏上

主要复杂度不在 UI，而在：

- 最小化 vendoring
- Python sidecar 托管
- 幂等注入
- 主进程状态同步边界

## 完成标准

满足以下条件才算 v1 完成：

1. XClaw 启动后能后台尝试拉起工作室 sidecar
2. 聊天页顶部可在 `对话 / 工作室` 间稳定切换
3. 工作室页能展示全局办公室
4. 工作室页只读，不暴露装修与管理操作
5. 主智能体和本地 agent 都能显示在办公室中
6. setup 新建与 takeover 都会自动幂等注入 `AGENTS.md`
7. 新增 agent 会自动继承该规则，且不会重复注册
8. Python 未就绪或 sidecar 启动失败时，XClaw 主功能仍保持可用
