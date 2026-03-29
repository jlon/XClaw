# 自动更新恢复进度

## 2026-03-26

### 已完成

1. 复核当前 `main` 上的 updater 代码，确认主进程、store、设置页都处于禁用态。
2. 复核打包配置和官网下载同步脚本，确认缺失的是 feed 托管链路，而不是单纯 workflow 参数。
3. 在隔离 worktree 中做过一次方案验证，结论已回收并转移到 `main`。
4. 明确本轮范围：Windows 保留 Beta 通道应用内自动更新，macOS 改为应用内检查 + 手动下载安装。
5. 接回 `electron-updater` 运行时，并由 XClaw 自己控制 Beta feed、Windows 自动下载偏好和 macOS 手动下载入口。
6. 恢复设置页更新面板，重新暴露当前版本、最新版本、自动检查、Windows 自动下载和 macOS 手动更新动作。
7. 在 `electron-builder` 中恢复 `generic publish` 和 Beta metadata 产出。
8. 新增 `scripts/sync-update-feeds.sh`，把官网按钮下载清单和桌面更新 feed 分离，并生成 `feed.json`。
9. README / README.zh-CN 已同步更新自动更新说明。
10. 已补齐 Windows / macOS 更新面板、feed 脚本和设置 store 的回归测试，并完成类型检查、ESLint 与脚本语法检查。

### 进行中

1. 等待实际官网服务器部署 feed 同步脚本。
2. 等待真实打包产物联调 `latest*.yml`、`feed.json` 与安装包目录。

### 下一步

1. 触发一次新的 beta 打包，确认 release 资产里带齐 `latest*.yml`、`feed.json` 所需资产、dmg、exe 和 blockmap。
2. 在官网服务器上部署 `scripts/sync-update-feeds.sh` 并校验 `/downloads/updates/beta/*` 可直接访问。
3. 在 Windows 实机上验证检查、下载、安装闭环，在 macOS 实机上验证检查更新和手动下载安装入口。
