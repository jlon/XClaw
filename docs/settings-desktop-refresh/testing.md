## 第一阶段验证

### 结构验证

- 设置页在中大窗口下为顶部 tabs + 单一激活 pane
- 内容区不是无限铺满，而是保持稳定阅读宽度
- 小窗口下仍保持同一 tabs 结构，不退回长页面锚点滚动
- tabs 点击能稳定切换当前 pane
- 任意时刻只显示一个主 pane
- 当前 pane 采用 `card + row` 语法，而不是连续长表单

### 功能验证

- 主题、语言、启动项切换仍正常
- Gateway 状态、日志、重启仍正常
- `devMode / telemetry` 调整到通用偏好后，功能仍正常
- 更新设置仍正常
- `UpdateSettings` 已改成版本信息 + 禁用说明，不再触发检查/下载/安装链路
- dev mode 打开前不显示 `Developer`
- dev mode 打开后显示 `Developer`，控制台/doctor/proxy/telemetry 仍可用
- `OpenClaw 控制台` 在首次点击、尚未缓存 URL 时也能正常打开
- 代理设置默认只展示主代理，高级字段可展开/收起，保存链路不变
- `Settings` 不出现重复的 Provider 管理入口
- 代理从 `Developer` 迁回 `运行时` 后，保存、重启提示与实际链路不变
- 日志改为模态后，复制日志、打开日志目录、关闭日志仍正常
- `Developer` 收成 `控制台接入 / Doctor / 调试工具` 三个 pane 后，原有控制台、Doctor、埋点查看器功能仍正常
- `更新` 不再出现自动检查更新、自动下载更新开关
- `更新` 默认只显示当前版本与禁用说明
- 设置页不再显示 `关于` tab 与对应内容区
- `通用偏好` 收成两个紧凑 pane 后，主题、语言、启动项、匿名使用数据、开发者模式的切换链路不变
- `tabs` 切换时，`通用 / 运行环境 / 更新 / 开发者` 只显示当前激活 pane
- 设置页不再显示“设置 / 配置您的 XClaw 体验”这类页头标题与泛解释文

### 已执行命令

- `pnpm exec vitest run tests/unit/settings-layout.test.tsx`
- `pnpm exec eslint src/pages/Settings/index.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Settings/index.tsx src/components/settings/UpdateSettings.tsx --max-warnings=0`
- `pnpm run build:vite`

### 当前限制

- 整仓 `pnpm run typecheck` 当前被 `Cron` 相关存量错误阻塞，本轮未继续扩散修复；与设置页改动无关

### 视觉验证

- 顶部 tabs 符合桌面工具带语法，不像网页二级导航
- 当前内容 pane 主次清晰，不回到大面积 dashboard 卡片
- 字体、灰阶、边界继续遵循 `QClaw substrate, XClaw accent`
- `Gateway / 更新` 的信息优先级应接近 `QClaw` 的 row 组织，而不是后台控制台
- `Developer` 的控制台、Doctor、埋点摘要应呈现为稳定的 row/card 组合，而不是徽章条和日志堆
- `Doctor / 埋点` 的原始输出默认折叠，只有在用户主动展开时才出现
- `更新` 面板必须维持单一 pane 语法，不允许再出现自动更新操作按钮和错误块
- `运行时` 不再出现重复的状态/端口/自动启动摘要壳
- 默认桌面窗口下，`运行时` 主路径不依赖内联日志块或内部滚动条
- `运行时` 与 `开发者` 的主路径必须遵守 `标签 -> 值/控件 -> 动作` 的 inspector 语法，不允许再退回“说明文轨 + 控件轨”
- `Developer` 默认首屏不再出现指标卡墙和多层说明壳
- `更新` 默认首屏不再出现网页式指标卡墙
- `通用偏好` 默认首屏不再重复输出页级说明，也不再出现大表单卡与大 toggle 混排
- 顶部直接进入 tabs，不再出现页标题和网页后台式副标题
- 设置页主区不再出现 `tabs -> section -> subpanel` 的多层白壳嵌套
- `主题 / 语言` 应表现为统一的桌面 segmented row，而不是两块独立网页表单
- section 头部不应再普遍出现“把标题再说一遍”的泛说明文本
- `更新` 必须在同一 pane 内完成状态、动作、发布说明，不再拆成多张摘要卡
- `应用日志` 模态必须是单头部工具带 + 内容 pane，不允许再出现独立动作横条和无意义空白带
- `更新 / 调试工具` 中的开关行应与 `通用偏好` 共享同一套紧凑 row 语法，不再混用厚 toggle 卡
- 顶部 `tabs` 不允许再呈现为整条白壳分段控件，必须是更轻的桌面工具按钮组
- `主题 / 语言` 切换必须与顶部 tabs 共享同一套独立按钮语法，而不是另一套网页 segmented 壳
- 标签轨与控件轨之间不应留下大面积死空白，控件不应被甩到 pane 最右边
- `运行环境 -> 代理` 不允许同时保留 `代理说明 + 字段说明 + 动作说明` 三层重复文案；默认只允许标题和字段标签
- `应用日志` 模态头部只允许标题和工具动作，不允许再附加“最近 100 行”这类重复说明
- OpenRouter 默认配置和 Gateway 预处理链路中不得再硬编码 `https://claw-x.com` 或 `XClaw` 作为请求头

### 本轮补充验证

- `pnpm exec vitest run tests/unit/update-settings.test.tsx tests/unit/settings-layout.test.tsx tests/unit/update-release-config.test.ts`
