# 技能中心 QClaw 桌面化对齐进度

## 2026-03-22

1. 已核对本轮对齐目标：
   - 不是 `OpenClaw` 上游 `skills.ts` 的分组列表页
   - 而是本机安装版 `QClaw` 解包后的技能管理中心
2. 已确认目标证据：
   - 用户提供的技能中心截图
   - `/tmp/qclaw-asar-fgpUo0/out/renderer/assets/c-8d_bn_BT.js` 中的目标字符串
   - 本地解包中可确认的 `添加技能`、`搜索已经安装的技能`、`内置技能` 语义
3. 已识别当前 `XClaw` 技能页核心问题：
   - 主结构偏后台管理页
   - 厚详情抽屉抢主视觉
   - 深度配置能力直接暴露在主层
   - 外部 provider 与本地技能心智混杂
4. 已完成技能来源研究：
   - `BUILTIN_SKILLS` 当前为空
   - 真正随 `XClaw` 提供的是 `preinstalled-manifest.json` 与 `.XClaw-preinstalled.json`
   - 现有前端数据链还不能正确判定 `XClaw 预装`
5. 已完成 `ClawHub` 与 `腾讯 SkillHub` 研究：
   - `ClawHub` 已有可靠 Electron main 安装链
   - `腾讯 SkillHub` 已确认存在搜索接口与安装草案语义
6. 已完成三次子代理 review，主要结论已纳入设计：
   - 主搜索必须回到“搜索已经安装的技能”
   - 主页面应为单一技能网格，不做多分组主版块
   - 外部 provider 进入 `添加技能` 次级流
   - 详情层改为轻量居中模态
   - 需要补完整键盘/焦点/缩放/开关状态契约
   - `内置技能` 标签必须建立在 `xclaw-preinstalled` 证据上
7. 已根据 review 重写设计文档：
   - 主页面只展示本地技能中心
   - `添加技能` 菜单保留 QClaw 对齐项，并增加 XClaw 扩展项
   - 安装体验保持“跳聊天 + 自然语言”，但执行链必须挂在可靠 provider adapter / host action 上
8. 已生成实现计划：
   - `docs/skills-qclaw-refresh/implementation-plan.md`
   - 已把实现拆成 provenance、provider adapter、确定性安装执行链、Skills↔Chat 连续性、桌面 UI 原语、主页面重构、桌面交互契约、完整验证八个任务
9. 实现计划已完成一轮 reviewer 修正：
   - 补入了 `SkillHub` 的具体搜索接口与失败 fallback
   - 补入了确定性安装执行链，不再只停留在聊天草案 handoff
   - 补入了 `Skills -> Chat -> Skills` 的搜索词、滚动位置、provider 结果恢复与刷新契约
10. 已开始代码实现，当前已落地第一批主链路：
   - `electron/api/routes/skills.ts` 新增 `/api/skills/catalog`
   - 本地技能 provenance 已通过 `preinstalled-manifest.json + .XClaw-preinstalled.json` 合并为 `xclaw-preinstalled`
   - `ClawHub / SkillHub` provider 搜索接口已进入 host-api
   - `skills-chat-drafts.ts` 已生成 `create / github-import / provider-install` 三类聊天草案
   - 聊天页已支持从 `/new` 路由接收 `skillChatDraft`
11. `Skills` 主页面已从旧列表 + 安装侧抽屉切到新的桌面技能中心结构：
   - 标题与副说明已按 QClaw 技能中心对齐
   - 主工具栏已收成“本地搜索 + 添加技能”
   - 主体已改成双列卡片网格
   - 详情层已改成居中桌面模态
12. `添加技能` 已进入次级流：
   - 当前菜单只保留：`从 GitHub 导入`、`从 ClawHub 搜索`、`从 SkillHub 搜索`
   - 已移除 `通过对话创建`，避免技能中心重新退化成泛聊天入口
   - provider 结果已改为“发送到聊天”而不是直接混入主技能列表
