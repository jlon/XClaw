# 应用图标品牌对齐进度

## 2026-03-22

- 确认 OpenClaw 的品牌图标与功能图标是两条不同链路。
- 确认 XClaw 当前应用级图标入口位于 `resources/icons`、`electron/main/index.ts`、`electron/main/tray.ts`、`electron-builder.yml`。
- 确认本次只做品牌图标链路，不更换页面功能图标库。
- 开始替换主图 SVG、托盘模板 SVG，并扩展生成脚本输出 `public/favicon*`。
- 将应用图标母版升级为高质感圆角卡片版本，确保桌面端图标不是简单透明贴图。
- 将浏览器 favicon 改为独立的纯龙虾 SVG 源，避免小尺寸下被底板干扰。
- 已生成新的 `icon.png`、`icon.ico`、`icon.icns`、Linux 多尺寸 PNG、`tray-icon-Template.png`。
- 已补齐 `public/favicon.svg`、`public/favicon.ico`、`public/favicon-32.png`、`public/apple-touch-icon.png`。
- 已在 `index.html` 中接入 favicon 链路，并新增图标资产回归测试。

## 2026-03-23

- 将共享 `src/assets/logo.svg` 的眼位高光从青色调整为白色圆点。
- 目标是提升聊天左栏、工作台侧栏等浅色背景下的小尺寸识别度，不改动龙虾主体轮廓和主渐变。
- 已补充共享 logo 白色眼点的资产回归断言，防止后续被无意改回。
- 将聊天栏、侧栏品牌位的 logo 显示从整图滤镜染色改为原色显示，避免白点和黑眼被一起染平。
- 将品牌位图标高度小幅上调，配合更大的白色眼点提升可识别性。
- 将 macOS 状态栏模板图改为带透明眼洞的单色龙虾，保证菜单栏里能看到两个黑色眼位。
