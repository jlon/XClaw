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
