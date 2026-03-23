# 聊天内本机执行审批流修复遗留问题

## 仍需继续确认

1. transcript 中已经出现过 `✅ Exec approval ... submitted ...` 但没有后续 `Exec finished ...` 的情况。
2. 这说明 gateway / agent 侧的 async exec followup 仍可能存在不稳定点。
3. 当前修复已经把 XClaw 前端这层闭环补上，但还不能把 gateway 侧 followup 缺失归零。

## 风险

1. 如果 `chat.inject` 失败，审批结果仍然可能只在 runtime 成功、但 transcript 不同步。
2. 如果 gateway 自己没有把批准后的 exec 结果重新投递到会话里，用户仍可能在等待期间继续发自然语言，从而触发新的模型推理。

## 下一步候选

1. 针对真实 transcript 样本补一条更接近现场的集成测试。
2. 在聊天页加入“审批已提交，等待命令完成”的短暂状态提示。
3. 继续排查 OpenClaw gateway 侧 `sendExecApprovalFollowupResult` 未落盘的真实原因。
