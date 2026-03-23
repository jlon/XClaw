# 平台日志导出进度

## 2026-03-24

- 确认平台日志统一落盘到 `userData/logs/XClaw-YYYY-MM-DD.log`
- 确认 Gateway 子进程 stderr/stdout 会汇入同一主日志链
- 新增 `/api/logs/export`，导出最近 10 份平台日志和 `manifest.json`
- 设置页 `网关 -> 日志` 新增 `导出日志包` 按钮
- 三份语言包已补齐按钮与 toast 文案
