# 工作室多皮肤切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 XClaw 工作室增加办公室主场景的预置多皮肤随机切换能力，支持每次进入自动随机和当前实例内手动换皮，同时保持现有 runtime surface 不重启。

**Architecture:** 在 XClaw renderer 侧新增一层“本次进入实例”的皮肤选择状态机，只负责随机、避让和入口行为；通过 host API 将皮肤 key 传给 `star-office-runtime`。`star-office-runtime` 负责根据皮肤注册表应用资产包、返回明确的成功/失败确认，并在失败时强制回退默认皮肤。皮肤资源只以固定皮肤包形式存在，不接入编辑系统。

**Tech Stack:** React 19、TypeScript、Electron host API、Flask runtime、Phaser 场景刷新、Vitest

---

## 文件结构与职责

### Renderer / Host

- Create: `electron/studio/skin-registry.ts`
  从 vendored runtime 资源目录直接读取皮肤注册表，供首次进入工作室前使用。
- Create: `src/lib/studio-skins.ts`
  负责本次工作室进入实例的皮肤锁、上一轮皮肤避让、手动换皮候选选择。
- Modify: `src/lib/studio.ts`
  增加预启动注册表读取、`applyStudioSkin`、初始 URL skin 参数拼接能力。
- Modify: `src/types/studio.ts`
  增加 studio 皮肤注册表与应用结果类型。
- Modify: `src/pages/Studio/index.tsx`
  在进入工作室时选择皮肤、将初始皮肤 key 拼入 runtime URL，并在右上角提供“换皮”入口。
- Modify: `src/i18n/locales/zh/studio.json`
- Modify: `src/i18n/locales/en/studio.json`
- Modify: `src/i18n/locales/ja/studio.json`
  增加换皮文案。
- Modify: `electron/api/routes/studio.ts`
  增加 `GET /api/studio/skins`、`POST /api/studio/skins/apply` 代理。

### Runtime

- Create: `scripts/star-office-runtime-overrides/frontend/skins/registry.json`
  皮肤注册表，声明 key、name、enabled、selectable、isDefaultFallback 与资源映射。
- Create: `scripts/star-office-runtime-overrides/frontend/skins/lodge-default/manifest.json`
- Create: `scripts/star-office-runtime-overrides/frontend/skins/ember-cabin/manifest.json`
- Create: `scripts/star-office-runtime-overrides/frontend/skins/frost-ops/manifest.json`
  三套首发皮肤包 manifest。
- Create: `scripts/star-office-runtime-overrides/backend/skin_registry.py`
  读取注册表、校验皮肤可用性、解析 manifest、返回默认回退皮肤。
- Modify: `scripts/star-office-runtime-overrides/backend/app.py`
  新增 `GET /studio/skins`、`POST /studio/skins/apply`、初始 `skinKey` 参数处理与失败回退逻辑。
- Modify: `scripts/star-office-runtime-overrides/frontend/electron-standalone.html`
  增加运行中的换皮应用入口与多资产刷新链路。
- Modify: `resources/star-office-runtime/backend/app.py`
- Modify: `resources/star-office-runtime/frontend/electron-standalone.html`
  同步当前 vendored runtime，保证本地运行立即可用。

### Tests

- Create: `tests/unit/studio-skins.test.ts`
  锁定随机策略、避让逻辑、单皮肤退化行为。
- Modify: `tests/unit/studio-routes.test.ts`
  锁定 host API 新路由与预启动注册表读取。
- Modify: `tests/unit/studio-page.test.tsx`
  锁定 Studio 初始皮肤参数与右上角换皮入口行为。

## 任务拆分

### Task 1: 锁定 renderer 皮肤状态机

**Files:**
- Create: `src/lib/studio-skins.ts`
- Modify: `src/types/studio.ts`
- Test: `tests/unit/studio-skins.test.ts`

- [ ] **Step 1: 写失败测试，锁定随机与状态规则**

