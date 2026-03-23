# Agent 工作台重构测试方案

## 测试目标

确保新版 `Agents` 工作台满足：

- 卡片式浏览清晰可用
- 本地模式在默认窗口下改成单列浏览卡片 + 更宽的右侧 detail workbench
- 右侧 detail workbench 承接真实编辑任务
- 市场安装动线闭环
- 本地头像生成稳定
- 不破坏现有 CRUD、文件编辑与市场安装能力
- 保持 mac / Windows / Linux 共享桌面语法

## 分阶段测试

### 阶段一：工作台骨架

#### 自动化

- `我的 Agents / Agent 市场` 模式切换
- 浏览区卡片渲染
- 默认窗口 `1200 x 800` 下本地模式优先 `1` 列，本地 detail 常驻
- `980 / 1200 / 1500` 三档阈值切换正确
- `management` 分类、扩充后的 `development` 分类以及 58 条种子的中文内容覆盖都必须回归验证
- 市场安装必须在断网/无代理条件下继续可用；安装模板不得依赖运行时网络拉取
- 右侧 detail pane 跟随当前选中项变化
- 空状态与已有数据状态切换
- 本地 deterministic 头像 SVG 输出稳定

#### 手工

1. 打开 `Agents`
2. 在 `我的 Agents` 中确认默认窗口下浏览区优先为 `1` 列卡片，右侧 detail 常驻
3. 在 `我的 Agents` 中选择不同卡片
4. 观察右侧 detail pane 是否同步
5. 切到 `Agent 市场`
6. 观察市场卡片和右侧详情是否同步

### 阶段二：人格文件工作区

#### 自动化

- 文件列表切换
- 读取、编辑、保存
- 上传、新增、重命名、删除
- 未保存变更拦截

#### 手工

1. 选择一个本地 Agent
2. 进入 `人格文件`
3. 编辑 `SOUL.md`
4. 保存
5. 上传一个文本文件
6. 新建/重命名/删除非保留文件

### 阶段三：市场安装

#### 自动化

- catalogue 搜索
- 类别筛选
- 市场摘要与详情字段完整性
- 卡片与详情优先展示 `summary / highlights / detailSections`
- 搜索可命中 `summary / highlights / detailSections`
- `zh / en / ja` 下章节标题与壳层文案不回退成硬编码
- `绑定与运行` tab 切换
- 安装成功
- 安装失败回滚
- 创建后置同步失败回滚
- 安装后置同步失败回滚
- 删除后置 runtime replacement 失败回滚
- Gateway 处于 `stopped` 时，创建/安装仍会把新智能体真实应用到 runtime
- 安装后跳回 `我的 Agents` 并选中新 Agent

#### 手工

1. 打开 `Agent 市场`
2. 搜索一个 Agent
3. 查看详情
4. 点击安装
5. 确认自动切回本地 Agent 区并选中新卡片
6. 切换中文/英文/日文后，确认：
   - 搜索/安装/章节标题等 UI 文案正确切换
   - 若模板无本地化内容，详情继续显示源语言，而不是空白或假翻译

### 阶段四：头像系统

#### 自动化

- 同一 seed 生成相同头像
- 不同 Agent 生成不同头像
- mac / Windows / Linux 下 SVG 输出稳定
- 本地 deterministic 头像组件在主工作台路径下输出稳定

#### 手工

1. 观察本地 Agent 卡片头像
2. 观察市场 Agent 卡片头像
3. 重启应用后确认头像不变
4. 切换主题后确认头像可读性不坏

## 必测边界

- `workspace` 与 `agentDir` 权限边界
- 市场安装失败回滚
- 创建/市场安装不会留下“接口失败但配置已落盘”的脏状态
- 删除不会留下“接口失败但智能体配置已删除”的脏状态
- 非主智能体的工作区文件列表不能暴露与 `main` 完全一致的继承 bootstrap 文件
- 智能体设置弹窗模型选择器不应暴露浏览器滚动条
- unknown agent 不会创建 ghost workspace
- symlink workspace root 被拒绝
- mac / Windows / Linux 下卡片密度与 hover 语法不跑偏
- 本地 Agent 卡片列表不得再使用等高白板布局；默认桌面窗口下，卡片高度必须由真实内容决定，不能出现被 `auto-rows-fr` 拉伸出的大片空白

## 验收标准

