# 聊天欢迎态桌面工作台进度

## 当前状态

第五轮欢迎态收口已完成。欢迎区已经从过渡性的建议卡改成 4 张 OpenClaw 工作模式卡，中轴主视觉也已从“近似图标”升级为按线上 OpenClaw Hero 结构与动画参数还原、并追加低频桌面化 special-idle 的动态小龙虾资产；本轮继续把品牌区收成单句副标题、把卡面精修成更接近桌面模块的高精度面板、把 `接上能力` 插画彻底拉开到连接台语义，并把标题字系纠偏到和 `QClaw` 真源码一致的系统 sans 栈。欢迎态定向测试、ESLint 与全量 `typecheck` 已通过。

## 已完成

1. 已以 [docs/README.md](/Users/jianglong/workspace/XClaw/docs/README.md) 与 [docs/global-theme-refresh](/Users/jianglong/workspace/XClaw/docs/global-theme-refresh) 为本次改造基线。
2. 已核对本机解包的 `QClaw` 欢迎页，确认其参考价值在模块卡节奏和桌面面板气质，而不是功能场景内容。
3. 已保留 OpenClaw 风格小龙虾主视觉，并继续使用桌面 app icon 容器承载。
4. 已去掉顶部 `Main Agent`。
5. 已确认桌面宽度下为 4 张横向卡片，并在中等窗口下回落为两列。
6. 已把欢迎区文案改成更有温度、但仍然像桌面工作台的表达：
   - `XClaw`
   - `小助手已就位，你开口，我开工`
   - 不再保留额外说明文
7. 已把欢迎区卡片重构为 OpenClaw 工作模式与能力接入模型：
   - `当前桌面 / 直接开工`
   - `同一线程 / 接着往下`
   - `Agent 接力 / 拆开推进`
   - `技能与接入 / 接上能力`
8. 已移除编号和箭头，让卡片结构回到“类别、标题、说明、底部插画”。
9. 已补上显式卡片变体类名，避免继续依赖动态字符串拼接。
10. 已同步 `zh / en / ja` 国际化资源。
11. 已抓取并核对 2026-03-21 当天线上 `openclaw.ai` Hero 中的小龙虾 DOM、样式与关键帧定义。
12. 已把欢迎态主视觉替换为带局部星点、星云层和完整动作语义的 OpenClaw 小龙虾资产：
   - 整体漂浮
   - 眼睛闪动
   - 触角摆动
   - 左右钳张合
   - hover 红光切青光
13. 已在用户确认后为主视觉增加桌面化低频 special-idle：
   - 伪 3D 透视
   - 偶发转身
   - 一次小跳和回弹
   - 影子联动
14. 已把卡片从 3 色扩展为更接近 `QClaw` 面板语言的 4 色体系，并把第 4 张 `接上能力` 卡的插画改成明显区别于执行卡的接入面板语义。
15. 已按 `QClaw` 的紧凑首屏节奏继续压缩欢迎区上半段高度，缩小主视觉壳层并收紧标题区留白。
16. 已去掉标题下方那句额外说明文，品牌区只保留标题与一句副标题。
17. 已继续精修欢迎区桌面节奏：
   - 品牌区和卡片区的留白更接近 `QClaw`
   - 四张卡统一到 `12rem` 卡高和 `6rem` 插画层
   - 卡片圆角统一为 `1.15rem`
   - 卡片顶部增加轻量高光层，底部插画保留独立色垫
18. 已确认欢迎页本身没有单独换 `font-family`，问题来自全局字体栈误判与标题字重、字距过激。
19. 已把 `QClaw.app` 真包完整解到本地参考目录 `.reference/qclaw-unpacked-20260321/`，并确认它的全局 `body` 使用单一系统 sans 栈。
20. 已确认 `QClaw` 欢迎头本体是 `logo` 图片加副标题，不存在可直接复用的文字品牌字体文件。
21. 已将全局字体从误判的 `SF Pro` 双栈收回到与 `QClaw` 真源码一致的系统 sans 栈。
22. 已将欢迎头从普通文本标题切到独立 `XClaw` 字标组件，并保留隐藏 `h1` 负责语义与可访问性。
23. 已将副标题字号、透明度和品牌区留白继续收向 `QClaw` 的欢迎头节奏。
24. 已更新欢迎态和主题相关定向测试。
25. 已完成本轮欢迎态相关自动化验证：
   - `pnpm exec vitest run tests/unit/chat-render-stability.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts --reporter=dot`
   - `pnpm exec vitest run tests/unit/theme-application.test.tsx --reporter=dot`
   - `pnpm exec eslint src/pages/Chat/index.tsx tests/unit/chat-render-stability.test.tsx tests/unit/chat-humanized-actions.test.tsx tests/unit/chat-theme-shell.test.ts --max-warnings=0`
26. 已完成全量 `typecheck`，当前欢迎态改动不再存在类型层面的阻塞。

## 当前实施清单

1. 欢迎区主视觉、氛围层与中轴文案收口。
2. 四张工作模式卡内容重构。
3. 卡片样式从建议项改成四色桌面模块面板，并继续精修面板间距、圆角和插画层高度。
4. 国际化和测试同步更新。
5. 文档与验证结果同步。
6. 全量类型检查已完成，当前后续只剩视觉人工验收。

## 下一步

1. 做一轮真实桌面窗口下的手工视觉 smoke。
2. 直接对照线上 `openclaw.ai` 页面做主视觉肉眼校验。
3. 观察 special-idle 的节奏是否仍然足够克制。
4. 观察四色卡面在真实桌面窗口下是否仍然克制。
5. 观察窄窗口回落两列和单列时的密度和节奏。
6. 如果 Windows 下边框与 hover 反馈偏弱，再做平台级微调。
