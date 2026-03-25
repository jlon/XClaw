# Windows 包瘦身测试

## 自动化验证

已执行：

- `corepack pnpm test tests/unit/openclaw-bundle-pruning.test.ts`
- `corepack pnpm test tests/unit/package-beta-workflow.test.ts`
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

## Beta 发布链路验证

已执行：

- `gh release view v2026.3.24-beta.0 --repo jlon/XClaw --json tagName,targetCommitish,publishedAt,assets`
- `corepack pnpm run clean`
- `SKIP_PREINSTALLED_SKILLS=1 corepack pnpm run package:win:x64`

关键证据：

- 线上最新 Beta Release `v2026.3.24-beta.0` 的 `targetCommitish` 是 `9267b127c2d2fc0df4bfcd4419008863da5f1505`
- 本地当前分支相对 `origin/main` 处于 `ahead 2`
- 线上旧资产：
  - `XClaw-2026.3.24-beta.0-win-x64.exe`：`451475588` bytes
  - `XClaw-2026.3.24-beta.0-win.exe`：`886986116` bytes
- 本地新的 x64-only 产物：
  - `release/XClaw-2026.3.23-win-x64.exe`：`174952234` bytes
  - `release/latest.yml` 只包含 `XClaw-2026.3.23-win-x64.exe`

补充说明：

- 这台环境访问部分 GitHub 仓库会偶发返回异常 `HTTP/0.9`，所以本地 `package:win:x64` 验证使用了 `SKIP_PREINSTALLED_SKILLS=1`
- 该开关不影响 Windows 目标筛选结论，只是绕开与本轮问题无关的外部技能拉取波动

## 当前环境限制

当前环境已经补齐 `wine`/`xvfb`，可以在 Linux 上完成 Windows NSIS 安装器构建。

另外，这个环境访问部分 GitHub 仓库仍然不稳定，所以涉及预装 skills 的完整打包偶尔会被外部网络打断；这不影响本轮针对 Windows 目标收敛和安装器体积的验证。