13. 当前尚未闭环的部分：
   - `Skills -> Chat -> Skills` 已补基础返回态恢复：搜索词、provider 查询和滚动位置会通过 session storage 记忆并在返回时恢复，但发送后自动回跳还没做
   - 真窗口下的桌面视觉 smoke 还没做
14. 本轮继续补齐了 `Skills -> Chat` 的确定性安装执行链：
   - `Chat/index.tsx` 已把 `pendingSkillDraft` 和 `onSendSkillDraft` 真正传给 `ChatInput`
   - `ClawHub` 的 `host-install` 草案不再只是预填消息，而会调用 `/api/clawhub/install`
   - 安装成功后会触发 `useSkillsStore.getState().fetchSkills()`，避免技能中心回看时还是旧状态
15. 本轮继续收了技能卡片的桌面图形语言：
   - 主技能卡片与 provider 搜索结果统一改成 `QClaw` 风格的拼图底盘
   - 底盘颜色按 `xclaw-preinstalled / managed / workspace / extra / agents` 做低饱和 tone 区分
   - 整体仍保留 `XClaw` 的暖珊瑚红系，不直接照搬 `QClaw` 原色
16. 本轮继续收了主技能网格的桌面列数契约：
   - 不再使用 `xl` 才双列的网页式断点
   - 改为窄窗 1 列、默认桌面 2 列、超宽桌面 3 列
   - 主卡片壳层收成统一 `app-skills-card` 语义类，避免又回到零散 Tailwind 拼接
17. 本轮继续补了技能说明国际化的真实闭环：
   - 新增 `skill-copy.ts`，统一处理 `slug / id` 到本地说明词典的映射
   - 技能卡片、详情弹窗、provider 搜索结果都改成“命中本地说明则替换，否则回退原文”
   - 主搜索也会命中当前语言下的本地化说明，而不是只搜原始英文描述
18. 已补三语本地说明词典的首批覆盖：
   - 覆盖当前高频技能和 `XClaw` 预装技能
   - 明确不宣称第三方动态技能说明已被完整国际化
19. 已定位并修复 `SkillHub` 搜索失效的真实根因：
   - 腾讯站点当前真实搜索接口为 `https://lightmake.site/api/skills?page=1&pageSize=24&sortBy=score&order=desc&keyword=...`
   - 旧实现仍在使用过时的 `query / limit` 参数
   - 真实返回结构为 `data.skills`，旧适配器只识别顶层 `items/results`，导致结果被解析成空数组
20. 已把 `SkillHub` 适配器切到当前真实接口语义：
   - 统一走 `/api/skills`，不再依赖旧的 `/top?limit=...` 组合
   - 请求参数改为 `page / pageSize / sortBy / order / keyword`
   - 解析层已支持 `data.skills`
   - `ownerName / homepage / installs` 等字段已并入标准 provider catalog 映射
21. 已在 `SkillHub` 搜索弹层页头加入直达官网入口：
   - 当前为桌面级弱强调按钮 `访问 SkillHub`
   - 点击后会通过 `shell:openExternal` 跳转到 `https://skillhub.tencent.com/`
   - 避免用户只能在应用内盲搜，无法回到官方目录核对技能详情
22. 已修正 `SkillHub` 搜索弹层的桌面布局问题：
   - provider 结果卡不再采用右侧动作区的横向挤压布局
   - 改为正文在上、动作栏在底部一行，保证 `发送到聊天` 与 `查看` 在默认桌面宽度下始终可见
   - 长标题继续单行截断，避免异常 provider 数据把整卡挤坏
23. 已强化 `SkillHub` 搜索弹层的滚动壳：
   - 弹层改为固定桌面高度 `min(82vh, 760px)`
   - 结果区显式使用 `overflow-y-auto + overscroll-contain`
   - 避免结果多时出现“看得见列表，但弹层无法继续下滑”的交互异常
24. 已把 provider 搜索弹层的默认推荐规模改成桌面级 `Top 50`：
   - 弹层首次打开且没有关键词时，不再只拉取 `18` 条结果
   - 现在会对 provider 搜索接口明确发送 `limit: 50`
   - 输入关键词后仍回落到更轻的搜索结果规模，避免长列表搜索态过重
