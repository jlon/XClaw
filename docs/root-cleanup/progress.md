# 根目录清理进度

## 2026-03-22

- 完成根目录文件分层排查，确认 `dist/`、`dist-electron/`、`release/`、`test-results/` 为可再生产物。
- 确认 `build/` 属于打包中间输入，不应纳入默认清理，但可以提供深度清理入口。
- 确认 `test-anthropic.js` 与 `test-anthropic-url.js` 无脚本引用、无仓库引用，判定为可删除死文件。
- 新增跨平台清理脚本 `scripts/clean-artifacts.mjs`，落地 `clean` 与 `clean:deep`。
- 已删除根目录死文件 `test-anthropic.js` 与 `test-anthropic-url.js`。
- 已执行默认清理，移除 `.DS_Store`、`dist/`、`dist-electron/`、`release/`、`test-results/`。
