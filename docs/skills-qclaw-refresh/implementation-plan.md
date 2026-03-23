# Skills QClaw Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `XClaw` 的技能页重构为对齐本机版 `QClaw` 的桌面技能管理中心：主页只展示本地技能网格，外部 provider 发现进入 `添加技能` 次级流，安装通过聊天页承接但底层仍走可靠 host action / adapter。

**Architecture:** 先在 Electron host 层补齐技能 provenance 和 provider adapter，再在 renderer 层把当前单文件技能页拆成“本地技能中心 + 添加技能次级流 + 轻量详情模态”三块。所有主交互都围绕本地技能中心展开，`ClawHub / SkillHub` 搜索与安装不再直接污染主页搜索。

**Tech Stack:** Electron host-api、React 19、React Router、Zustand、Radix Dialog/DropdownMenu、Vitest、Testing Library、i18next

---

## 文件结构

### 现有文件

- Modify: `src/pages/Skills/index.tsx`
  - 当前单文件页面，后续改为 Skills 页组合入口，不再承载全部细节实现
- Modify: `src/stores/skills.ts`
  - 当前本地技能和 ClawHub 搜索/安装混在一起，需改为本地技能中心 store
- Modify: `src/stores/chat.ts`
  - 聊天页需要消费 Skills 生成的结构化草案，并在可执行场景下走确定性的本地执行链
- Modify: `src/types/skill.ts`
  - 需要扩展 provenance、provider id、catalog/install draft 类型
- Modify: `electron/api/routes/skills.ts`
  - 需要新增本地技能 catalog、provider search、install draft 相关 host 路由
- Modify: `electron/utils/skill-config.ts`
  - 已有 `preinstalled-manifest` 和 `.XClaw-preinstalled.json` 逻辑，需要抽出可供 route 复用的 provenance 读取函数
- Modify: `src/i18n/locales/zh/skills.json`
- Modify: `src/i18n/locales/en/skills.json`
- Modify: `src/i18n/locales/ja/skills.json`
- Modify: `tests/unit/skills-errors.test.ts`
- Modify: `tests/unit/theme-second-wave-pages.test.ts`
- Modify: `tests/unit/chat-target-routing.test.ts`

### 新增文件

- Create: `electron/gateway/skillhub.ts`
  - 封装腾讯 SkillHub 搜索、详情字段归一化、install draft 生成
- Create: `electron/utils/skill-provenance.ts`
  - 负责把 manifest、marker、本地目录与 gateway 状态合并成产品级来源语义
- Create: `src/pages/Skills/components/SkillsHeader.tsx`
  - 标题、副说明、搜索框、添加技能按钮
- Create: `src/pages/Skills/components/SkillsGrid.tsx`
  - 本地技能网格
- Create: `src/pages/Skills/components/SkillCard.tsx`
  - 桌面卡片
- Create: `src/pages/Skills/components/SkillDetailModal.tsx`
  - 居中轻量详情模态
- Create: `src/pages/Skills/components/AddSkillMenu.tsx`
  - `添加技能` 菜单
- Create: `src/pages/Skills/components/GitHubImportDialog.tsx`
  - GitHub 导入轻量输入模态
- Create: `src/pages/Skills/components/SkillCatalogModal.tsx`
  - `ClawHub / SkillHub` 搜索结果二级面板
- Create: `src/pages/Skills/skills-chat-drafts.ts`
  - renderer 侧“创建技能 / GitHub 导入 / provider 安装”聊天草案构造与跳转参数
- Create: `src/components/ui/dialog.tsx`
  - 基于 Radix Dialog 的通用轻量模态原语
- Create: `src/components/ui/dropdown-menu.tsx`
  - 基于 Radix DropdownMenu 的通用菜单原语
