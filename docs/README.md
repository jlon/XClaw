# 功能文档工作流

仓库中的每个功能都应在 `docs/` 下拥有独立目录。

## 命名规则

目录名使用简短的 ASCII slug，例如：

- `docs/setup-openclaw-takeover/`
- `docs/provider-oauth-refresh/`
- `docs/channel-account-binding/`

说明：

- 目录名和文件名可以保留英文，便于统一检索与引用
- `docs/` 目录下的文档内容统一使用中文

## 必需文件

每个功能目录至少包含以下文件：

- `design.md`
- `testing.md`
- `issues.md`
- `progress.md`

## 各文件用途

### `design.md`

用于记录：

- 用户问题与目标
- 非目标与范围边界
- 交互流程与 UX 设计
- 前后端架构影响
- 数据模型、API、IPC、持久化变更
- 发布说明与待定设计项

### `testing.md`

用于记录：

- 单元测试、集成测试、手工测试方案
- 边界场景清单
- 回归风险
- 需要执行的命令
- 通过标准

### `issues.md`

用于记录：

- 已知问题
- 未决问题
- 阻塞项
- v1 接受的取舍
- 后续跟进项

### `progress.md`

用于记录：

- 当前状态
- 实施清单
- 已完成里程碑
- 下一步动作
- 必要时补充负责人和日期

## 执行规则

对于任何非简单功能：

1. 先创建功能目录。
2. 编码前先写或更新 `design.md`。
3. 实现过程中持续更新 `testing.md`、`issues.md`、`progress.md`。
4. 将该功能目录作为该功能的唯一规划与跟踪入口。
