# Setup OpenClaw 全面接管引导

## 问题背景

XClaw 当前将安装引导视为一次全新的首次使用流程。它不会在进入正常设置前明确检测本地是否已经存在可用的 OpenClaw 安装，也不会帮助用户判断应该“接管现有安装”还是“以 XClaw 的方式重新初始化”。

这会带来三个问题：

- 用户已经有 `~/.openclaw` 时，不清楚 XClaw 会复用、覆盖还是忽略现有配置
- 端口冲突要等到后续网关启动阶段才暴露，反馈太晚
- 现有实现更偏向“XClaw 本地 store 驱动 OpenClaw 运行时”，无法把已有 OpenClaw 反向还原成完整的 XClaw 产品状态

## 本轮设计结论

产品方向已经明确：这次不是做“运行时复用”，而是做“全面接管”。

“全面接管”的含义必须是：

- 用户确认前，XClaw 对现有 `~/.openclaw` 保持只读
- 用户确认后，XClaw 将现有 OpenClaw 运行时状态导入为可用的 XClaw 产品状态
- 接管完成后，Chat、Agents、Channels、Skills、Provider Settings 等核心页面可以直接使用，而不是只做到“Gateway 还能跑”
- 后续如果用户在 XClaw 外部修改了 `~/.openclaw`，XClaw 还能做增量回收同步，而不是再次失真

如果不满足以上四点，就不能对外叫“全面接管”。

## 目标

- 在正常 setup 流程开始前，检测本地现有 OpenClaw 状态
- 明确给用户两个选择：
  - 全面接管现有安装
  - 以 XClaw 方式新建配置
- 在“新建”模式下允许用户配置：
  - 默认工作区目录
  - 网关端口
- 在“全面接管”模式下恢复以下能力：
  - provider 账户与默认项
  - provider 密钥 / OAuth 状态
  - workspace、skills、extensions、agents、channels 的可用状态
  - setup 完成态与后续正常启动路径
- 尽早展示冲突信息，尤其是网关端口占用情况

## 非目标

- 不在 v1 支持将整个 OpenClaw 根目录从 `~/.openclaw` 迁移到别处
- 不在 v1 处理任意第三方自定义插件布局迁移
- 不在 v1 支持多 profile 接管
- 不做无提示的静默接管
- 不在 v1 承诺支持所有未知第三方 provider 的完美反向导入

## 产品决策

### 决策 1：本功能按“全面接管”设计

不再保留“只做运行时接管也可以”的产品口径。

### 决策 2：OpenClaw 是运行时主事实源

接管完成后：

- `~/.openclaw` 仍然是运行时主事实源
- XClaw 的本地 store 改为“派生索引与 UI 缓存”，不是比 OpenClaw 更高优先级的主事实源

### 决策 3：安装目录在 v1 仍定义为默认 workspace

原因不变：

- 当前代码中大量逻辑直接假设根目录是 `~/.openclaw`
- 默认 workspace 已可通过 `openclaw.json` 表达
- 可以先把最有价值的接管能力做成，而不是同时引入整套根目录抽象改造

### 决策 4：macOS 与 Windows 是发布红线

这个功能不能按“先支持一个平台，再补另一个平台”的心态推进。

v1 的最低发布门槛是：

- macOS 全链路可用
- Windows 全链路可用
- 两端都完成 takeover、新建、回滚、重启、漂移回收测试

如果任一平台未通过，这个功能就不能视为完成。

## 全面接管的完成标准

只有同时满足以下条件，才算“全面接管完成”：

1. 用户确认前，XClaw 不会改写现有 `~/.openclaw`
2. 接管完成后，Provider 页面能看到已导入账户、默认项和认证状态
3. 接管完成后，Chat / Agents / Channels / Skills / Settings 不需要用户重新从零配置
4. 接管完成后，XClaw 会记录 setup 完成态和 takeover 元数据，不再重复进入 setup
5. 接管失败时，XClaw 能回滚自己新增的本地状态，并且不把 OpenClaw 留在半迁移状态
6. 之后外部修改 OpenClaw 时，XClaw 能检测漂移并做增量回收同步
7. macOS 与 Windows 都完成同等级验收，不能只在单端通过

