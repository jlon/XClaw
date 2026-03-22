# 应用图标品牌对齐设计

## 背景

当前 XClaw 的应用级图标链路仍使用旧的蓝色爪形品牌资产，而欢迎页、品牌文案和产品定位已经逐步向 OpenClaw 的龙虾语义收敛。继续保留旧图标会造成品牌识别断裂：窗口图标、托盘图标、安装包图标和浏览器 favicon 都不是同一套视觉语言。

## 目标

1. 只重做应用级品牌图标链路，不扩散到全站功能图标库替换。
2. 图标语义对齐 OpenClaw：龙虾主体、红色渐变、青色眼睛高光。
3. 保持 Electron 打包链路不变，只替换其引用资源与生成脚本。

## 范围

### 包含

- `resources/icons/icon.svg`
- `resources/icons/icon.png`
- `resources/icons/icon.ico`
- `resources/icons/icon.icns`
- `resources/icons/16x16.png` 至 `512x512.png`
- `resources/icons/tray-icon-template.svg`
- `resources/icons/tray-icon-Template.png`
- `public/favicon.svg`
- `public/favicon.ico`
- `public/favicon-32.png`
- `public/apple-touch-icon.png`
- `index.html` favicon 引用
- `scripts/generate-icons.mjs`

### 不包含

- `lucide-react` 页面功能图标替换
- 页面级图标库迁移
- 任意业务界面的图标语义重设计

## 方案

### 品牌主图

主图采用 OpenClaw 风格的龙虾 SVG，但应用图标与浏览器 favicon 分源处理：

- 应用图标母版使用高质感圆角卡片底板 + 龙虾主体
- 浏览器 favicon 使用纯龙虾透明画布

这样可以同时保证桌面端图标的完成度和浏览器小尺寸下的识别度。

### 托盘图标

macOS 托盘图标使用单色模板版龙虾轮廓，不复用彩色主图。原因是 macOS menu bar 依赖模板图自动适配明暗背景，彩色图会在系统栏里失真。

### 生成策略

继续以 `scripts/generate-icons.mjs` 作为唯一入口，从 `resources/icons/icon.svg` 与 `resources/icons/favicon.svg` 生成：

- Electron 打包所需 PNG/ICO/ICNS
- Linux 多尺寸 PNG
- macOS 托盘模板 PNG
- 浏览器 favicon 与 touch icon

## 打包关系

- `electron-builder.yml` 仍通过 `resources/icons` 提供桌面应用图标
- Renderer 浏览器入口通过 `public/favicon*` 与 `index.html` 引用
- 不修改 Electron Builder 配置结构，只更新其输入资源