- Create: `tests/unit/skills-page.test.tsx`
- Create: `tests/unit/skills-add-menu.test.tsx`
- Create: `tests/unit/skills-detail-modal.test.tsx`
- Create: `tests/unit/skills-provenance.test.ts`
- Create: `tests/unit/skills-store.test.ts`
- Create: `tests/unit/skills-provider-adapters.test.ts`
- Create: `tests/unit/skills-install-intent.test.ts`
- Create: `tests/unit/skills-install-routing.test.ts`
- Create: `tests/unit/skills-keyboard-navigation.test.tsx`
- Create: `tests/unit/skills-toggle-state.test.tsx`
- Create: `tests/unit/skills-context-menu.test.tsx`

## Task 1: 建立技能 provenance 数据链

**Files:**
- Create: `electron/utils/skill-provenance.ts`
- Modify: `electron/utils/skill-config.ts`
- Modify: `electron/api/routes/skills.ts`
- Modify: `src/types/skill.ts`
- Test: `tests/unit/skills-provenance.test.ts`

- [ ] **Step 1: 写 provenance 红测**

覆盖：
- `preinstalled-manifest.json + .XClaw-preinstalled.json -> xclaw-preinstalled`
- `bundled` 不直接映射为 `内置技能`
- `openclaw-managed / workspace / extra / agents-*` 保持独立来源

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-provenance.test.ts --reporter=dot`
Expected: FAIL，提示 provenance 读取函数或类型不存在

- [ ] **Step 3: 在 host 层实现 provenance 合并**

实现：
- 从 `skill-config.ts` 暴露读取 manifest、marker 的最小 helper
- 在 `skill-provenance.ts` 中合并 gateway skills、clawhub list、本地 marker 信息
- 输出统一来源枚举与显示标签映射所需字段

- [ ] **Step 4: 扩展前端 skill 类型**

在 `src/types/skill.ts` 增加：
- `provenance`
- `displaySourceLabel`
- `providerId?`
- `installCapability?`

- [ ] **Step 5: 在 host route 暴露本地技能 catalog 接口**

新增如 `/api/skills/catalog` 的读取接口，返回已经合并 provenance 的本地技能集合，供 Skills 页面主网格使用

- [ ] **Step 6: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-provenance.test.ts --reporter=dot`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add electron/utils/skill-provenance.ts electron/utils/skill-config.ts electron/api/routes/skills.ts src/types/skill.ts tests/unit/skills-provenance.test.ts
git commit -m "feat: add skill provenance pipeline"
```

## Task 2: 补齐 ClawHub / SkillHub provider adapter

**Files:**
- Create: `electron/gateway/skillhub.ts`
- Modify: `electron/api/routes/skills.ts`
- Modify: `src/types/skill.ts`
- Test: `tests/unit/skills-provider-adapters.test.ts`

- [ ] **Step 1: 写 provider adapter 红测**

覆盖：
- `ClawHub` 搜索结果统一化
- `SkillHub` 搜索结果统一化
- provider result 必须带 `provider-qualified id`
- adapter 能输出 install draft 所需字段

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-provider-adapters.test.ts --reporter=dot`
Expected: FAIL，提示 `SkillHub` service/adapter 不存在

- [ ] **Step 3: 实现 SkillHub service**

在 `electron/gateway/skillhub.ts` 中实现：
- 远程搜索，固定使用 `https://lightmake.site/api/skills` 与 `https://lightmake.site/api/skills/top`
- 字段归一化
- provider-qualified id 生成
- install draft 生成所需最小 metadata
- 无法联网、接口 4xx/5xx、字段不兼容时返回 provider 级错误，不影响主技能页本地网格

- [ ] **Step 4: 复用并包装 ClawHub 结果**

在 `skills.ts` route 或 adapter 层把现有 `ClawHubService` 输出包装为统一 provider result 结构，而不是让 renderer 继续直接依赖旧 `MarketplaceSkill`

- [ ] **Step 5: 暴露 provider 搜索接口**

新增如：
- `/api/skills/providers/clawhub/search`
- `/api/skills/providers/skillhub/search`

