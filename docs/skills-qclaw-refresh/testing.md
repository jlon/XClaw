# 技能中心 QClaw 桌面化对齐测试

## 测试目标

验证以下五件事：

1. 主页面真正对齐 QClaw 的本地技能中心，而不是混成 marketplace。
2. `内置技能` 标签只建立在正确的 `xclaw-preinstalled` 证据之上。
3. `ClawHub / 腾讯 SkillHub` 搜索与安装进入“添加技能”次级流，不污染主搜索。
4. 键盘、焦点、缩放、开关状态和跨平台桌面行为成立。
5. 技能说明只在存在本地词典覆盖时进行国际化，未覆盖项回退原文。

## 计划验证

### 结构与源码级验证

1. `tests/unit/skills-page.test.tsx`
   - 存在 `技能管理` 标题和新的副说明
   - 工具栏只包含一个本地搜索框与 `添加技能` 按钮
   - 搜索框文案为 `搜索已经安装的技能`
   - 主列表为单一技能卡片网格，而不是多分组主版块
   - 卡片包含名称、描述、开关、来源标签、更多菜单
2. `tests/unit/skills-add-menu.test.tsx`
   - `添加技能` 菜单存在
   - 菜单只保留 `从 GitHub 导入`
   - 菜单只保留 `从 ClawHub 搜索`
   - 菜单只保留 `从 SkillHub 搜索`
3. `tests/unit/theme-second-wave-pages.test.ts`
   - `src/pages/Skills/index.tsx` 不再以当前后台式列表/厚抽屉作为主结构
   - 存在新的 `skills desktop shell` class
4. `tests/unit/skills-detail-modal.test.tsx`
   - 点击卡片主体打开居中详情弹窗
   - 详情弹窗关闭时焦点回到触发卡片
   - 二级层不再是当前厚侧抽屉主视图

### 来源与数据验证

1. `tests/unit/skills-provenance.test.ts`
   - `resources/skills/preinstalled-manifest.json` 与 `.XClaw-preinstalled.json` 能合并为 `xclaw-preinstalled`
   - `bundled` 不会直接映射成 `内置技能`
   - `openclaw-managed / workspace / extra / agents-*` 能生成正确来源语义
2. `tests/unit/skills-store.test.ts`
   - 本地主网格只吃本地技能集合
   - 外部 provider 结果不会直接出现在主搜索结果里
   - provider 结果必须使用 `provider-qualified id`

### Provider 与安装流验证

1. `tests/unit/skills-provider-adapters.test.ts`
   - `ClawHub` provider 可搜索并输出统一 catalog 数据
   - `腾讯 SkillHub` provider 可搜索并输出统一 catalog 数据
   - 两者都能生成结构化 install draft
2. `tests/unit/skills-install-intent.test.ts`
   - 从 `ClawHub` 结果进入安装时会跳转聊天页
   - 从 `SkillHub` 结果进入安装时会跳转聊天页
   - 聊天页拿到的是自然语言安装意图 + 结构化 draft，而不是纯自由文本
3. `tests/unit/skills-install-routing.test.ts`
   - `ClawHub` 安装仍能落到现有可靠 host action
   - `SkillHub` 安装通过 provider adapter 生成可执行草案
   - 取消、失败、返回技能页时保留原搜索状态

### 交互与可访问性验证

1. `tests/unit/skills-keyboard-navigation.test.tsx`
   - `Tab` 顺序正确
   - 卡片网格支持方向键导航
   - `Enter / Space` 能触发打开和开关
   - `Esc` 能关闭菜单、provider 面板和详情弹窗
2. `tests/unit/skills-toggle-state.test.tsx`
   - 开关存在 `pending / success / rollback / disabled-with-reason` 状态
   - 失败时能回滚且反馈可见
3. `tests/unit/skills-context-menu.test.tsx`
   - `...` 菜单不依赖 hover 才能访问
   - 键盘和右键路径都可用

### 视觉与桌面质感人工验收

