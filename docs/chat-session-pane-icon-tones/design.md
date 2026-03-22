# 聊天侧栏图标低饱和主题色设计

## 目标

把聊天左侧高频图标和主 Sidebar 导航图标从一片灰收成更有层次的桌面级视觉，但不能做成网页导航按钮。

## 设计约束

- 只给图标上色，不给主文字上色
- 颜色保持低饱和、轻雾感，不做高亮实心按钮
- 删除等危险动作继续保持中性语义
- 搜索、新建、工作台、设置和工作台弹层入口使用统一的 tone 体系
- 主 Sidebar 导航同步使用同一套低饱和 tone，并接入 `--font-sidebar`

## 色彩策略

- 搜索：雾蓝灰
- 新建：珊瑚红
- 工作台：暖琥珀
- 设置 / OpenClaw 页面：冷石墨蓝
- 模型：蓝灰
- Agents：珊瑚
- 频道：青绿
- Skills：金棕
- 定时任务：薰衣草灰

## 实现方式

- 在 `ChatSessionsPane` 内引入统一的 `SessionPaneToneIcon`
- 在 `Sidebar` 内引入统一的 `SidebarToneIcon`
- 所有高频图标只通过 tone wrapper 染色
- 全局样式用 `app-chat-session-toned-icon--*` 变量化控制明暗主题
