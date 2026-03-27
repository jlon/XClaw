# Makefile 薄包装设计

## 背景

当前项目已经把真实打包逻辑放在 `package.json` 和 `scripts/*.mjs` 里，本地打包入口也已经稳定：

- `pnpm run package`
- `pnpm run package:mac`
- `pnpm run package:mac:adhoc`
- `pnpm run package:mac:local`
- `pnpm run package:win:x64`
- `pnpm run package:win`
- `pnpm run package:linux`
- `pnpm run release`

问题不是“缺少打包能力”，而是本地使用时命令偏长，尤其在 macOS / Linux / WSL 里经常需要重复敲同一组命令。

## 目标

新增一个本地可选的 `Makefile`，仅作为命令薄包装，降低记忆成本。

## 非目标

- 不把真实打包逻辑迁移进 `Makefile`
- 不让 CI 改走 `make`
- 不复制 `electron-builder` 参数
- 不新增另一套版本号或资源打包流程

## 方案

`Makefile` 只做静态目标映射，底层统一调用现有 `pnpm run ...`。

保留目标：

- `help`
- `package`
- `package-mac`
- `package-mac-adhoc`
- `package-mac-local`
- `package-win`
- `package-win-all`
- `package-linux`
- `release`

其中：

- `package-win` 映射到 `pnpm run package:win:x64`，对齐当前主流本地 Windows 打包习惯
- `package-win-all` 映射到 `pnpm run package:win`，保留多架构本地需求

## 约束

- `Makefile` 只作为本地开发便捷层
- Windows 原生 PowerShell / CMD 默认没有 `make`，这类环境继续直接使用 `pnpm`
- 文档里需要明确说明它是可选入口，而不是唯一入口