- 页面第一眼更像桌面 app 的 Agent 工作台，不像后台列表页
- 本地 Agent 浏览是自适应卡片式，默认窗口下优先 `1` 列且 detail 常驻
- 市场浏览是独立卡片式
- 人格文件编辑是主工作区，不是挤在小窗里
- 智能体模型覆盖支持持久化保存，并且只在需要时异步应用到运行时
- 头像稳定、可识别、不联网
- 每个市场模板都具有非空 `headline / summary / highlights / detailSections`
- 市场详情的主要信息来自模板源文件，不再退回目录式元数据
- 国际化支持的真实边界清楚：壳层本地化，内容层允许源语言可信回退
- `<980px` 时 detail 改成覆盖式/切换式承接，而不是硬挤

## 当前已通过的最小回归

- `tests/unit/agents-page.test.tsx`
- `tests/unit/agents-workbench-layout.test.tsx`
- `tests/unit/agent-avatar.test.tsx`
- `tests/unit/agent-market-seed.test.ts`
- `tests/unit/agent-market-copy.test.ts`
- `tests/unit/runtime-refresh-routes.test.ts`
- `tests/unit/agent-config.test.ts`
- `tests/unit/agent-market.test.ts`

当前这三组已经覆盖：

- 新版双模式骨架
- 本地自适应卡片浏览区 / 市场卡片墙基础行为
- 右侧 detail workbench 仍能跟随选中项工作
- `绑定与运行` 已从 overview 中独立出来
- 市场类别筛选不会破坏右侧 detail workbench
- deterministic 头像纯函数与 SVG 渲染
- 右侧 detail 的 `Hero -> Actions -> Tabs` 分层没有因为国际化回退成硬编码页面
- 切换本地 Agent 时保留当前 detail tab，不会打断人格文件工作流
- 每个内置市场模板已经带完整富元数据字段，不再只剩 `role/path`
- 解析层已锁定：本地化覆盖存在时优先使用覆盖；不存在时继续回退到 seed 的真实内容
- 创建/市场安装链的后置 provider sync 与 runtime 应用失败路径已经有自动回滚断言
- 删除链的 runtime replacement 失败路径已经有配置恢复断言
- Gateway 处于停止状态时，创建/安装会先启动 runtime，而不是静默 no-op
- 市场安装已经直接消费 POST 返回的 `snapshot`，不再依赖二次 `fetchAgents()`
- 市场模板现在从仓库内置模板资产读取，不再依赖运行时外网

## 本轮新增验证

- `pnpm exec eslint src/pages/Agents/index.tsx src/components/agents/AgentCardsPane.tsx src/components/agents/AgentLocalDetailPane.tsx src/components/agents/AgentMarketCardsPane.tsx src/components/agents/AgentMarketDetailPane.tsx tests/unit/agents-workbench-layout.test.tsx --max-warnings=0`
- `pnpm exec vitest run tests/unit/agents-workbench-layout.test.tsx tests/unit/agent-market.test.ts tests/unit/agent-market-seed.test.ts tests/unit/agent-market-copy.test.ts --reporter=dot`
- `pnpm run typecheck`
- `pnpm run build:vite`
- `openclaw config validate`

## 本轮补充验证

- `pnpm exec vitest run tests/unit/agents-workbench-layout.test.tsx -t "keeps local agent cards compact instead of stretching them into tall equal-height boards"`
- `pnpm exec eslint src/components/agents/AgentCardsPane.tsx tests/unit/agents-workbench-layout.test.tsx --max-warnings=0`

这轮新增确认了：

- 页头已收成轻工具条，市场模式不会继续暴露全局 `CreateAgentLauncher`
- 页头现在只保留标题与模式切换，创建/安装/刷新动作已经回到各自浏览模式
- 本地 Agent 卡片浏览区回到“搜索 + 自适应卡片浏览区”，不再把市场安装入口重复塞进浏览 rail
- 市场浏览区已经拥有独立的搜索/筛选工具条
- 市场详情区已从“目录 + 安装表单”压回“来源理解 + 安装动作”两段
- `概览` 与 `绑定与运行` 不再重复展示 runtime/path 事实
- 本地 Agent 详情 hero 已把 `开始对话` 锁成唯一主动作，次级动作改为 utility strip
- 市场卡片与详情区已经形成“卡片负责发现，右侧负责安装与判断”的职责分层
- 市场卡片墙已去掉顶部目录 banner，避免再次退回目录/后台语法
- 本地 `概览` 已重排成“左侧主事实 + 右侧 utility / runtime”两栏 detail workbench
- 市场模式在默认桌面窗口下已提前进入双栏，浏览与详情不再等到 `xl` 才同时常驻
- 市场筛选工具条已收成 sticky pane chrome，滚动时不再像普通页面内容一起漂走
- 市场详情已从嵌套双栏改成单列 detail workbench，长介绍不再被 provenance facts 压窄
- 市场卡片已改成摘要优先的桌面商店卡，来源与安装模式回到稳定元信息层

