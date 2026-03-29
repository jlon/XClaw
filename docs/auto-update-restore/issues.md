# 自动更新恢复问题清单

## 已确认问题

1. 自动更新主进程被整体 stub 掉，当前构建不会检查、下载或安装更新。
2. 设置页和更新 store 只剩“禁用说明”，用户无法在应用内感知新版本。
3. 官网当前只同步下载按钮所需的安装包清单，没有同步 updater feed 元数据。
4. 只修改 GitHub workflow 不能恢复自动更新，因为运行时和托管侧都缺失。

## 本轮约束

1. Windows 和 macOS 为首要支持对象。
2. Linux 继续维持手动下载，不在本轮补自动更新。
3. 需要保留当前 Windows beta 的 `x64 only` 体积优化。
4. 自动更新 feed 不能覆盖掉旧版本 blockmap，否则差分下载会失效。
5. macOS 没有 Apple 签名，不能承诺内置自动安装。

## 待验证事项

1. 当前线上 beta release 是否持续产出 Windows updater 所需的 `latest.yml + .exe` 和 mac 手动更新所需的 `latest-mac.yml + .dmg + feed.json`，需要持续复核。
2. beta 构建产物是否会生成完整通道 metadata，需要通过本地打包和 release artifact 共同确认。
3. 官网服务器现有目录权限和 Nginx 映射是否允许直接托管新的 `/downloads/updates/beta/*` 静态目录。
4. Windows 真实差分更新是否会命中 blockmap，而不是回退全量下载，需要用线上 feed 再验一次。
