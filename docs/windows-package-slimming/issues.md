# Windows 包瘦身问题记录

## 已确认问题

### 1. Linux 交叉打 Windows 包无法完成最终安装器产物

这个问题已经关闭。当前环境补齐 `wine`、`wine32`、`wine64` 和 `xvfb` 后，已经可以完成 Windows 安装器构建。

### 2. 交叉环境没有真正的 Windows `node-llama-cpp` 预编译件

当前 `build/openclaw` 来源于 Linux 宿主安装，因此只包含 Linux 侧 `@node-llama-cpp/*` 预编译包。`after-pack` 针对 Windows x64 的保留规则是正确的，但在这个环境里找不到对应 `win-x64` 包，只能把 Linux 变体全部裁掉。

### 3. GPU 加速变体不再默认内置

这轮的目标是桌面安装包显著瘦身，所以默认只保留目标架构 CPU 预编译包。`CUDA`、`CUDA-ext`、`Vulkan` 等加速变体不会再被默认捆绑。

### 4. 线上最新 Beta Release 仍然是旧提交产物

`gh release view v2026.3.24-beta.0` 显示当前线上 Beta Release 仍然指向 `9267b12`，还没有包含本地最新的瘦身提交，因此 Release 页面上的 Windows 安装包体积暂时不会自动变小。

## 后续候选项

### 1. 推送最新提交并重新触发 Beta 发布

需要先把当前本地 `ahead 2` 的提交推到远端，再重新执行 `package-beta.yml`，确认：

- GitHub Release 开始发布新的 `win-x64.exe`
- 旧的 `win.exe` 合并包不再出现
- Release 页面上的 Windows 资产体积显著下降

### 2. Windows 主机补一次真实安装器验证

需要在原生 Windows 环境重新执行 `pnpm run package:win` 或 `pnpm run package:win:x64`，确认：

- `@node-llama-cpp/win-x64` 被保留
- 安装器体积相对旧基线继续下降
- 本地 memory 的 CPU 路径可正常初始化

### 3. 评估是否需要保留可选 GPU 构建开关

如果后续发行策略需要同时提供“瘦身版”和“带 GPU 加速版”，可以考虑增加显式构建开关，而不是恢复默认全量捆绑。

### 4. 继续排查第二梯队重包

本轮裁掉最大头后，新的大包已经明显收敛，后续再评估：

- `pdfjs-dist`
- `playwright-core`
- `@larksuiteoapi`
- `openclaw` 文档资源
