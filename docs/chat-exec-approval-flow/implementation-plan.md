# 聊天内本机执行审批流修复实施计划

## 实施步骤

1. 复盘 transcript，确认问题不是单纯 slash 解析，而是审批后续跑没有形成稳定上下文。
2. 抽共享审批提交器，统一 `/approve` 和桌面审批按钮的提交逻辑。
3. 在聊天页加桌面审批层，对齐 QClaw 的 `exec.approval.requested -> resolve` 交互。
4. 用单测把“resolve + chat.inject + 当前 session 审批层”三件事一起锁住。

## 完成情况

- 已完成
