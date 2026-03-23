## 当前阶段实施计划

1. 校正文档合同
   - 将“顶部 tabs + 单激活 pane”写入 `design.md`
   - 移除旧的左导航与滚动定位叙述

2. 重构 `Settings/index.tsx` 骨架
   - 删除左导航与 section 滚动同步
   - 引入顶部 tabs 工具带
   - 每次只渲染一个主 pane

3. 保持现有功能分组
   - `通用偏好`
   - `运行环境`
   - `更新`
   - `开发者`

4. 保留前一轮收口成果
   - 运行时事实带、工具带、代理 pane
   - 日志独立模态
   - Developer 三个稳定 pane

5. 定向验证
   - `vitest` 锁定 tabs 切换契约
   - `eslint`
   - `build:vite`
