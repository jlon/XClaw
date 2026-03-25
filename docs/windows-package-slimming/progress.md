# Windows 包瘦身进度

## 当前状态

- [x] 确认 Windows 包体积异常不是 Electron 壳导致
- [x] 定位 `@node-llama-cpp` 为最大体积来源
- [x] 明确 CPU / CUDA / Vulkan 变体同时入包的问题
- [x] 新增目标平台裁剪规则测试
- [x] 在 `after-pack` 接入 `node-llama-cpp` 目标平台裁剪
- [x] 完成 lint / typecheck / 单测验证
- [x] 重新执行本地 Windows 打包链路并看到 `after-pack` 裁剪日志
- [x] 把 `win-unpacked` 从约 `1.4G` 降到 `660M`
- [x] 用 `gh release` 核对线上 Beta Release 仍然指向旧提交 `9267b12`
- [x] 确认旧 Beta Release 的 `win-x64.exe` 仍为 `451475588` bytes，`win.exe` 为 `886986116` bytes
- [x] 为 Beta Windows 发布链路新增 `package:win:x64`
- [x] 用专用 builder config 把 Beta Windows 目标锁成 `nsis/x64`
- [x] 本地验证 `package:win:x64` 只产出 `win-x64.exe` 和单文件 `latest.yml`
- [ ] 在原生 Windows 环境验证新的 NSIS 安装器体积
- [ ] 在原生 Windows 环境验证本地 memory CPU 路径

## 本轮结论

这轮已经证明包瘦身方向正确，而且收益足够大，不需要再靠拍脑袋删别的依赖来凑数字。

新的事实是：线上 Beta 之所以看起来还“很大”，不是瘦身代码无效，而是 Release 还没有吃到最新提交；并且旧发布链路本身会额外生成双架构 Windows 资产。

下一轮如果继续做，必须坚持两条：

- 继续基于真实体积证据排序
- 任何裁剪都要先证明保留路径仍然可运行
