# 根目录清理设计

## 背景

XClaw 根目录同时承载源码、Electron 打包配置、构建产物和本地调试遗留文件。当前问题不是功能错误，而是根目录噪音过高，容易让开发者误判哪些文件参与打包，哪些只是本地产物。

## 目标

1. 明确根目录中与打包直接相关的文件边界。
2. 把可再生产物收敛到显式清理脚本，而不是依赖手工删除。
3. 移除与构建、测试、打包均无引用关系的根目录死文件。

## 证据

### 打包主链

- `electron-builder.yml` 将 `release/` 作为输出目录。
- `vite.config.ts` 将前端与 Electron 构建输出到 `dist/` 与 `dist-electron/`。
- `electron-builder.yml` 的 `extraResources` 依赖 `build/openclaw/` 和 `build/preinstalled-skills/`。

### 死文件判定

- `test-anthropic.js` 与 `test-anthropic-url.js` 被 Git 跟踪。
- 它们不在 `package.json` scripts 中。
- 全仓库无任何引用。
- 两者内容近乎重复，属于一次性 Anthropic URL 验证脚本。

## 方案

### 保留

- 源码与配置：`src/`、`electron/`、`shared/`、`resources/`、`scripts/`、`package.json`、`config/build/electron-builder.config.cjs`、`config/macos/entitlements.mac.plist`
- 文档与工程元数据：`README*`、`LICENSE`、`SECURITY.md`、`AGENTS.md`

### 可清理

- 默认清理：`.DS_Store`、`dist/`、`dist-electron/`、`release/`、`test-results/`
- 深度清理：`build/`

### 删除

- `test-anthropic.js`
- `test-anthropic-url.js`

## 实施原则

1. `clean` 默认不删除 `build/`，避免误伤刚准备好的打包中间物。
2. `clean:deep` 才追加删除 `build/`，把重成本操作显式化。
3. 所有清理逻辑通过跨平台 Node 脚本实现，不引入仅适用于类 Unix 的命令。
