# 根目录清理验证

## 验证目标

1. `clean` 只删除默认产物，不删除 `build/`。
2. `clean:deep` 会额外删除 `build/`。
3. 删除根目录死文件后，不影响 lint、typecheck 或打包配置解析。

## 本次验证

已执行：

- `pnpm run clean`
- `pnpm exec eslint scripts/clean-artifacts.mjs --max-warnings=0`
- `pnpm run typecheck`

本次未执行：

- `pnpm run clean:deep`

原因：

- `clean:deep` 会额外删除 `build/`。
- 当前目标是收敛根目录噪音，不主动清掉仍可能复用的打包中间物。

## 结果

- `dist/`、`dist-electron/`、`release/`、`test-results/` 已由 `clean` 删除
- `.DS_Store` 已删除
- `build/` 仍保留，符合默认策略
- README 命令列表已与 `package.json` 同步