## 本轮继续确认

- 切换本地 Agent 卡片后，当前 detail tab 会继续保留，不会被强制送回 `概览`
- 市场浏览不再按名字字母序硬排成目录，优先保留 catalog 顺序
- 市场卡片不再把 `sourcePath` 这种来源元数据抬成主信息
- 分类过滤继续可用，但首屏只保留主分类 chips，长尾分类收进次级下拉
- 市场卡片当前只保留一个主亮点；来源路径已退到卡片底部次级位
- 市场详情中 `installMode` 已从 hero 主 badge 降为安装语义提示，不再和分类一起抬到第一视觉层
- `我的 Agents` 主浏览区已锁定为自适应 `1/2/3` 列卡片浏览区，不再回退成单列资源卡
- 右侧 detail hero 现在把“开始对话”作为第一主动作，页面重心从“维护记录”转回“使用 Agent”
- `summary / highlights / detailSections` 已接进市场卡片、详情和搜索链路
- 内容层国际化当前采用“locale key 覆盖 + 源语言回退”策略，没有硬做假翻译
- 中文环境下，`Agent 市场` 卡片与详情已优先读取受控中文内容资产；当内容资产缺失时才回退到原始 seed 内容
- 本地模式浏览区的搜索壳层文案已对齐为 `搜索智能体、模型、工作区`
- 本地卡片区不再重复展示模型信息；右侧 `概览` 中的频道管理入口已回到频道摘要卡头部
- 本地卡片区已去掉底部重复频道 pill，只保留单条轻摘要
- 本地详情 hero 现在只保留唯一主动作 `开始对话`，其余动作都下沉成次级 utility strip
- `概览` 里的 runtime/path 事实已退出首屏主内容，避免继续做成 inspector
- 人格文件编辑区的保存与文件操作已并回编辑器顶部，编辑器本身成为主工作区
- 市场卡片底部第三信息位已从来源路径改成亮点摘要，不再像目录卡
- 市场详情首屏已调整成“理解模板 -> 执行安装”，来源证据下沉到最后一段
- `Agents` 页头与 `本地 / 市场` 模式切换已进一步压紧，避免页头比工作区更重
- 本地卡片与 detail pane 的内边距、圆角和高度节奏已继续对齐，不再一边松一边紧
- 默认窗口下，本地模式已改成单列浏览卡片 + 更宽的右侧 detail pane
- `概览` 事实卡在默认窗口不再强制三列，避免模型/频道文案错位
- 本地 detail hero 已改成“身份 + 主动作 + 轻事实网格”，默认窗口下不再因为长标题和主按钮并排而挤坏
- 人格文件区的编辑器 chrome 与文本区层级已继续靠近真正的桌面编辑器工作区
- 市场卡片与详情区的边界、阴影和信息节奏已继续统一，避免“卡片墙像目录、详情像后台 inspector”
- 智能体设置弹窗现在支持：
  - 搜索可用模型
  - 回退默认模型
  - 保存后持久化 `modelRef`
  - 仅模型变更时请求后台异步 runtime refresh
- 新建智能体弹窗现在支持：
  - 搜索可用模型
  - 在同名模型之间按 provider label/hint 区分来源
  - 保存完整 `modelRef`，而不是只保存裸模型名
  - 回退默认模型时不写 agent 级覆盖
- 智能体设置弹窗已去掉头部说明与模型常驻解释，默认只保留一个模型主编辑面和一个轻只读的智能体 ID 区，避免再次回退成后台说明卡
- 市场模板安装已切换到仓库内置模板内容，安装链不会再因为 GitHub raw 不可达而中断
- 创建/市场安装在后置 provider sync 或 runtime 应用失败时会自动回滚，不再留下脏配置
- `openclaw config validate` 已通过，当前本机 `~/.openclaw/openclaw.json` 仍是有效配置
- 当前 `pnpm run typecheck` 仍被仓库既有的 `src/stores/cron.ts` 空值错误阻塞，这一项与智能体链路改动无关