25. 已补本机已安装技能的 provider 结果过滤：
   - 默认推荐和关键词搜索结果都会先与本地技能目录做键匹配
   - 当前匹配键以 `slug / id / providerSkillId` 为主
   - 已安装技能不再在 `ClawHub / SkillHub` 搜索弹层里重复出现，减少桌面中心的噪声感
26. 已修正 `SkillHub -> Chat` 的安装会话路由错误：
   - provider 安装不再导航到 `/new`
   - 现在统一导航到当前聊天页 `/`
   - 多次从 `SkillHub` 发送安装草案时会继续落在当前会话，不会每次新开一个线程
27. 已把 `SkillHub` 安装文案收成确定模板：
   - 不再使用“请帮我安装来自 SkillHub 的技能 ...”这种泛化文案
   - 现在固定要求先检查是否已安装 `SkillHub` CLI
   - 若未安装，则按 `skillhub.md` 里的 `--cli-only` 路径安装
   - 若已安装，则直接安装目标技能
28. 已用 `github` 技能作为回归样本锁定这条草案：
   - 草案正文会原样带入聊天窗口
   - 关键词和技能名以 `slug` 为准，避免模型侧因名称大小写或空格产生歧义
29. 已补聊天页侧的 `chat-prompt` 草案回归：
   - 当安装草案导航到当前聊天页时，聊天输入会收到 pending draft
   - 不会误触发 `host-install`
   - 也不会额外创建新会话
30. 已补 `Skills -> SkillHub -> Chat` 的真实端到端验证：
   - Playwright 已覆盖从技能页打开 `SkillHub` 搜索、点击 `发送到聊天`、再回到聊天页的完整路径
   - 当前回归已确认 URL 会从 `#/skills` 切回 `#/`
   - 当前回归已确认聊天输入框会原样带入固定的 `CLI-only` 安装草案
31. 已补一处测试层误报修正：
   - 先前 E2E 夹具少了 `installCapability`，导致点击 `发送到聊天` 时在测试中抛错，看起来像“按钮没带到聊天”
   - 真实 `SkillHub` 适配器会提供该字段，这次已把夹具补齐，避免后续再被假红误导
32. 已补聊天页的技能流程回流条：
   - 从技能页进入聊天后，聊天页会保留一条轻量的技能流程提示条
   - 当前支持在草案就位、草案已发送、`ClawHub host-install` 已提交三种状态下显示
   - 提示条不会新开线程，也不会打断当前聊天输入
33. 已补 `Skills -> Chat -> Skills` 的 round-trip 回归：
   - 点击 `发送到聊天` 后可进入当前聊天页并保留安装草案
   - 聊天页点击 `返回技能页` 会回到 `#/skills`
   - 返回后会恢复之前的 `SkillHub` 搜索弹层，形成真正的技能中心往返体验
34. 已继续收技能卡片的桌面交互反馈：
   - 卡片切换开关时会进入 `pending` 态，顶部开关会锁定并显示轻量旋转指示
   - 卡片底部已补状态 pill，当前支持 `已启用 / 已停用 / 更新中`
   - 详情层底部动作已拆成“启停”和“卸载”两条，不再把两个语义混成一个按钮
35. 已补技能卡片 pending 态的回归：
   - 单测已覆盖卡片切换时开关禁用与 `更新中` 状态显示
   - 单测已覆盖详情层在切换未完成前锁定按钮，避免桌面交互出现重复点击
36. 已继续补技能页的桌面键盘契约：
   - 技能卡片现在支持 `ArrowLeft / ArrowRight / ArrowUp / ArrowDown`
   - 同时支持 `Home / End` 快速跳到首尾卡片
   - 这条交互只补桌面键盘导航，不额外堆新的页面视觉元素
37. 已收口 `添加技能` 菜单的信息架构：
   - 菜单里已移除 `QClaw` 字样和分组标签
   - 当前只保留 `从 GitHub 导入`、`从 ClawHub 搜索`、`从 SkillHub 搜索`
   - `通过对话创建` 已从菜单入口移除，避免技能中心退化成泛聊天跳板
