# Windows 包瘦身设计

## 背景

这轮瘦身不是从 UI 入手，而是从真实打包产物倒推。修改前，Windows 相关体积证据如下：

- `release/XClaw-2026.3.23-x64.nsis.7z`：`423299469` bytes
- `release/win-unpacked`：约 `1.4G`
- `build/openclaw`：约 `1.1G`
- `build/openclaw/node_modules/@node-llama-cpp`：约 `697M`

进一步拆开 `@node-llama-cpp` 后，最大的目录不是 CPU 版本，而是加速变体：

- `linux-x64-cuda-ext`：约 `443M`
- `linux-x64-cuda`：约 `151M`
- `linux-x64-vulkan`：约 `74M`
- `linux-x64`：约 `20M`

这说明继续调 NSIS 压缩级别没有意义，真正的问题是 bundle 里把同一平台下的多套 `node-llama-cpp` 预编译变体全部带进去了。

后续再对 GitHub Beta Release 做核对时，又确认了第二个问题：发布链路仍然在上传旧提交生成的双架构 Windows 安装器。即使本地已经把单架构体积压下去，Release 页面依然会继续出现 400 MB 以上的 `win-x64.exe` 和更大的合并版 `win.exe`。

## 方案选择

本轮选择在 `after-pack` 阶段做目标平台裁剪，而不是在 `bundle-openclaw` 阶段提前删除：

- `after-pack` 已经拿到真实的 `platform` 和 `arch`
- `bundle-openclaw` 只知道宿主环境，不知道最终 Electron 目标
- 目标平台裁剪放在 `after-pack`，不会误伤其他目标包

裁剪规则保持最小化：

- Windows x64：仅保留 `@node-llama-cpp/win-x64`
- Windows arm64：仅保留 `@node-llama-cpp/win-arm64`
- macOS arm64：仅保留 `@node-llama-cpp/mac-arm64-metal`
- macOS x64：仅保留 `@node-llama-cpp/mac-x64`
- Linux x64：仅保留 `@node-llama-cpp/linux-x64`
- Linux arm64：仅保留 `@node-llama-cpp/linux-arm64`
- Linux armv7l：仅保留 `@node-llama-cpp/linux-armv7l`

在此基础上，Beta 发布链路再做一层 2/8 收敛：

- 本地通用脚本 `package:win` 保持双架构能力，不破坏原有开发与补包能力
- GitHub `package-beta.yml` 改走专用的 `package:win:x64`
- `package:win:x64` 使用单独的 `electron-builder.win-x64.config.cjs`
- 专用配置只保留 `nsis/x64`，避免 `electron-builder` 根据基础配置再次产出 arm64 与合并版 `win.exe`

## 不做的事情

这轮明确不做下面这些高风险动作：

- 不直接移除 `node-llama-cpp` 整个包
- 不修改 renderer 或 Setup 的任何交互
- 不做按需下载或运行时补装
- 不顺手扩大到别的原生依赖
- 不把本地默认 Windows 打包脚本直接改成 x64-only

原因很直接：用户当前的核心诉求是 Windows 安装包过大，这个问题已经有足够强的证据指向 `node-llama-cpp` 变体冗余和 Beta 发布双架构冗余，先把这两个确定性收益拿到。
