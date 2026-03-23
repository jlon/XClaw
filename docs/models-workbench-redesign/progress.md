# 模型工作台重构进度

## 当前状态

- [x] 完成当前 `/models` 页面结构 review
- [x] 确认当前页面本质上是“provider 设置页 + token 报表”纵向拼接
- [x] 确认 `ProvidersSettings` 当前仍是网页 settings row 语法，不适合直接改成工作台卡片板
- [x] 确认当前 token 区只有轻量条形图和分页明细，不具备桌面分析面板层级
- [x] 输出“模型工作台”重构方向
- [x] 明确 provider 卡片板、provider inspector、token intelligence 的职责边界
- [x] 明确默认窗口和超宽窗口的布局策略
- [x] 完成设计文档、测试文档、问题文档、进度文档初始化
- [x] 完成 3 轮子代理 review，并把信息架构、图表边界、默认窗口模式约束回写到设计文档
- [x] 完成 Task 1：落地 workbench contract 纯函数层
- [x] 完成旧版 Task 1 落地：将 contract 接入现有 `/models` 首屏，补齐 Provider Board、KPI 和运行时过滤闭环
- [x] 完成旧版 Task 2 落地：新的 `/models` 顶层信息架构、页头、KPI 和 Provider Board
- [x] 完成 Task 3：从 `ProvidersSettings` 抽出共享 provider 表单 section
- [x] 完成 Task 4：Provider Inspector 的查看态 / 编辑态 / modal-pane 承载
- [x] 完成旧版 Task 5 落地：升级 token 区为 KPI + 主趋势图 + ranking + 明细
- [x] 完成 Task 6：接通 focused 规则、反向跳转和超宽增强布局
- [x] 完成 Task 7：补齐模型工作台专属验证并同步文档
- [x] 建立 provider 与 token 的共享过滤态
- [x] 补齐 Task 3 的共享表单 section 回归，确认旧 `ProvidersSettings` 和 `/models` inspector 复用同一套字段编辑逻辑
- [x] 修正共享表单 section 与 `/models` inspector 的校验函数绑定边界，避免把 store 的三参签名泄漏进通用组件
- [x] 完成 `Tokens / Cost` 主指标切换、SVG 主趋势图、breakdown ranking、最近请求面板
- [x] 完成从 breakdown / 最近请求反向切换 provider，并锁住默认态 / 聚焦态 / 超宽态契约
- [x] 完成 README 三语文案复核并同步“模型工作台”定位
- [x] 用户已完成对二次收敛方向的确认：`Provider First + 聚焦配置态 + 次级分析区`
- [x] 已将“首屏先看 provider、单击卡片直接进入配置聚焦态并联动过滤分析”回写到设计文档
- [x] 已修正文档里残留的旧状态键、旧断点语义和“分析优先聚焦态”表述
- [x] 完成二次收敛首批实现：`Provider First` 页头语义、真实 board clamp、compact 摘要带、超宽 rail 阈值修正
- [x] Provider 卡片退出网页式大按钮堆叠，改成资源入口卡片 + inspector 次级动作
- [x] `/models` 浏览器 fallback 已修复，不再因为 `window.electron.platform` 缺失直接崩溃
- [x] Provider Inspector 的 desktop modal / pane 承载已稳定，补齐基础可访问性
- [x] Provider Inspector 已补齐同一 runtime provider 下的多账号显式切换，不再把“当前聚焦的是哪一个账号”藏在隐式排序里
- [x] breakdown / 最近请求点击到已失效 provider 时，页面会保留当前状态并提示用户，不再静默清空或跳到空状态
- [x] 本轮测试策略已收紧：只补真实行为契约，不再继续堆叠低价值样式断言
- [x] `/models` 现在会在挂载时主动刷新 provider snapshot，不再依赖先进入 Settings/Setup 才能看到已存在的 provider
- [x] 默认态 Provider Board 的重复区块标题已收掉，首屏回到“页头 + 内容面板”的单层信息结构

## 本轮结论

