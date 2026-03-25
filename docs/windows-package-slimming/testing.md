# Windows 包瘦身测试

## 自动化验证

已执行：

- `corepack pnpm test tests/unit/openclaw-bundle-pruning.test.ts`
- `corepack pnpm exec eslint scripts/after-pack.cjs scripts/openclaw-bundle-pruning.mjs tests/unit/openclaw-bundle-pruning.test.ts`
- `corepack pnpm run typecheck`

测试覆盖点：

- 目标平台只保留一个 `node-llama-cpp` CPU 预编译包
- 非目标架构包会被删除
- CUDA / CUDA-ext / Vulkan 变体会被删除

## 打包验证

已执行：

- `corepack pnpm run package`
- `corepack pnpm exec electron-builder -c config/build/electron-builder.config.cjs --win --publish never`

关键日志：

- `[after-pack] ✅ node-llama-cpp: removed 6 non-target or accelerator variants.`

## 体积结果

本地历史基线：

- `release/win-unpacked`：约 `1.4G`
- `release/XClaw-2026.3.23-x64.nsis.7z`：`423299469` bytes

本轮结果：

- `release/win-unpacked`：`660M`
- `release/win-unpacked/resources/openclaw`：`250M`
- `release/win-unpacked/resources/openclaw/node_modules/node-llama-cpp`：`2.6M`
- `release/win-unpacked/resources/openclaw/node_modules/@node-llama-cpp`：`4.0K`

## 当前环境限制

当前环境是 Linux 交叉打 Windows 包，`electron-builder` 最终仍然会因为缺少 `wine` 停止，所以这轮没有重新生成新的 NSIS 安装器 EXE。

另外，这个环境的 `build/openclaw` 里只有 Linux 侧 `@node-llama-cpp` 预编译包，交叉打 Windows 时会被全部裁掉；这不代表规则错误，而是宿主环境本身不提供 `win-x64` 预编译件。规则测试已经锁定：真正的 Windows 主机构建会保留 `@node-llama-cpp/win-x64` 或 `@node-llama-cpp/win-arm64` 的 CPU 包。