1. 常规桌面窗口下主视图像技能中心，不像后台管理页或网页商店。
2. 主搜索只搜索本地技能，不会出现外部 provider 卡片混排。
3. 技能网格在窄窗为 1 列、默认桌面为 2 列、超宽桌面为 3 列，且在 `macOS` 和 `Windows` 下都保持桌面级密度。
4. `125% / 150% / 200%` 缩放时列数和留白过渡自然。
5. 高对比模式、减少动画模式下仍可用。
6. 长标题、长描述、长中文/英文文案不会撑坏卡片。
7. 详情层像桌面轻量模态，不像后台厚抽屉。
8. `添加技能` 次级流能进入 `ClawHub / SkillHub` 搜索，并能返回主技能中心。

## 当前状态

### 已执行

1. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts --reporter=dot`
   - 结果：`6 passed / 21 passed`
   - 已覆盖主页面结构、添加技能菜单、详情模态、聊天草案、provider adapter、来源判定，以及 Skills 返回态搜索恢复
2. `pnpm exec eslint src/pages/Skills/index.tsx electron/api/routes/skills.ts tests/unit/skills-page-layout.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts --max-warnings=0`
   - 结果：通过
3. `pnpm exec vitest run tests/unit/chat-skill-draft.test.tsx tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts --reporter=dot`
   - 结果：`7 passed / 22 passed`
   - 已额外覆盖 `ClawHub host-install` 草案在聊天页会走本地安装执行，而不是只做文本预填
4. `pnpm exec eslint src/pages/Chat/index.tsx src/pages/Skills/index.tsx tests/unit/chat-skill-draft.test.tsx tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts --max-warnings=0`
   - 结果：通过
5. `pnpm run typecheck`
   - 结果：通过
6. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx -t "renders a qclaw-style desktop skills center with local search and card grid" --reporter=dot`
   - 结果：通过
   - 已锁定主网格必须带 `app-skills-card-grid` 契约，防止退回到 `xl` 才双列的网页式断点
7. `pnpm exec vitest run tests/unit/skills-copy.test.ts tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts tests/unit/chat-skill-draft.test.tsx --reporter=dot`
   - 结果：`8 passed / 26 passed`
   - 已覆盖技能说明本地化词典、页面级本地化说明替换，以及搜索继续兼容当前语言下的描述
8. `pnpm exec eslint src/pages/Skills/index.tsx src/pages/Skills/skill-copy.ts tests/unit/skills-copy.test.ts tests/unit/skills-page-layout.test.tsx --max-warnings=0`
   - 结果：通过
9. `pnpm exec vitest run tests/unit/skills-provider-adapters.test.ts tests/unit/skills-page-layout.test.tsx --reporter=dot`
   - 结果：`2 passed / 8 passed`
   - 已覆盖 `SkillHub` 当前真实搜索参数 `page/pageSize/sortBy/order/keyword`、`data.skills` 解析，以及搜索弹层中的 `访问 SkillHub` 直达入口
10. `pnpm exec eslint electron/gateway/skillhub.ts src/pages/Skills/index.tsx tests/unit/skills-provider-adapters.test.ts tests/unit/skills-page-layout.test.tsx --max-warnings=0`
   - 结果：通过
11. `pnpm run typecheck`
   - 结果：通过
12. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx tests/unit/skills-provider-adapters.test.ts tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provenance.test.ts tests/unit/skills-copy.test.ts --reporter=dot`
   - 结果：`7 passed / 27 passed`
   - 已覆盖 `SkillHub` 弹层的固定滚动壳、官网入口和“发送到聊天”后的 `/new` 路由跳转
13. `pnpm exec eslint src/pages/Skills/index.tsx tests/unit/skills-page-layout.test.tsx --max-warnings=0`
   - 结果：通过
14. `pnpm run typecheck`
   - 结果：通过
15. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx -t "loads top 50 provider results by default and filters out already installed skills" --reporter=dot`
   - 结果：通过
   - 已覆盖 provider 弹层默认会请求 `limit: 50`，并且会把本机已安装技能从推荐结果中过滤掉
16. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts tests/unit/skills-copy.test.ts tests/unit/chat-skill-draft.test.tsx --reporter=dot`
   - 结果：`8 passed / 29 passed`
   - 已回归验证默认 `Top 50`、已安装过滤、provider 搜索、技能说明国际化、安装草案和聊天页安装执行链没有互相回归
17. `pnpm exec eslint src/pages/Skills/index.tsx tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts tests/unit/skills-copy.test.ts tests/unit/chat-skill-draft.test.tsx --max-warnings=0`
   - 结果：通过
18. `pnpm run typecheck`
   - 结果：通过
19. `pnpm exec vitest run tests/unit/skills-install-intent.test.ts tests/unit/skills-page-layout.test.tsx --reporter=dot`
   - 结果：`2 passed / 11 passed`
   - 已覆盖 `SkillHub` 安装草案必须生成固定的 `CLI-only` 检查/安装文案，并且 provider 安装会导航到当前聊天页 `/`，而不是 `/new`
20. `pnpm exec vitest run tests/unit/chat-skill-draft.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts tests/unit/skills-copy.test.ts --reporter=dot`
   - 结果：`8 passed / 30 passed`
   - 已额外覆盖 `chat-prompt` 类型的 `SkillHub` 安装草案会在当前聊天页 hydrate，不会误触发本地安装，也不会要求新建会话
21. `pnpm exec eslint src/pages/Skills/index.tsx src/pages/Skills/skills-chat-drafts.ts tests/unit/skills-install-intent.test.ts tests/unit/skills-page-layout.test.tsx tests/unit/chat-skill-draft.test.tsx --max-warnings=0`
   - 结果：通过
22. `pnpm run typecheck`
   - 结果：通过
23. `pnpm dlx @playwright/test@1.58.0 test tests/e2e/chat.spec.ts -g "skillhub send-to-chat keeps the current chat route and hydrates the deterministic install draft" --config=playwright.config.cjs`
   - 结果：通过
   - 已覆盖从 `Skills -> 从 SkillHub 搜索 -> 发送到聊天` 的真实路由切换
   - 已确认点击后不会留在 `#/skills`，而是回到当前聊天页 `#/`
   - 已确认聊天输入框会原样带入固定的 `CLI-only` 安装草案
24. `pnpm exec vitest run tests/unit/chat-skill-draft.test.tsx tests/unit/skills-page-layout.test.tsx --reporter=dot`
   - 结果：`2 passed / 10 passed`
   - 已继续回归 `chat-prompt` 草案在聊天页的 hydrate，以及 provider 安装按钮的路由状态注入
25. `pnpm exec eslint tests/unit/chat-skill-draft.test.tsx tests/unit/skills-page-layout.test.tsx tests/e2e/chat.spec.ts --max-warnings=0`
   - 结果：通过
26. `pnpm run typecheck`
   - 结果：通过
27. `pnpm dlx @playwright/test@1.58.0 test tests/e2e/chat.spec.ts -g "skillhub send-to-chat keeps the current chat route and hydrates the deterministic install draft" --config=playwright.config.cjs`
   - 结果：通过
   - 已继续覆盖聊天页中的 `返回技能页` 回流条
   - 已确认从聊天页点击回流按钮后会重新回到 `#/skills`
   - 已确认返回后会恢复 `SkillHub` 搜索弹层，而不是丢失技能中心上下文
28. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-install-intent.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-provenance.test.ts tests/unit/skills-copy.test.ts tests/unit/chat-skill-draft.test.tsx --reporter=dot`
   - 结果：`8 passed / 34 passed`
   - 已覆盖技能卡片切换时的 `pending` 锁定、状态 pill 和详情层动作锁定
29. `pnpm exec eslint src/pages/Skills/index.tsx tests/unit/skills-page-layout.test.tsx --max-warnings=0`
   - 结果：通过
30. `pnpm run typecheck`
   - 结果：通过
31. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx --reporter=dot`
   - 结果：`1 passed / 10 passed`
   - 已覆盖技能卡片的方向键与 `Home / End` 桌面键盘导航
32. `pnpm exec eslint src/pages/Skills/index.tsx tests/unit/skills-page-layout.test.tsx --max-warnings=0`
   - 结果：通过
33. `pnpm run typecheck`
   - 结果：通过
34. `pnpm exec vitest run tests/unit/skills-page-layout.test.tsx tests/unit/skills-add-menu.test.tsx --reporter=dot`
   - 结果：`2 passed / 12 passed`
   - 已覆盖 `添加技能` 菜单只保留三个入口，并确认不再出现 `通过对话创建`

### 当前未完成

1. 真窗口下的桌面视觉 smoke 还未执行
2. 技能说明国际化目前仍是“首批覆盖”，不是对所有第三方 skill 说明的完整翻译