- [ ] **Step 6: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-provider-adapters.test.ts --reporter=dot`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add electron/gateway/skillhub.ts electron/api/routes/skills.ts src/types/skill.ts tests/unit/skills-provider-adapters.test.ts
git commit -m "feat: add skills provider adapters"
```

## Task 3: 定义确定性的安装草案与执行链

**Files:**
- Create: `src/pages/Skills/skills-chat-drafts.ts`
- Modify: `src/stores/skills.ts`
- Modify: `src/stores/chat.ts`
- Modify: `src/pages/Chat/index.tsx`
- Modify: `electron/api/routes/skills.ts`
- Modify: `electron/gateway/skillhub.ts`
- Test: `tests/unit/skills-install-intent.test.ts`
- Test: `tests/unit/skills-install-routing.test.ts`
- Test: `tests/unit/chat-target-routing.test.ts`

- [ ] **Step 1: 写安装草案红测**

覆盖：
- 从 `GitHub 导入` 进入聊天时生成导入草案
- 从 `ClawHub` 结果进入安装时生成自然语言安装意图和结构化 draft
- 从 `SkillHub` 结果进入安装时生成自然语言安装意图和结构化 draft
- draft 明确包含 `execution.kind`
  - `host-install`
  - `chat-prompt`
- 聊天侧会消费 draft，而不是只把一段自由文本丢给模型

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-install-intent.test.ts tests/unit/skills-install-routing.test.ts tests/unit/chat-target-routing.test.ts --reporter=dot`
Expected: FAIL，提示 install draft/handoff 逻辑不存在

- [ ] **Step 3: 实现 skills chat draft 构造器**

在 `skills-chat-drafts.ts` 中定义：
- github-import draft
- provider
- providerSkillId
- slug
- name
- draft message
- execution.kind
- execution.payload
- return context metadata

- [ ] **Step 4: 在 host 层定义安装执行 contract**

新增统一执行入口，例如：
- `/api/skills/install/execute`

执行规则：
- `clawhub` + `host-install` -> 直接落到现有 `ClawHubService.install`
- `skillhub` + `chat-prompt` -> 由 `SkillHub` adapter 生成固定 agent prompt 与 provider metadata
- `github-import` + `chat-prompt` -> 生成固定导入 prompt

- [ ] **Step 5: 在聊天侧实现 deterministic dispatch**

要求：
- 聊天页或 chat store 识别来自 Skills 的 draft
- `host-install` 直接调用 host route 执行
- `chat-prompt` 使用 adapter 生成的固定 prompt 发起，不让模型自己编造安装语句
- 成功/失败事件能回写给 Skills 连续性层

- [ ] **Step 6: 在 Skills 页 store 中增加跳聊天 handoff**

要求：
- Skills 页不直接安装
- 选择 provider 结果后导航到聊天页
- 附带 install draft 和返回上下文
- `从 GitHub 导入` 走同一套 draft contract

- [ ] **Step 7: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-install-intent.test.ts tests/unit/skills-install-routing.test.ts tests/unit/chat-target-routing.test.ts --reporter=dot`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src/pages/Skills/skills-chat-drafts.ts src/stores/skills.ts src/stores/chat.ts src/pages/Chat/index.tsx electron/api/routes/skills.ts electron/gateway/skillhub.ts tests/unit/skills-install-intent.test.ts tests/unit/skills-install-routing.test.ts tests/unit/chat-target-routing.test.ts
git commit -m "feat: add deterministic skills install handoff"
```

## Task 4: 实现 Skills 与 Chat 的往返连续性

**Files:**
- Modify: `src/stores/skills.ts`
- Modify: `src/pages/Skills/index.tsx`
- Modify: `src/pages/Chat/index.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/unit/skills-errors.test.ts`
- Test: `tests/unit/skills-store.test.ts`
- Test: `tests/unit/skills-install-routing.test.ts`

- [ ] **Step 1: 写连续性红测**

覆盖：
- 记录 Skills 页搜索词
- 记录 Skills 页滚动位置
- 记录当前激活的 provider 面板与 provider 查询词
- 安装成功后返回 Skills 并刷新本地网格
- 安装取消/失败后返回原 provider 结果列表以便重试

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-store.test.ts tests/unit/skills-install-routing.test.ts tests/unit/skills-errors.test.ts --reporter=dot`
Expected: FAIL，提示 Skills 连续性状态与错误恢复不存在

