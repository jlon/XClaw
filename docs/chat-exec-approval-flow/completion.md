# 聊天内本机执行审批流修复完成说明

## 背景

本轮修复针对的是聊天窗口内的本机执行审批链不闭环问题，典型表现有三类：

- 用户点击“仅这次允许”或“长期允许”后，聊天里出现 `Exec approval ... submitted ...` 英文提示，但命令没有稳定继续。
- 同一条命令会重复弹审批框，用户无法判断到底哪一次审批才是生效的。
- 桌面端和 OpenClaw transcript 对审批后的后续消息投递不一致，导致前端一会儿看到“已提交”，一会儿又看不到真正的完成结果。

## 根因

本次最终确认的根因不在单一层，而是前后两层叠加：

1. XClaw 前端之前会在 `/approve` 成功后主动注入一条“已提交审批”的本地消息，这条消息很容易和真实完成消息混在一起。
2. OpenClaw `2026.3.13` 编译产物里，执行审批后的 follow-up 逻辑分散在多份 dist chunk 中，桌面内嵌通道没有被完整 patch，导致运行时命中的实现不稳定。
3. 审批成功后的等待链只盯当前聊天 session，没有严格跟随真正的 transcript session；一旦用户在别的会话里处理审批，前端就可能等错地方。

## 修复内容

### 1. 收口前端审批提交后的等待链

- 移除了 `/approve` 成功后立刻在 transcript 中伪造“审批已提交”消息的旧行为。
- 审批成功后统一进入 `pendingFinal` 等待态，只接受真实 runtime/transcript 回流的最终结果。
- 对跨 session 的审批，前端会先切到真正的 transcript session，再等待完成，避免盯错会话。

### 2. 收口 OpenClaw 桌面内嵌通道的补丁

- 通过 `pnpm.patchedDependencies` 固定 `openclaw@2026.3.13` 的补丁文件。
- 补齐了所有相关 dist chunk 的审批后 follow-up patch，不再只命中部分实现。
- 对 internal/webchat 通道，抑制 `✅ Exec approval ... submitted ...` 这类噪音回执，桌面聊天区只保留真实完成结果。

### 3. 加入前端兜底过滤

- 对历史 transcript 中残留的 `Exec approval ... submitted ...` 噪音消息做渲染层过滤。
- 即使旧会话里已经写入过这类提示，桌面聊天区也不会再把它当成正常 assistant 回复展示出来。

### 4. 加固补丁护栏

- 新增补丁完整性测试，校验所有目标 dist 文件都被 patch。
- 补丁文件去重，避免重复 hunk 造成后续 `pnpm install`/重放补丁不稳定。

## 当前结果

修复完成后，桌面端的预期行为是：

1. 用户在聊天里点击审批按钮或输入 `/approve ...`。
2. 前端进入等待态，但不再显示伪造的“submitted”消息。
3. OpenClaw 在真实命令继续执行后，将结果重新投递回对应 session。
4. 聊天区只显示真实完成消息，不再夹杂误导性的英文审批回执。

## 验证

本轮已执行并通过：

- `pnpm vitest run tests/unit/chat-target-routing.test.ts tests/unit/openclaw-exec-approval-patch.test.ts tests/unit/chat-runtime-event-actions.test.ts`
- `pnpm run typecheck`

重点覆盖点：

- `/approve` 后不再走本地伪造 transcript 注入。
- 跨 session 审批会切到真实 transcript session。
- OpenClaw patch 文件覆盖目标 chunk，且不会重复追加同一批 hunk。

## 仍然保留的边界

- 这次修复针对的是桌面聊天内嵌审批流，不包含对 OpenClaw 上游版本升级的全面替换。
- 如果未来升级 `openclaw` 版本，需要重新核对 patch 是否仍然必要，或者改为直接跟随上游修复。

## 结论

本轮审批流修复已经从“局部表象修补”收口为“前端等待链 + OpenClaw dist patch + transcript 噪音抑制”的完整闭环。后续再出现类似问题时，应优先从 transcript session 是否正确、patch 是否完整、以及 internal 通道是否被误回执三条链排查，而不是继续在聊天 UI 表层做补丁。