在 `tests/unit/studio-skins.test.ts` 覆盖：
- 首次进入从 `enabled=true && selectable=true` 皮肤池随机
- 自动随机默认避开“上一次离开工作室时生效的皮肤”
- 手动换皮只从“除当前皮肤外”的可用池中选
- 只有一套可用皮肤时，手动换皮入口不可用
- 默认回退皮肤若 `selectable=false` 不进入随机池
- runtime 确认成功后才更新当前实例皮肤锁
- `ok=false && fallbackApplied=false` 时强制将当前状态收敛到默认回退皮肤

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run tests/unit/studio-skins.test.ts`
Expected: FAIL，提示缺少 `src/lib/studio-skins.ts` 或行为未实现

- [ ] **Step 3: 实现最小状态机**

在 `src/lib/studio-skins.ts` 提供最小 API：
- `selectEntryStudioSkin(...)`
- `selectManualStudioSkin(...)`
- `confirmStudioSkinApplied(...)`
- `recordStudioSkinOnLeave(...)`
- `resetStudioSkinSession(...)`

同时在 `src/types/studio.ts` 增加：
- `StudioSkinDescriptor`
- `StudioSkinApplyResult`

- [ ] **Step 4: 回跑测试**

Run: `pnpm exec vitest run tests/unit/studio-skins.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio-skins.ts src/types/studio.ts tests/unit/studio-skins.test.ts
git commit -m "feat: add studio skin session state"
```

### Task 2: 建立 runtime 皮肤注册表与 host API

**Files:**
- Create: `electron/studio/skin-registry.ts`
- Create: `scripts/star-office-runtime-overrides/frontend/skins/registry.json`
- Create: `scripts/star-office-runtime-overrides/frontend/skins/lodge-default/manifest.json`
- Create: `scripts/star-office-runtime-overrides/frontend/skins/ember-cabin/manifest.json`
- Create: `scripts/star-office-runtime-overrides/frontend/skins/frost-ops/manifest.json`
- Create: `scripts/star-office-runtime-overrides/backend/skin_registry.py`
- Modify: `scripts/star-office-runtime-overrides/backend/app.py`
- Modify: `resources/star-office-runtime/backend/app.py`
- Modify: `electron/api/routes/studio.ts`
- Modify: `src/lib/studio.ts`
- Test: `tests/unit/studio-routes.test.ts`

- [ ] **Step 1: 写失败测试，锁定 host API 路由**

在 `tests/unit/studio-routes.test.ts` 新增：
- `GET /api/studio/skins/registry` 在 runtime 未启动时也能返回可选皮肤列表
- `GET /api/studio/skins` 返回 runtime 皮肤列表
- `POST /api/studio/skins/apply` 将请求转发给 runtime
- 初始 frame 请求携带 `skinKey` 查询参数时，仍能正确透传

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run tests/unit/studio-routes.test.ts`
Expected: FAIL，提示新路由不存在

- [ ] **Step 3: 落 runtime 注册表与 API**

实现：
- `electron/studio/skin-registry.ts` 从 vendored runtime 资源直接读取注册表
- `skin_registry.py` 读取 `frontend/skins/registry.json`
- `GET /api/studio/skins/registry` 不依赖 runtime，直接返回 `enabled=true && selectable=true` 的候选皮肤与默认回退皮肤
- `GET /studio/skins` 返回 runtime 当前视角下的皮肤信息
- `POST /studio/skins/apply` 返回统一结果对象：
  - `ok`
  - `appliedSkinKey`
  - `fallbackApplied`
  - `reason`
- `electron-standalone?skinKey=...` 首次加载时先应用皮肤，再返回 HTML

- [ ] **Step 4: 暴露 renderer 调用入口**

在 `src/lib/studio.ts` 增加：
- `listStudioSkinRegistry()`
- `applyStudioSkin(payload)`
- `appendStudioSkinQuery(resolvedUrl, skinKey)`

在 `electron/api/routes/studio.ts` 对应新增代理。

- [ ] **Step 5: 同步 vendored runtime**

Run: `pnpm exec node scripts/vendor-star-office-runtime.mjs`
Expected: `resources/star-office-runtime` 吃到 overrides 更新

- [ ] **Step 6: 回跑路由测试**

Run: `pnpm exec vitest run tests/unit/studio-routes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add electron/studio/skin-registry.ts electron/api/routes/studio.ts src/lib/studio.ts tests/unit/studio-routes.test.ts scripts/star-office-runtime-overrides resources/star-office-runtime
git commit -m "feat: add studio skin registry api"
```

### Task 3: 支持运行中的工作室安全换皮

**Files:**
- Modify: `scripts/star-office-runtime-overrides/frontend/electron-standalone.html`
- Modify: `resources/star-office-runtime/frontend/electron-standalone.html`
- Modify: `scripts/star-office-runtime-overrides/backend/app.py`
- Modify: `resources/star-office-runtime/backend/app.py`

- [ ] **Step 1: 为换皮刷新链写最小手工验证脚本注释到 plan**

目标行为：
- 不重启 runtime
- 不重建 Electron workbench surface
- 应用皮肤后刷新受影响资产
- 失败时强制切回默认皮肤

- [ ] **Step 2: 扩展 runtime 应用逻辑**

在 backend：
- 在真正改动任何生效资源前，先对 skin manifest 做完整预检，确认所有映射资产都存在且可读
- 根据 manifest 将皮肤资源映射到当前生效资产
- 记录本次变更的 asset path 列表
- 返回给前端需要刷新的资产路径
- 只要预检或应用过程中任何一步失败，就直接切到默认回退皮肤，不允许留下半套新旧资源

- [ ] **Step 3: 扩展前端刷新能力**