- [ ] **Step 3: 在 Skills store 中增加连续性状态**

至少包含：
- `localQuery`
- `scrollTop`
- `activeProvider`
- `providerQuery`
- `providerResults`
- `pendingDraft`
- `lastInstallResult`

- [ ] **Step 4: 在路由与页面层实现恢复**

要求：
- 从 Skills 跳到 Chat 时保留状态
- Chat 完成后能带结果返回 Skills
- Skills 恢复搜索词、滚动位置与 provider 结果面板

- [ ] **Step 5: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-store.test.ts tests/unit/skills-install-routing.test.ts tests/unit/skills-errors.test.ts --reporter=dot`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/stores/skills.ts src/pages/Skills/index.tsx src/pages/Chat/index.tsx src/App.tsx tests/unit/skills-store.test.ts tests/unit/skills-install-routing.test.ts tests/unit/skills-errors.test.ts
git commit -m "feat: preserve skills chat round-trip state"
```

## Task 5: 引入桌面级 Dialog / Dropdown 原语

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Test: `tests/unit/skills-add-menu.test.tsx`
- Test: `tests/unit/skills-detail-modal.test.tsx`

- [ ] **Step 1: 写 UI 原语使用红测**

覆盖：
- `添加技能` 菜单可打开/关闭
- 技能详情使用居中模态而不是右侧厚抽屉

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx --reporter=dot`
Expected: FAIL，提示 dialog/dropdown UI 组件不存在

- [ ] **Step 3: 实现轻量通用 Dialog**

基于 `@radix-ui/react-dialog` 新建 `src/components/ui/dialog.tsx`

- [ ] **Step 4: 实现轻量通用 DropdownMenu**

基于 `@radix-ui/react-dropdown-menu` 新建 `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 5: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx --reporter=dot`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/ui/dialog.tsx src/components/ui/dropdown-menu.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx
git commit -m "feat: add desktop dialog and dropdown primitives"
```

## Task 6: 拆分并重建 Skills 主页面

**Files:**
- Modify: `src/pages/Skills/index.tsx`
- Create: `src/pages/Skills/components/SkillsHeader.tsx`
- Create: `src/pages/Skills/components/SkillsGrid.tsx`
- Create: `src/pages/Skills/components/SkillCard.tsx`
- Create: `src/pages/Skills/components/SkillDetailModal.tsx`
- Create: `src/pages/Skills/components/AddSkillMenu.tsx`
- Create: `src/pages/Skills/components/GitHubImportDialog.tsx`
- Create: `src/pages/Skills/components/SkillCatalogModal.tsx`
- Modify: `src/stores/skills.ts`
- Modify: `src/i18n/locales/zh/skills.json`
- Modify: `src/i18n/locales/en/skills.json`
- Modify: `src/i18n/locales/ja/skills.json`
- Test: `tests/unit/skills-page.test.tsx`
- Test: `tests/unit/theme-second-wave-pages.test.ts`

- [ ] **Step 1: 写主页面红测**