- “做成一个完整工作台”是合理的，但前提不是把 provider 和 token 机械地 `50 / 50` 并列
- 正确方案是把页面定义成“模型控制台”：provider 管理是入口，token intelligence 是分析支撑，两者通过共享状态形成闭环
- provider 列表必须退出内联展开编辑，否则卡片板和自适应布局都会失败
- token 图表不宜直接引重库，v1 先走轻量 SVG，自绘即可满足桌面感和 KISS
- SVG 方案成立，但前提是锁住 `2` 类图表、provider runtime key 映射、`all` 窗口聚合上限和默认态首屏高度红线
- 用户最新反馈已经进一步收敛了首屏优先级：provider 必须先于 token intelligence，当前大号 KPI 卡和首屏 dashboard 表达属于错误方向
- `/models` 后续实现将直接对齐 `Channels / Skills` 的桌面化语法：入口板优先、聚焦态工作区、inspector 连续面板、卡片操作降级
- provider 卡片的主行为已确定为“直接进入配置聚焦态并联动过滤分析”，不再只做 scope 过滤
- Task 1 的 review 闭环已经完成：runtime key 汇总语义改为 provider 级，不再把多账号汇总静默挂到单账号上；`/models` 现有页面也真实消费了这些 contract，而不是只给测试用
- Task 3/4 已经形成真实闭环：provider 编辑逻辑不再只埋在旧 `ProvidersSettings` 里，而是通过共享表单 section 进入 `ProviderInspector`
- `/models` 当前已经具备 `view / edit` 两种 inspector 模式，以及 `modal / pane` 两种承载方式
- `/models` 现已拥有独立的 Add Provider Dialog，不再需要展开旧 `ProvidersSettings` 作为保底入口
- 共享 section 这轮已经经过实际构建和类型检查，不是“抽了个文件但 `/models` 接不上”；`ProvidersSettings` 和 `ProviderInspectorEditor` 都能通过同一套 `onSave / onValidateKey / onCancel` contract 工作
- 旧版 Token Intelligence 已完成 `KPI + 主趋势图 + breakdown + 最近请求` 的桌面化收口，并支持 `Tokens / Cost` 双指标切换，但这版首屏优先级已被二次收敛推翻
- `/models` 已形成稳定闭环：Provider Board 选择、breakdown 点击、最近请求点击都会回写同一套 provider 过滤态
- `ultrawide` 下页面与 Token Intelligence 的布局契约已对齐，不再出现页面进入超宽态但图表仍停留在堆叠布局的错位
- README 三语文案已同步更新为“模型工作台 / provider 卡片 / token intelligence”的实际定位
- 二次收敛后的首屏已经回到“Provider 入口板在前，Token Intelligence 在后”的桌面工作台语义，旧的 `当前范围 + 巨大 KPI 头图` 方向被实装层面替换掉了
- `maxVisibleRows` 不再只是测试用属性，Provider Board 在默认态会真实 clamp 到两行，避免继续把主图挤出首屏
- KPI 摘要带已从“活跃提供商”改成“请求数”，减少 provider 身份被 dashboard 指标拆散的问题
- Provider 卡片主点击现在只承担“进入聚焦配置态”，次级管理动作回到 inspector，网页 settings row 感明显下降
- 浏览器 fallback、ultrawide rail 和共享 dialog/sheet 这三条隐藏问题已闭环，避免页面在非 Electron 或超宽宽度下出现假模式/假能力
- 同一 provider scope 下的多账号歧义已经收口：inspector 头部会显式展示账号切换位，切换账号时右侧配置面板同步切换，但下方分析仍保持同一 runtime provider scope
- 历史 usage 指向“当前已不存在的 provider”时不再偷偷把焦点清掉，而是保留当前工作台状态并给出明确提示
- 当前验证策略改成“少而硬”的契约测试：多账号切换、失效 provider 退化、类型和构建通过优先；不再继续添加纯 className/纯层级型前端测试
- `/models` 的 provider 数据链已经自洽：页面自身会在挂载时拉 snapshot，不再出现“实际有 provider，但模型页显示空态”的错位
- 首屏默认态的信息层级已进一步去重，Provider Board 不再重复解释页头已经讲过的内容
- Provider 卡片现已改成整卡可点击，footer 与留白区域不再丢点击热区
- Provider Inspector 编辑态已切到更宽的桌面模态，并启用 inspector 专用高密度表单布局，默认场景下滚动条显著减少
- `/models` 相关类型边界已补齐，`workbench-view-model` 不再把宽泛 `string` 直接传给 provider metadata helper
- 中等宽度的 `drawer` 设计已被删除，默认桌面窗口统一使用宽 `modal`，只有超宽态才切到常驻 `pane`
- Provider Inspector 查看态已从单列堆叠卡片压成双列信息板，编辑态也改成“前两组并排、长内容跨列”的更高密度 inspector 结构
- Provider Inspector 的“当前范围”冗余子卡已删除，当前 provider 身份、默认态和凭证态统一收口到 inspector 头部
- compact 编辑表单已切到 `items-start + auto-rows-min`，基础信息区不再被接入配置区错误拉高
- 回退策略已改成桌面 pane 式摘要行，折叠态不再占满整块大卡
- `/models` inspector surface 已改为优先复用 `global-theme-refresh` 的 `app-modal-surface / app-pane-surface / app-insight-surface / app-field-surface`
- `pnpm run typecheck` 已恢复通过，不再有 `/models` 这条链或其他存量类型错误阻塞
- Token Intelligence 头部已压成桌面 pane header：紧凑摘要带、主指标切换、时间窗口共用同一层轻 substrate
- breakdown 已退出“每条一个网页卡片”的报表语法，改为更轻的资源行 + 细条进度表达
- 最近请求已从多张列表卡改成单 pane 内部资源行，分页按钮改为桌面工具按钮
- compact 编辑态已把“基础信息 + 接入配置”合并为单一 setup pane，顶部多余边线与独立文档行已删除
- Provider Board 卡片已改成更高密度的资源板：去掉 `label === runtime key` 的重复副标题，收掉由固定最小高度撑出的空白区，并把 usage facts 与 utility 行压回同一张卡片
- Provider Board 卡片图标已切回真实 provider logo，并统一回到中性桌面壳；不再通过粉橙/品牌色壳体制造存在感
- `Qwen / OpenRouter / Google` 已切到官方公开彩色图标资源；`OpenAI / Anthropic / Custom` 等仍保持中性单色品牌语法，不再用 tinted shell 伪造彩色识别
- 已按 `workbench-style-unification` 启动 `/models` 专项收口，不再把图标或单张卡片当成主矛盾
- 这一轮确认 `/models` 的主偏差集中在三块：`Provider Board` 仍有浏览卡片墙语法、`Inspector` 仍有多卡叠层、`Token Intelligence` 仍残留报表页语法
- Provider Board 现已继续收成桌面资源板：图标壳缩小、身份与状态压回同一层、usage facts 与 utility 行进一步减重
- Provider Inspector 查看态已从“四张信息卡”压成单一事实 pane + utility footer，编辑态与查看态的首层结构更接近桌面 inspector
- Token Intelligence 现已继续退出双层摘要壳：摘要带、主指标切换、时间窗口共用一层 header；breakdown 与最近请求都已改成分隔资源行，而不是卡片列表
- Add Provider Dialog 已退出“先选 provider 再进入下一步”的列表向导，改成宽桌面模态：左侧固定 provider 网格卡片，右侧固定紧凑配置 pane，默认桌面窗口下不再把主要流程压进窄滚动抽屉

## 下一步

- 继续评估 Token Intelligence 的色板在深色主题下是否还需要进一步收敛
- 视需要补一条 `/models` 空 provider 态与 Electron 实机态的手工 smoke 记录
- 继续检查 Add Provider Dialog 是否仍残留网页 settings 语法，必要时按 `WU-02 / WU-03` 再收一轮