在 `electron-standalone.html`：
- 将现有 `refreshSceneObjectByAssetPath` 扩展为支持图片和 spritesheet
- 增加统一 `applyStudioSkinRuntimeResult(...)`
- 对多资产刷新做串行或批量处理
- 如果任一资产刷新失败，立刻中断后续刷新并执行默认皮肤回退，保证场景最终只落在完整默认皮肤上

- [ ] **Step 4: 同步 vendored runtime**

Run: `pnpm exec node scripts/vendor-star-office-runtime.mjs`
Expected: `resources/star-office-runtime` 更新成功

- [ ] **Step 5: 手工验证 runtime 换皮链**

Run: `pnpm dev`
Expected:
- 首次进入工作室加载指定 `skinKey`
- 工作室内执行一次换皮时不重启 runtime
- 失败时稳定回到默认皮肤
- runtime 返回 `ok=false && fallbackApplied=false` 时，renderer 仍能强制收敛到默认回退皮肤

- [ ] **Step 6: Commit**

```bash
git add scripts/star-office-runtime-overrides resources/star-office-runtime
git commit -m "feat: support studio skin application in runtime"
```

### Task 4: 接入工作室入口行为与轻量换皮按钮

**Files:**
- Modify: `src/pages/Studio/index.tsx`
- Modify: `src/i18n/locales/zh/studio.json`
- Modify: `src/i18n/locales/en/studio.json`
- Modify: `src/i18n/locales/ja/studio.json`
- Test: `tests/unit/studio-page.test.tsx`

- [ ] **Step 1: 写失败测试，锁定入口行为**

在 `tests/unit/studio-page.test.tsx` 新增：
- 首次进入工作室前先读取 host 侧注册表，再决定 skin key
- 工作室首次 active 时会把 skin key 编码到 runtime URL
- 当前实例内显示“换皮”入口
- 只有一套可用皮肤时隐藏入口
- 手动换皮调用 `applyStudioSkin`
- runtime 返回 `ok=false && fallbackApplied=false` 时，Studio 页面强制将当前状态视为默认回退皮肤

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run tests/unit/studio-page.test.tsx`
Expected: FAIL，提示缺少换皮入口和皮肤参数逻辑

- [ ] **Step 3: 落地 Studio 页面行为**

在 `src/pages/Studio/index.tsx`：
- 进入工作室时先从 host 侧注册表选择本次皮肤
- 首次 webview/iframe URL 附加 `skinKey`
- 在工作室右上角渲染轻量“换皮”按钮
- 手动换皮期间显示轻量 loading 态
- 离开工作室时记录本轮最终皮肤
- 若 runtime 切皮响应 `ok=false && fallbackApplied=false`，前端主动把当前实例状态切回默认回退皮肤

- [ ] **Step 4: 补 i18n**

在 `src/i18n/locales/*/studio.json` 增加：
- `actions.switchSkin`
- `actions.switchingSkin`
- `actions.skinUnavailable`

- [ ] **Step 5: 回跑页面测试**

Run: `pnpm exec vitest run tests/unit/studio-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/Studio/index.tsx src/i18n/locales/zh/studio.json src/i18n/locales/en/studio.json src/i18n/locales/ja/studio.json tests/unit/studio-page.test.tsx
git commit -m "feat: wire studio entry skin switching"
```

### Task 5: 全链路验证与文档回写

**Files:**
- Modify: `docs/studio-multi-skin/progress.md`
- Modify: `docs/studio-multi-skin/testing.md`
- Modify: `docs/studio-multi-skin/issues.md`
- Modify: `README.md`（如需要）
- Modify: `README.zh-CN.md`（如需要）
- Modify: `README.ja-JP.md`（如需要）

- [ ] **Step 1: 跑定向验证**

Run:

```bash
pnpm exec vitest run tests/unit/studio-skins.test.ts tests/unit/studio-routes.test.ts tests/unit/studio-page.test.tsx
pnpm run typecheck
```

Expected:
- 所有定向测试通过
- typecheck 通过

- [ ] **Step 2: 跑手工工作室 smoke**

Run: `pnpm dev`
Checklist:
- 首次进入工作室自动随机
- 连续两次进入默认避开上一套皮肤
- 当前实例内“换皮”立即生效
- 离开后再次进入重新随机
- runtime 不重启
- 失败时回到默认皮肤

- [ ] **Step 3: 更新文档**

把实际交付结果写回：
- `docs/studio-multi-skin/progress.md`
- `docs/studio-multi-skin/testing.md`
- `docs/studio-multi-skin/issues.md`（如果实现过程中发现新的边界问题）
- `README.md`
- `README.zh-CN.md`
- `README.ja-JP.md`

- [ ] **Step 4: Commit**

```bash
git add docs/studio-multi-skin/progress.md docs/studio-multi-skin/testing.md docs/studio-multi-skin/issues.md README.md README.zh-CN.md README.ja-JP.md
git commit -m "docs: record studio multi-skin delivery"
```