覆盖：
- 标题、副说明
- `搜索已经安装的技能`
- `添加技能`
- 单一技能网格
- 卡片包含标签、开关、更多菜单
- 主页面不再出现当前后台式批量操作和厚抽屉结构

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-page.test.tsx tests/unit/theme-second-wave-pages.test.ts --reporter=dot`
Expected: FAIL，主结构与断言不匹配

- [ ] **Step 3: 拆分 Skills 页面组件**

将 `src/pages/Skills/index.tsx` 收成组合入口，页面职责只保留：
- 加载数据
- 管理搜索词
- 管理当前 modal/menu 状态
- 组装主页面组件

- [ ] **Step 4: 实现桌面级头部与搜索**

要求：
- 主搜索仅搜索本地技能
- 工具栏不再出现旧的批量控制和商店式搜索

- [ ] **Step 5: 实现单一技能网格**

要求：
- 两列桌面网格
- 轻来源标签
- 可直接启停
- 卡片主体打开详情模态

- [ ] **Step 6: 实现 `添加技能` 次级流**

菜单必须包含：
- `从 GitHub 导入`
- `从 ClawHub 搜索`
- `从 SkillHub 搜索`

要求：
- `从 GitHub 导入` 打开轻量输入模态，收集仓库 URL 与可选路径，再进入 Task 3 的聊天草案

- [ ] **Step 7: 实现 provider 搜索二级面板**

要求：
- 与主页面分层
- 不把 provider 结果混进本地技能主网格
- 选择结果后进入 Task 3 的聊天安装 handoff

- [ ] **Step 8: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-page.test.tsx tests/unit/theme-second-wave-pages.test.ts tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx --reporter=dot`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add src/pages/Skills/index.tsx src/pages/Skills/components src/stores/skills.ts src/i18n/locales/zh/skills.json src/i18n/locales/en/skills.json src/i18n/locales/ja/skills.json tests/unit/skills-page.test.tsx tests/unit/theme-second-wave-pages.test.ts
git commit -m "feat: rebuild skills page as qclaw-style desktop center"
```

## Task 7: 补齐桌面交互契约

**Files:**
- Modify: `src/pages/Skills/components/SkillCard.tsx`
- Modify: `src/pages/Skills/components/SkillDetailModal.tsx`
- Modify: `src/pages/Skills/components/AddSkillMenu.tsx`
- Modify: `src/pages/Skills/components/SkillCatalogModal.tsx`
- Test: `tests/unit/skills-keyboard-navigation.test.tsx`
- Test: `tests/unit/skills-toggle-state.test.tsx`
- Test: `tests/unit/skills-context-menu.test.tsx`

- [ ] **Step 1: 写交互红测**

覆盖：
- `Tab / Arrow / Enter / Space / Esc`
- 开关 `pending / rollback / disabled-with-reason`
- 更多菜单非 hover 可访问

- [ ] **Step 2: 运行红测确认失败**

Run: `pnpm exec vitest run tests/unit/skills-keyboard-navigation.test.tsx tests/unit/skills-toggle-state.test.tsx tests/unit/skills-context-menu.test.tsx --reporter=dot`
Expected: FAIL，键盘/开关状态/菜单访问不满足断言

- [ ] **Step 3: 实现焦点与键盘导航**

要求：
- 卡片网格方向键移动
- `Esc` 正确关闭当前层并返回焦点

- [ ] **Step 4: 实现开关状态机**

要求：
- pending 时禁止重复点按
- 失败时回滚
- 不允许操作时展示原因

- [ ] **Step 5: 实现 `...` 菜单完整可访问路径**

要求：
- 鼠标可点
- 键盘可开
- 右键或等价 secondary action 可触达

- [ ] **Step 6: 重新运行单测**

Run: `pnpm exec vitest run tests/unit/skills-keyboard-navigation.test.tsx tests/unit/skills-toggle-state.test.tsx tests/unit/skills-context-menu.test.tsx --reporter=dot`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/pages/Skills/components/SkillCard.tsx src/pages/Skills/components/SkillDetailModal.tsx src/pages/Skills/components/AddSkillMenu.tsx src/pages/Skills/components/SkillCatalogModal.tsx tests/unit/skills-keyboard-navigation.test.tsx tests/unit/skills-toggle-state.test.tsx tests/unit/skills-context-menu.test.tsx
git commit -m "feat: add desktop interaction model to skills center"
```

