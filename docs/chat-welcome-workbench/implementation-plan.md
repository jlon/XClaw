# 聊天欢迎态桌面工作台实施计划

## 目标

把聊天欢迎态从过渡性的建议卡空态升级为 4 张基于 OpenClaw 工作模式与能力接入的桌面工作台面板，并把中轴主视觉升级为按线上 OpenClaw Hero 资产还原、再加一层低频桌面化 special-idle 的动态小龙虾，同时保持 prompt 注入行为、全局主题一致性和聊天页壳层契约。

## 实施结果

- [x] 锁定欢迎态新文案、新卡片标签和交互契约
- [x] 在 `Chat` 欢迎态中落地新的四张工作模式卡
- [x] 去掉编号、箭头等旧建议项装饰
- [x] 按线上 OpenClaw Hero 还原小龙虾主视觉与局部氛围层
- [x] 为主视觉增加低频伪 3D special-idle
- [x] 删除标题下额外说明句，只保留一行副标题
- [x] 继续精修四张卡的桌面化节奏与插画分化
- [x] 同步 `zh / en / ja` 欢迎态国际化资源
- [x] 跑通欢迎态定向测试与 ESLint
- [ ] 全量类型检查待工作区现存错误清理后补跑
- [ ] 真实桌面窗口下的手工视觉 smoke

## 实施拆分

### 任务 1：锁定行为契约

- [x] 更新欢迎态渲染测试
- [x] 更新欢迎态点击注入测试
- [x] 更新欢迎态源码壳层测试

### 任务 2：重构欢迎态内容模型

- [x] 将旧的过渡文案替换为更有温度的欢迎文案
- [x] 新增类别级文案 key
- [x] 保持 `onQuickAction(prompt)` 契约不变

### 任务 3：收口桌面模块样式

- [x] 去掉旧的编号与箭头视觉
- [x] 将卡片结构改为“类别、标题、说明、底部插画”
- [x] 显式定义四种卡片变体类名
- [x] 保持 4 列桌面布局、两列回落和单列窄窗口回落
- [x] 把卡片精修到统一 `12rem` 卡高、`6rem` 插画层和更明显的面板留白
- [x] 把第四张卡的插画重做为接入连接台语义，避免和执行卡撞型

### 任务 4：还原 OpenClaw 动态主视觉

- [x] 核对线上 `openclaw.ai` Hero 中的小龙虾 DOM 与 CSS
- [x] 还原局部星点与星云氛围层
- [x] 还原漂浮、眼睛闪动、触角摆动与钳子张合
- [x] 还原红光默认态与青光 hover 态

### 任务 5：增加桌面化 special-idle

- [x] 增加透视与影子层
- [x] 增加低频伪 3D 待机动作
- [x] 保持 hover 时停止表演，避免工作台焦点失控

### 任务 6：验证

- [x] `pnpm exec vitest run tests/unit/chat-render-stability.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`
- [x] `pnpm exec eslint src/pages/Chat/index.tsx tests/unit/chat-render-stability.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts --max-warnings=0`
- [x] `pnpm run typecheck`
- [ ] 手工桌面窗口 smoke
