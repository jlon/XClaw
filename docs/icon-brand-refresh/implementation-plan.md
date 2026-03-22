# 应用图标品牌对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 XClaw 的应用级图标链路统一为 OpenClaw 风格的龙虾品牌资产，并补齐 Web favicon 输出。

**Architecture:** 保持现有 Electron Builder 与主进程图标引用结构不变，只替换 `resources/icons` 的母版资源，并让图标生成脚本同时输出桌面端与 Web 端所需文件。页面功能图标继续保留 Lucide，不在本次范围内。

**Tech Stack:** Electron、Vite、Node.js、zx、sharp、png2icons

---

### Task 1: 重做品牌图标母版

**Files:**
- Modify: `resources/icons/icon.svg`
- Modify: `resources/icons/tray-icon-template.svg`

- [ ] 用 OpenClaw 风格重做主图 SVG
- [ ] 产出单色托盘模板 SVG

### Task 2: 扩展生成链

**Files:**
- Modify: `scripts/generate-icons.mjs`
- Modify: `index.html`

- [ ] 让脚本输出 `public/favicon.svg`
- [ ] 让脚本输出 `public/favicon.ico`
- [ ] 让脚本输出 `public/apple-touch-icon.png`
- [ ] 在 `index.html` 挂载 favicon 引用

### Task 3: 更新说明与验证

**Files:**
- Modify: `resources/icons/README.md`
- Create: `tests/unit/icon-brand-assets.test.ts`
- Modify: `docs/icon-brand-refresh/*`

- [ ] 更新图标资源说明
- [ ] 增加图标链路基础回归测试
- [ ] 运行 `pnpm run icons` 与相关验证