## Task 8: 完整验证与文档收尾

**Files:**
- Modify: `docs/skills-qclaw-refresh/testing.md`
- Modify: `docs/skills-qclaw-refresh/issues.md`
- Modify: `docs/skills-qclaw-refresh/progress.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`

- [ ] **Step 1: 运行 Skills 相关单测**

Run:
```bash
pnpm exec vitest run tests/unit/skills-page.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-provenance.test.ts tests/unit/skills-store.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-install-intent.test.ts tests/unit/skills-install-routing.test.ts tests/unit/skills-keyboard-navigation.test.tsx tests/unit/skills-toggle-state.test.tsx tests/unit/skills-context-menu.test.tsx tests/unit/skills-errors.test.ts tests/unit/theme-second-wave-pages.test.ts tests/unit/chat-target-routing.test.ts --reporter=dot
```
Expected: PASS

- [ ] **Step 2: 运行 lint**

Run:
```bash
pnpm exec eslint src/pages/Skills/index.tsx src/pages/Skills/components electron/api/routes/skills.ts electron/gateway/skillhub.ts electron/utils/skill-provenance.ts electron/utils/skill-config.ts src/stores/skills.ts src/types/skill.ts src/components/ui/dialog.tsx src/components/ui/dropdown-menu.tsx tests/unit/skills-page.test.tsx tests/unit/skills-add-menu.test.tsx tests/unit/skills-detail-modal.test.tsx tests/unit/skills-provenance.test.ts tests/unit/skills-store.test.ts tests/unit/skills-provider-adapters.test.ts tests/unit/skills-install-intent.test.ts tests/unit/skills-install-routing.test.ts tests/unit/skills-keyboard-navigation.test.tsx tests/unit/skills-toggle-state.test.tsx tests/unit/skills-context-menu.test.tsx --max-warnings=0
```
Expected: PASS

- [ ] **Step 3: 运行类型检查**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: 做桌面人工验收**

人工检查：
- `macOS`
- `Windows`
- `125% / 150% / 200%`
- 高对比
- 减少动画

- [ ] **Step 5: 更新文档**

补齐：
- 实际测试命令
- 已知遗留问题
- 进度结论
- README 中 Skills 页新结构与安装流说明

- [ ] **Step 6: 提交**

```bash
git add docs/skills-qclaw-refresh README.md README.zh-CN.md README.ja-JP.md
git commit -m "docs: record qclaw-style skills center rollout"
```

## 实施顺序建议

1. 先做数据 provenance，不然“内置技能”永远是假的。
2. 再做 provider adapter，不然后面的添加技能流没有可靠底层。
3. 然后做聊天安装 handoff，避免 UI 做完却无法进入安装。
4. 最后再做 Skills 页面 UI 重构和桌面交互补全。

## 风险控制

1. 如果 `SkillHub` 接口不稳定，先保证 `ClawHub` 可靠链路打通，同时给 `SkillHub` 做 graceful fallback。
2. 如果 `SkillHub` 的远端 schema 发生漂移，保留 provider 面板级 fallback，不得影响主技能页本地网格。
3. 如果 `src/pages/Skills/index.tsx` 重构过大，优先拆组件再移动逻辑，避免单次 patch 失控。

## 完成定义

满足以下条件后，才算这轮完成：

1. 主页面结构与 QClaw 技能中心一致。
2. 主搜索只搜索本地技能。
3. `添加技能` 才进入 provider 搜索。
4. `内置技能` 标签基于真实 `xclaw-preinstalled` 证据。
5. 安装通过聊天承接，但底层执行链可靠。
6. 键盘、焦点、缩放、开关状态满足桌面约束。
7. 单测、lint、typecheck 通过，并完成桌面人工验收。
