# 平台日志导出测试

## 目标

验证设置页能够触发平台日志导出，并生成跨平台可用的 zip 包。

## 需要验证

1. 设置页 `网关` 标签下能看到 `导出日志包`
2. 点击按钮会调用 `/api/logs/export`
3. 用户取消保存时不会报错
4. 导出成功时返回 `savedPath/fileCount`
5. zip 内只包含平台日志和 `manifest.json`
6. 不包含 `~/.openclaw`、聊天 transcript、凭据

## 已执行

- 设置页单测覆盖按钮调用 `/api/logs/export`
- 主进程路由本地静态校验

## 待补

- 日志 route 的独立单测
- 手工验证 mac/Windows 下的保存对话框和 zip 可解压

