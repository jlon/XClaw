# 全局工作室入口设计

## 背景

当前右上角的“工作室”入口只存在于聊天页工具栏，`Models / Agents / Channels / Skills / Cron / Settings` 等工作台页面没有同一入口，导致主应用导航能力不一致。

## 目标

- 非 `/setup` 页面统一在右上角显示工作室入口
- `/studio` 页面复用同一入口，点击后返回最近一次聊天路由
- `/setup` 保持隔离，不显示该入口
- 避免在每个页面头部重复接入相同逻辑

## 方案

1. 抽离独立的 `StudioToggleButton`
2. 将该按钮挂入 `GlobalTitleBarUtilities`
3. `ChatToolbar` 只保留聊天专属动作，不再承担工作室切换职责

## 边界

- 不调整 `/setup` 标题栏结构
- 不改动 studio 运行时逻辑，只复用现有 `resolveLastChatRoute` 与 `suspendStudioSurface`
