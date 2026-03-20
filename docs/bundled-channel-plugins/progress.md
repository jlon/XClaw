# 渠道插件内置化进度

## 当前状态

- [x] 梳理现有插件打包 / 安装链路
- [x] 确认 Win/mac 当前离线架构可复用
- [x] 确认新 WeCom 包真实插件 id 为 `wecom`
- [x] 确认 Feishu 包真实插件 id 为 `openclaw-lark`
- [x] 修改依赖与打包脚本
- [x] 修改启动安装 / 配置迁移逻辑
- [x] 完成代码级回归验证
- [x] 完成 mac 本地打包验证
- [ ] 完成 Windows 实机打包验证

## 本轮实施清单

- WeCom 源切换到 `@openclaw-china/wecom`
- Feishu 安装目录统一为 `openclaw-lark`
- 删除 `feishu-openclaw-plugin` 主链引用
- 保留旧 Feishu 配置的一次性迁移

## 下一步

- 在 Windows 主机上补一轮 `package:win` 实机验证
- 手工验证首次启动会自动删除旧 `feishu-openclaw-plugin` 目录
