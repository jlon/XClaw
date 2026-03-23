# 聊天内本机执行审批流修复进度

## 2026-03-22

已完成：

- 抽出共享审批提交器 `exec-approval-submit.ts`
- `/approve` 成功后补 `chat.inject` transcript 同步
- 聊天页新增桌面审批层 `ExecApprovalOverlay`
- 补齐单测、lint、typecheck

当前判断：

- XClaw 前端审批提交链路已从“局部补丁”提升为“桌面路径 + slash 兼容路径”双闭环
- 但整个系统不能宣称 `100%`，因为 gateway 侧 async exec followup 还没有做真实端到端验收