## 方案选择

### 方案 A：只读检测 + 运行时接管

优点：

- 开发量较小

缺点：

- 不符合“全面接管”
- Provider、默认项、setup 状态仍然断层

结论：

不接受。

### 方案 B：只读检测 + 全量导入 + 单次接管

优点：

- 首次接管效果完整

缺点：

- 后续如果用户用 CLI 或其他工具改动 `~/.openclaw`，XClaw 又会失真

结论：

不够。

### 方案 C：只读检测 + 全量导入 + 持续回收同步

优点：

- 真正符合“全面接管”
- 接管后长期一致性更好

缺点：

- 设计和实现都更重

结论：

采用该方案。

## 总体架构

### 1. 启动保护层

在 setup 未决前，主进程必须进入只读检查模式。

必须显式挂起的行为包括：

- 自动安装内置技能
- 自动安装预置技能
- 自动安装或升级 bundled plugins
- 自动合并 XClaw workspace context
- Gateway 自动启动
- 任意会写入 `openclaw.json`、`auth-profiles.json`、`skills/`、`extensions/` 的修复逻辑

这是整个设计的前置条件。如果没有这层保护，“全面接管”在产品上不成立。

### 2. 检测层

主进程提供只读 inspection 能力，读取并汇总：

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/*/agent/auth-profiles.json`
- `~/.openclaw/agents/*/agent/models.json`
- `~/.openclaw/skills`
- `~/.openclaw/extensions`
- workspace 路径
- 当前网关端口占用情况
- 当前环境是否已有 XClaw 痕迹

### 3. 迁移计划层

inspection 结果不能直接执行，必须先生成 takeover plan，供 UI 展示和用户确认。

plan 至少要回答：

- 将导入哪些 provider 账户
- 默认账户是谁
- 哪些认证能完整导入
- 哪些认证存在冲突或降级
- 哪些 OpenClaw 目录会继续复用
- 确认后 XClaw 会追加写入哪些资源

### 4. 备份与提交层

用户确认后，不是直接散写，而是按“备份 -> 导入 -> 标记完成 -> 放开启动副作用”的顺序执行。

### 5. 持续回收同步层

接管完成后，XClaw 需要在后续启动或关键页面初始化时，对 OpenClaw 做轻量漂移检测：

- provider 列表是否变化
- 默认模型 / 默认 provider 是否变化
- auth-profiles 是否变化
- workspace / skills / extensions 是否变化

检测到变化后，更新 XClaw 派生状态，但不要重新跑 setup。

### 6. 平台兼容与并发保护层

这一层专门处理 takeover 期间最容易被忽略的问题：

- 外部 Gateway 正在运行
- OpenClaw CLI 或其他工具正在改写配置
- Windows 文件锁、杀毒扫描、慢 I/O
- 路径规范化差异导致的重复目录识别

## 状态机设计

建议新增 setup bootstrap 状态机：

1. `readonly-inspection`
2. `takeover-review`
3. `takeover-backup`
4. `takeover-import`
5. `takeover-commit`
6. `runtime-verify`
7. `provider-review-if-needed`
8. `installing`
9. `complete`

说明：

- `provider-review-if-needed` 是条件步骤
- 如果 provider 全量导入且认证完整，可自动跳过该步骤
- 如果存在冲突或不支持导入的 provider，则进入只读提示 + 修正入口

在 `takeover-backup` 前必须再插入一个隐式检查：

- `runtime-freeze-check`

用途：

- 检测外部 Gateway 是否仍在运行
- 检测配置文件是否在短时间内持续变化
- 若环境不稳定，则先要求用户停止外部写入源，再继续 takeover

## 全面接管范围

| 能力 | OpenClaw 现状 | XClaw 现状 | 全面接管要求 |
|---|---|---|---|
| 主配置 | `openclaw.json` | 已直接复用 | 保持复用 |
| Agents | `agents/*` | 已直接复用 | 保持复用 |
| Auth Profiles | `auth-profiles.json` | 已能写入，未系统导入 | 需要反向导入 |
| Workspace | `agents.defaults.workspace` 等 | 已直接复用 | 保持复用 |
| Skills | `~/.openclaw/skills` | 已直接复用 | 保持复用并延后 XClaw 追加安装 |
| Extensions | `~/.openclaw/extensions` | 已直接复用 | 保持复用并延后 XClaw 追加安装 |
| Channels | 主要在 `openclaw.json` | 基本复用 | 需验证页面完全可用 |
| Provider 账户 | 运行时可推断 | 当前主要存在 XClaw store | 需要全量导入 |
| Provider 默认项 | 模型前缀可推断 | 当前主要存在 XClaw store | 需要导入 |
| Provider 密钥 / OAuth | `auth-profiles.json` 可读 | 当前主要存在 XClaw secret-store | 需要导入 |
| Setup 完成态 | OpenClaw 无该概念 | 当前在 renderer persist | 需要迁入主进程 settings |
| XClaw UI 偏好 | OpenClaw 无该概念 | XClaw 本地状态 | 不接管，但需初始化默认值 |

## Provider 全量导入设计

### 数据源

Provider 导入不能只看一个地方，至少要联合读取：

- `openclaw.json` 的 `models.providers`
- `openclaw.json` 的 `plugins.entries`
- `agents.defaults.model.primary`
- `auth-profiles.json`
- 必要时读取 `models.json` 作为补充

### 导入目标

导入后要补齐：

- `providerAccounts`
- `defaultProviderAccountId`
- `providerSecrets`
- 旧兼容字段 `providers` / `apiKeys`

### 账户映射规则

1. 以运行时 provider key 作为源标识
2. 推导 XClaw `vendorId`
3. 生成稳定 `accountId`

建议规则：

- 单账户 provider：`accountId = vendorId`
- 多账户 provider：`accountId` 使用稳定映射，基于运行时 provider key 生成，而不是每次随机生成
- `google-gemini-cli` 映射为 `google` + `oauth_browser`
- `openai-codex` 映射为 `openai` + `oauth_browser`
- `ollama` 映射为 `ollama` + `local`
- `custom-*` 保留为 `custom`

### 认证导入规则

#### API Key

如果 `auth-profiles.json` 中 profile 为 `type = api_key`：

- 导入到 XClaw secret-store
- `authMode = api_key`
- `hasKey = true`

#### OAuth

如果 `auth-profiles.json` 中 profile 为 `type = oauth`：

- 导入 access / refresh / expires 等信息到 XClaw secret-store
- 根据 provider 类型推断 `authMode = oauth_device` 或 `oauth_browser`
- Settings 页面直接显示为已登录状态

#### Local

如果 provider 是本地运行时，例如 Ollama：

- `authMode = local`
- 不要求密钥

### 默认账户导入

默认账户来源优先级建议为：

1. `agents.defaults.model.primary` 的 provider 前缀
2. 若缺失，则使用 inspection 中唯一已启用且有认证的账户
3. 若仍无法确定，则进入 `provider-review-if-needed`

### 冲突策略

以下情况不能静默吞掉，必须在 plan 中标出：

- 同一 provider 在不同 agent 的 `auth-profiles.json` 中密钥或 token 不一致
- `openclaw.json` 存在 provider 配置，但 `auth-profiles.json` 缺认证
- XClaw 本地已有旧 provider store，且与现有 OpenClaw 不一致

建议策略：

- 以 `main` agent 为主源
- 若发现多 agent 冲突，标记为 `conflict`
- 接管仍可继续，但 `provider-review-if-needed` 必须展示冲突说明

## 接管提交设计

### 备份内容

接管前先备份：

- `openclaw.json`
- 全部 `auth-profiles.json`
- XClaw `settings`
- XClaw `XClaw-providers` store

备份路径建议写入 XClaw 自己的数据目录，而不是写回 `~/.openclaw`。

### 原子性要求

接管相关写入必须尽量按原子方式进行：

- 先写临时文件，再替换正式文件
- 先写 XClaw 本地 store，再切换 setup 状态
- 不允许出现“setup 已完成，但 provider store 只导了一半”的中间态

Windows 上要额外考虑文件被占用或替换失败的情况，失败时要停留在可恢复状态。

### 提交顺序

1. 写入备份
2. 导入 Provider 派生状态到 XClaw 本地 store
3. 写入主进程 setup / takeover 元数据
4. 切换应用到正常启动模式
5. 再放开技能安装、插件安装、workspace context 合并、Gateway 自动启动

### 回滚策略

如果步骤 2 或 3 失败：

- 恢复 XClaw 本地 `settings`
- 恢复 XClaw `XClaw-providers` store
- 不放开启动副作用
- 不把 setup 标记为完成

如果接管前保持了只读模式，OpenClaw 本身通常无需回滚，因为确认前不会被写入。

### 外部进程策略

接管前如果检测到已有 OpenClaw Gateway 正在运行：

- 如果只是端口被已有 Gateway 占用，先识别它是否属于当前 `~/.openclaw`
- 如果属于当前环境，提示用户“接管时将临时停止现有 Gateway，再由 XClaw 接管启动”
- 如果无法确认归属，默认阻止自动 takeover，要求用户手动处理

这个策略必须在 macOS 和 Windows 上都成立，不能只在 Unix 路径上想当然。

## 接管后的持续同步

这是“全面接管”和“只做一次导入”的最大区别。

需要新增一个非阻塞 reconciler：

- 比较 `openclaw.json` 摘要
- 比较 `auth-profiles.json` 摘要
- 比较 provider 列表和默认项
- 检测到变化时，刷新 XClaw 派生状态

同步原则：

- OpenClaw 仍然是运行时主事实源
- XClaw 本地 store 只做投影，不应反向压过用户在外部的真实修改

### 漂移检测粒度

建议至少比较以下 fingerprint：

- `openclaw.json` 内容摘要
- 所有 `auth-profiles.json` 内容摘要
- 默认 workspace 路径摘要
- skills / extensions 目录清单摘要

Windows 上路径比较必须先规范化：

- 盘符统一大小写
- 分隔符统一
- 真实绝对路径优先

否则很容易把同一路径识别成两个不同 workspace。

## 设置持久化设计

### 主进程 settings 需要新增

- `setupComplete`
- `setupMode`：`fresh` | `takeover`
- `takeoverCompletedAt`
- `takeoverSourceDir`
- `takeoverFingerprint`
- `takeoverVersion`

### gatewayPort

这次设计里仍要把 `gatewayPort` 纳入 setup，但必须先承认当前代码链路未完全打通。

已知问题包括：

- Gateway manager 默认端口仍来自常量
- 部分 IPC / API fallback 仍写死 `18789`
- 主进程网关相关 header 放宽规则也写死 `18789`

因此在实现前，必须先把端口从“配置项”升级为“全链路可解析值”。

## Setup 页面改造建议

当前 `src/pages/Setup/index.tsx` 是固定五步的线性流程，无法承载条件步骤和全量导入状态。

建议改为条件化步骤流：

- `environment-discovery`
- `takeover-review` 或 `welcome`
- `takeover-migrating`
- `runtime`
- `provider-review-if-needed`
- `installing`
- `complete`

其中：

- 已有 OpenClaw 且用户选择接管：走 `takeover-review -> takeover-migrating`
- 新用户：走 `welcome`
- 接管成功且 provider 无冲突：跳过 `provider-review-if-needed`

## 平台红线清单

这是发布阻断项，不是建议项。

### macOS 必须验证

- 首次启动时只读检查不改写现有 `~/.openclaw`
- takeover 过程中如存在历史 `launchctl` Gateway，不会误判或误杀错误进程
- 工作区路径支持 `~/...`
- 接管后重启应用不会重新进入 setup

### Windows 必须验证

- 首次启动时只读检查不改写现有 `%USERPROFILE%\\.openclaw`
- takeover 过程中端口检测、`taskkill`、等待端口释放逻辑稳定
- 路径校验覆盖盘符、大小写、反斜杠、保留名称、权限失败
- 接管导入在 Defender 扫描或慢 I/O 下不会进入半完成状态

### 共通发布门槛

- takeover 成功路径通过
- takeover 冲突路径通过
- takeover 回滚路径通过
- takeover 后漂移回收路径通过
- 新建路径不回归

## 平台兼容性要求

本功能必须同时覆盖 macOS 和 Windows。

显式要求：

- OpenClaw 根目录统一按 `homedir()/.openclaw` 解析
- 端口占用检测分别适配：
  - macOS：`lsof`
  - Windows：`netstat -ano` / `findstr`
- 孤儿网关清理分别适配：
  - macOS：可能涉及 `launchctl`
  - Windows：需要 `taskkill`
- 工作区路径输入校验必须覆盖 Windows 盘符、保留名称、反斜杠路径和权限失败
- 所有 inspection / import / sync 逻辑都应避免同步 I/O 卡住主线程，尤其是 Windows

## 尚未覆盖的实现风险提醒

虽然设计已经收紧，但实现前仍有三个地方需要先清障：

- 当前主进程存在多处启动即写入 `~/.openclaw` 的逻辑
- 当前 Provider 体系仍是“XClaw store -> OpenClaw runtime”主导，需要补完整的反向导入路径
- 当前 Gateway 端口链路仍有多处固定 `18789` 的实现点

这三个问题不先处理，macOS / Windows 双端都很难做出可靠的 takeover 体验

## 接管确认文案要求

确认页必须明确告诉用户：

- XClaw 将继续使用你现有的 `~/.openclaw`
- 接管完成后，XClaw 会把现有运行时状态恢复成自己的产品状态
- 确认后，XClaw 可能向 `skills/`、`extensions/` 和 workspace 中追加自己的资源
- 如果发现多 agent 认证冲突或不支持导入的 provider，XClaw 会标记并要求你补充确认

## API 设计

计划新增：

- `GET /api/app/setup-inspection`
  - 返回本地 OpenClaw 检测结果、端口冲突信息、provider 导入摘要、漂移摘要
- `POST /api/app/setup-plan`
  - 根据 inspection 结果生成 takeover plan
- `POST /api/app/setup-apply`
  - 应用用户选择的新建或接管动作
- `POST /api/app/takeover-import`
  - 执行备份、导入、提交
- `GET /api/app/takeover-status`
  - 返回导入进度与冲突信息

## 风险

- 如果不先加只读检查模式，首次启动就可能改写现有 `~/.openclaw`
- Provider 反向导入需要统一 runtime provider key 与 XClaw vendorId 的映射，规则设计不好会导致重复账户或错误默认项
- 当前端口链路仍存在多处 `18789` 写死点，端口保真会影响接管可信度
- 接管后如果没有持续回收同步，外部修改 OpenClaw 仍会让 XClaw 失真
- Windows 上路径权限、端口释放时序和防病毒软件扫描都会放大启动卡顿与竞态

## 默认实现假设

为避免设计长期停留在待确认阶段，当前先采用以下默认策略推进：

### 未知第三方 provider

- 如果能从 `models.providers` 中提取出 `baseUrl` 和 `api`，则导入为 `custom`
- 如果元数据不足以构造成 `custom`，则保留为只读外部 provider 记录，并在 `provider-review-if-needed` 中展示

### 多 agent 认证冲突

- 不阻塞整体接管
- 以 `main` agent 作为主源导入
- 将冲突 provider 标记出来，并在 `provider-review-if-needed` 中要求用户确认或修正

### takeover reconciler 触发时机

- 每次应用启动时只做轻量 fingerprint 检查
- 检测到漂移后，再在相关页面初始化时执行增量刷新

这个策略兼顾启动性能和一致性，适合作为 v1 默认实现。
