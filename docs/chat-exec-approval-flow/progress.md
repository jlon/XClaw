# 聊天内本机执行审批流修复进度

## 2026-03-28

已完成：

- 移除 `/approve` 成功后的本地伪造 transcript 注入。
- 审批成功后统一进入真实完成等待态，不再展示误导性的 `submitted` 回执。
- OpenClaw `2026.3.13` 的桌面审批相关 dist chunk 已补齐 patch。
- internal/webchat 通道的审批成功噪音回执已抑制。
- 跨 session 审批会切换到真正的 transcript session 再等待完成。
- 补丁完整性测试与聊天运行态测试已补齐。

当前判断：

- 这条桌面聊天审批流已经形成完整闭环，可以作为当前版本的基线行为。
- 后续若升级 OpenClaw 版本，应优先评估是否删除本地 patch，而不是继续叠加新补丁。
