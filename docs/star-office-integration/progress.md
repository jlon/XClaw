# 开发进度

## 当前状态

当前阶段：设计完成，待编写实现计划

当前结论已经确认：

- 工作室是全局工作室
- 顶部新增 `对话 / 工作室` 双 tab
- 工作室在产品上是独立路由，不与单个聊天 session 绑死
- `Star-Office-UI` 采用最小化 vendoring
- XClaw 启动时后台拉起工作室 sidecar，但不阻塞主功能
- Python 复用现有 `uv + managed Python` 准备逻辑
- 状态由 XClaw 主进程自动维护
- 提示词注入只写入 `AGENTS.md`
- 注入必须幂等，不能重复注册

## 里程碑

- [x] 完成现状调研
- [x] 明确 `Star-Office-UI` 不是可直接嵌入的 React 组件库
- [x] 明确工作室采用全局视图
- [x] 明确只读展示范围
- [x] 明确 Python 运行时复用现有 setup 逻辑
- [x] 明确状态来源为“主进程自动状态 + 提示词补 detail”
- [x] 明确注入只作用于 `AGENTS.md`
- [x] 明确“不能重复注册”是指提示词块不能重复注入
- [x] 完成功能设计文档
- [x] 创建 `design.md` / `testing.md` / `issues.md` / `progress.md`

## 下一步

1. 基于本设计撰写 implementation plan
2. 拆出 vendored runtime、主进程 sidecar 管理和注入工具三个实现模块
3. 按测试方案补充单元测试与集成验证

## 当前风险

1. 最小 vendoring 仍会带来可见体积增长，需要在实现阶段严格控制资源清单
2. `Star-Office-UI` 的只读模式需要维护一层 XClaw 自己的 patch
3. 工作室 sidecar 的启动失败与降级链路必须先做好，避免影响聊天主路径

## 备注

- 当前尚未进入实现阶段
- 实现计划产出前，不做代码改动
