## 第一阶段验证

### 结构验证

- 设置页在中大窗口下为两列：左导航、右内容
- 右侧内容不是无限铺满，而是保持稳定阅读宽度
- 小窗口下退回单列，不破坏功能
- 导航点击能稳定滚动到对应 section
- 当前 section 能在导航中高亮
- 右侧各 section 采用 `card + row` 语法，而不是连续长表单

### 功能验证

- 主题、语言、启动项切换仍正常
- Gateway 状态、日志、重启仍正常
- `devMode / telemetry` 调整到通用偏好后，功能仍正常
- 更新设置仍正常
- `UpdateSettings` 收回统一 pane 后，检查/下载/安装链路仍正常
- dev mode 打开前不显示 `Developer`
- dev mode 打开后显示 `Developer`，控制台/doctor/proxy/telemetry 仍可用
- `OpenClaw 控制台` 在首次点击、尚未缓存 URL 时也能正常打开
- 代理设置默认只展示主代理，高级字段可展开/收起，保存链路不变
- `Settings` 不出现重复的 Provider 管理入口

### 已执行命令

- `pnpm exec eslint src/pages/Settings/index.tsx --max-warnings=0`
- `pnpm exec eslint src/pages/Settings/index.tsx src/components/settings/UpdateSettings.tsx --max-warnings=0`
- `pnpm run typecheck`

### 视觉验证

- 左侧导航符合 source-list 语法，不像网页 tabs
- 右侧内容面板主次清晰，不回到大面积 dashboard 卡片
- 字体、灰阶、边界继续遵循 `QClaw substrate, XClaw accent`
- `Gateway / 更新 / 关于` 的信息优先级应接近 `QClaw` 的 row 组织，而不是后台控制台
- `Developer` 的控制台、Doctor、埋点摘要应呈现为稳定的 row/card 组合，而不是徽章条和日志堆
- `Doctor / 埋点` 的原始输出默认折叠，只有在用户主动展开时才出现
- `更新` 面板中的发布说明、错误与下载进度应保持 pane 语法，不回退成网页文章或大段提示块
