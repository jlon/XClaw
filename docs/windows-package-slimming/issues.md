# Windows 包瘦身问题记录

## 已确认问题

### 1. Linux 交叉打 Windows 包无法完成最终安装器产物

当前环境缺少 `wine`，`electron-builder` 在进入 Windows 签名/安装器阶段后会停止。这个问题与本轮裁剪逻辑无关，但会影响最终 NSIS 产物验证。

### 2. 交叉环境没有真正的 Windows `node-llama-cpp` 预编译件

当前 `build/openclaw` 来源于 Linux 宿主安装，因此只包含 Linux 侧 `@node-llama-cpp/*` 预编译包。`after-pack` 针对 Windows x64 的保留规则是正确的，但在这个环境里找不到对应 `win-x64` 包，只能把 Linux 变体全部裁掉。

### 3. GPU 加速变体不再默认内置

这轮的目标是桌面安装包显著瘦身，所以默认只保留目标架构 CPU 预编译包。`CUDA`、`CUDA-ext`、`Vulkan` 等加速变体不会再被默认捆绑。

## 后续候选项

### 1. Windows 主机补一次真实安装器验证

需要在原生 Windows 环境重新执行 `pnpm run package:win`，确认：

- `@node-llama-cpp/win-x64` 被保留
- 安装器体积相对旧基线继续下降
- 本地 memory 的 CPU 路径可正常初始化

### 2. 评估是否需要保留可选 GPU 构建开关

如果后续发行策略需要同时提供“瘦身版”和“带 GPU 加速版”，可以考虑增加显式构建开关，而不是恢复默认全量捆绑。

### 3. 继续排查第二梯队重包

本轮裁掉最大头后，新的大包已经明显收敛，后续再评估：

- `pdfjs-dist`
- `playwright-core`
- `@larksuiteoapi`
- `openclaw` 文档资源
