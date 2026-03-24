# 全局工作室入口进度

## 已完成

- 确认工作室入口应收敛到标题栏公共层，而不是分散在各页面头部
- 设计 `StudioToggleButton + GlobalTitleBarUtilities` 的统一接入方式
- 实现全局标题栏工作室入口，并从 `ChatToolbar` 移除重复切换逻辑
- 补充 studio 入口进出行为测试与聊天工具栏回归测试

## 进行中

- 暂无

## 完成标准

- 非 `/setup` 页面右上角统一显示工作室入口
- `/studio` 可以通过同一入口返回最近聊天路由
- `ChatToolbar` 不再重复承载工作室切换逻辑
