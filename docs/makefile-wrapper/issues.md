# Makefile 薄包装已知问题

## Windows 可用性边界

Windows 原生 PowerShell / CMD 默认没有 GNU Make。

因此：

- macOS / Linux / WSL / Git Bash 更适合直接使用 `make`
- 纯 Windows 原生命令行环境继续建议使用 `pnpm run package:*`

## 维护边界

如果未来新增新的 `package:*` 脚本，需要同步更新 `Makefile`，否则包装层会落后于真实入口。
