# 工作台风格统一测试

## 测试目标

确认 `模型 / 智能体 / 频道 / 技能 / 定时任务` 五个工作台已经统一到同一套桌面级 header grammar，而不是只做了局部颜色调整。

## 自动化验证

### 代码级

- 为五个页面补统一结构断言：
  - 图标底盘存在
  - 标题/副标题比例一致
  - 动作按钮高度分级一致
  - 同一视口只允许一个主 CTA
  - summary strip 语义一致
  - 副标题默认是一行或一行半，不允许重新膨胀成说明段落
  - summary strip 优先是轻图标化状态单元，而不是完整解释句
- 为共享 primitive 补断言：
  - 不允许五页各自维护不同页头 class 组合
  - `WorkbenchHeader` 相关结构必须成为单一来源
- 为 motion 预算补断言：
  - 工作台页头内不允许新增页面专属 keyframes
  - 过渡时间必须落在统一 token 预算内
- 针对 `WorkspacePage` 相关页面补 source-level 回归锁，避免某页重新长回 hero 或 toolbar-only 结构
- 对统一按钮高度、图标底盘 class 和标题 class 做断言

### 必跑命令

- `pnpm exec vitest run tests/unit/workbench-style-unification.test.tsx --reporter=dot`
- `pnpm exec eslint src/components/layout/WorkbenchHeader.tsx src/components/layout/WorkbenchHeaderIcon.tsx src/components/layout/WorkbenchHeaderTitleBlock.tsx src/components/layout/WorkbenchHeaderActions.tsx src/components/layout/WorkbenchSummaryStrip.tsx src/pages/Cron/index.tsx tests/unit/workbench-style-unification.test.tsx --max-warnings=0`
- `pnpm run typecheck`

## 当前已验证

- `Cron` 已完成首个 shared header 迁移
- `Cron` 已明确去掉空态重复主 CTA
- `Cron` 新建/编辑链已显式透传 `agentId`
- `Cron` host route / IPC 创建链会拒绝空 `agentId`
- `Cron` 卡片已显式展示执行智能体
- `Cron` 页头、summary strip、任务卡片已收紧到桌面工具页语法，不再保留大 hero 和空摘要条
- 已实际通过：
  - `pnpm exec eslint src/pages/Cron/index.tsx electron/api/routes/cron.ts electron/main/ipc-handlers.ts --max-warnings=0`

## 当前阻塞

- `pnpm run typecheck` 仍被 `Models` 页的既有类型问题阻塞，与本轮 `Cron` 改动无关：
  - `src/pages/Models/components/ProviderBoard.tsx`
  - `src/pages/Models/index.tsx`

## 手工验收

### 1. 跨页切换

依次切换：

- 模型
- 智能体
- 频道
- 技能
- 定时任务

确认：

- 图标底盘是同一套语言
- 标题区比例一致
- 动作区节奏一致
- 页面没有突然变成 hero 或后台表格页
- 说明文字明显减少，不再先靠大段说明建立页面语义

### 2. 头部权重

确认：

- `模型` 不再过重
- `频道` 不再过轻
- `智能体` 不再只有裸标题
- `技能 / 定时任务` 不再单独使用另一套页头语法

### 3. 动效

确认：

- hover 强度一致
- loading 只在必要处 spin
- 没有某页独有的浮动、缩放或强调表演

### 4. 信息密度

确认：

- 副标题足够短，能删则删
- summary strip 更像桌面状态条，而不是说明栏
- 轻图标只帮助扫描，不形成装饰层
- 页面不会因为“更统一”而更拥挤

### 5. 平台

确认：

- mac 下足够轻、静、克制
- Windows 下边界足够清楚
- 两端保持同一工作台语言

## 风险点

- 只统一颜色，不统一结构
- `模型` 继续保留 billboard hero
- `频道` 继续保留工具栏级轻标题
- `智能体` 继续缺副标题和图标锚点
- 统一后把所有页面做成死板模板
- 为了“更像桌面”而增加过多阴影和动画，反而回到网页感
- 搜索框和主按钮重新变成两个互相争抢的视觉中心
- 为了“更有细节”而重新塞回大量说明文字
- 为了“更精致”而给每一行说明都补 icon，重新长回网页感
