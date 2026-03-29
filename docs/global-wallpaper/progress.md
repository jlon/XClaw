# 全局壁纸进度

## 当前状态

- 已确认产品目标：整窗统一壁纸，不是卡片局部背景
- 已确认首版范围：主应用壳层全域生效，setup 不纳入
- 已确认首版交互：开关、上传、清除、透明度
- 已完成首版实现：主进程托管、设置入口、整窗渲染与半透明壳层联动已接通
- 已完成第二轮壳层收口：桌面页改为共享单一 shell material，标题栏独立 drag overlay 已移除
- 已完成关键体验修复：右上角功能按钮恢复可点击，顶部/底部分层背板已合并，侧栏不再整块遮住壁纸
- 已完成第三轮材质微调：整窗玻璃层、面板、输入框、标题栏按钮和激活导航项改为更明确的玻璃高光与景深表达
- 已完成一轮 Electron 实机截图验收：聊天主界面已确认不存在明显的顶底色阶断层，侧栏和标题栏均可透出壁纸
- 已修复侧栏底部 utility 区硬边框泄露：`设置` 入口上方硬分隔线已移除，侧栏右边界改为更轻的语义化 chrome divider
- 已完成聊天页阅读层收口：聊天主舞台新增中性 `reading plane`，助手消息回退为文档流表达，composer 改为聊天专属玻璃材质
- 已完成聊天侧栏头部三次收口：titlebar 左槽位仅保留会话控制，品牌与搜索均已回到 pane 顶部
- 已完成设置页补齐：`网关` 与 `更新` 分区已移除私有硬编码面板底色，统一接入桌面壁纸 surface token
- 已完成工作台第二轮收口：`Models / Agents / Channels / Skills / Cron` 的主 pane、主卡片、检索条和关键 toggle 已补齐共享 surface token
- 已完成工作台第三轮收口：频道账号行、Agent 详情空状态、模型卡片次级 badge、技能页 tab shell 与搜索/空状态已补齐次级 surface token
- 已完成聊天过程层第一轮收口：参考 `qclaw` 的轻时间线表达，`thinking / tool status / tool calls` 已统一并入单一 process rail
- 已完成聊天滚动路径减负：消息过程层移除 `content-visibility` 提示与逐条玻璃模糊，避免滚动时反复触发布局与重绘抖动
- 已完成聊天主区颜色收口：侧栏与侧栏标题区进一步压暗，主区 veil 改为更均匀的轻提亮，composer 继续减边框和阴影，整体更接近 `qclaw` 的明暗层级但仍保持全局壁纸连续性
- 已完成聊天主区亮度再校准：主阅读区已改成更接近 `qclaw` 的整片中性白 veil，侧栏继续降低存在感，聊天主区的视觉重心更明确，同时不破坏整窗壁纸连续性

## 实施清单

- [x] 扩展 settings 与 public settings 字段
- [x] 新增主进程壁纸导入/清除路由
- [x] 在 `Settings > Appearance` 增加壁纸控制区
- [x] 在 `MainLayout` 增加全局 wallpaper layer
- [x] 调整 sidebar / titlebar / workspace 在壁纸模式下的半透明材质
- [x] 补最小验证
- [x] 将标题栏、侧栏、工作区收敛到统一桌面壳层材质
- [x] 去除会吞掉 mac 标题栏控件交互的独立 drag bar
- [x] 将标题栏右侧工具按钮收敛到共享玻璃按钮表面
- [x] 将聊天消息区从工作台玻璃层中拆出独立阅读底板
- [x] 将助手消息从整块半透明气泡调整为中性文档流
- [x] 将聊天侧栏头部通过 portal 收敛到 titlebar slot，消除双层头部
- [x] 将聊天品牌从 titlebar 撤回侧栏内容区，修复左上角品牌错位
- [x] 将聊天搜索从 titlebar 撤回侧栏内容区，修复与 traffic lights 的空间冲突
- [x] 将设置页 `网关` / `更新` 内部子面板收敛到 `app-shell-surface` / `app-pane-surface` / `app-field-surface`
- [x] 将其余工作台页的主承载面收敛到共享 surface token，而不是继续保留页面私有硬编码底色
- [x] 将其余工作台页的次级中性 surface 收敛到共享 token，而不是继续散落在页面私有 badge / row / empty state 中
- [x] 将聊天页 `thinking / tool status / tool calls` 收敛到单一轻时间线，而不是继续堆叠 chip 与次级卡片
- [x] 将聊天页过程层移出重玻璃滚动路径，移除不必要的 `content-visibility` 与 blur 负担
- [x] 将聊天路由的 `titlebar main + workspace` 与 `sidebar + sidebar slot` 改成明确的左右分层，而不是继续靠局部 veil 微调亮度
- [x] 将聊天路由右侧主区从暖色 wash 收回中性白梯度，避免壁纸模式下出现偏粉阅读面
- [x] 为聊天路由补 `wallpaper-on` 半透分支，避免主区与 composer 在壁纸模式下退化成固定白板

## 下一步

- 继续做手工体验微调，重点看超亮、超暖、低对比壁纸下的可读性
- 补抽样检查模型页、设置页、Studio 页在真实壁纸下的玻璃一致性
- 评估是否需要在后续版本增加更细的遮罩强度或局部对比保护
- 补一轮真实 Electron 聊天页截图复核，重点确认不同侧栏宽度下品牌、搜索和 titlebar 控制的相对位置保持稳定
- 继续按信息密度清理极少数三级装饰层，只在确实影响整窗统一感时再动，避免过度设计
- 继续做聊天页真实窗口抽样，重点看极端壁纸下主区略亮、侧栏更静、composer 贴底的层级是否稳定
- 继续检查 Windows 与 Browser fallback 标题栏是否与 mac 一样保持“左灰右亮”的聊天路由层次
