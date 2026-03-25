# Windows 安装器日志与取消交互设计

## 背景

当前 Windows 安装包使用 electron-builder 的 assisted NSIS 安装器。默认模板把安装详情设置为 `ShowInstDetails nevershow`，并且安装段起始处会执行 `SetDetailsPrint none`。这会导致用户只能看到进度条，看不到实时安装日志，安装阶段的取消交互也缺少明确反馈。

## 目标

本次只解决安装器层的可感知反馈问题：

1. 安装页默认展开实时日志。
2. 安装中的取消按钮保持可用。
3. 用户点击取消时给出确认，避免误触直接退出。
4. 保持现有 assisted installer 流程，不重写整套 electron-builder NSIS 模板。
5. 不引入会打断现有打包签名链的高风险改法。

## 非目标

1. 不重写 electron-builder 默认 `installer.nsi`。
2. 不实现安装中断后的细粒度回滚。
3. 不改应用内 Setup 或 Studio 页面。

## 方案

继续复用 `nsis.include` 扩展点，在 `scripts/installer.nsh` 中补三类能力：

1. 通过 `customHeader` 覆盖默认详情策略，把 `ShowInstDetails` 从 `nevershow` 调整为 `show`。
2. 通过 `customPageAfterChangeDir` 在 `MUI_PAGE_INSTFILES` 插入显示回调，在页面进入时：
   - 调用 `SetDetailsView show`
   - 调用 `SetDetailsPrint both`
   - 获取 `IDCANCEL` 并启用按钮
3. 在 `customCheckAppRunning` 的最前面再次恢复：
   - `SetDetailsView show`
   - `SetDetailsPrint both`
   - 取消按钮可用
   这样即使默认模板在安装段开头执行了 `SetDetailsPrint none`，实际解压与安装阶段的输出也会重新进入原生详情区。

取消确认不再自行接管 `.onUserAbort`，而是直接启用 MUI 原生 `abort warning`。原因是 assisted installer 模板本身已经生成取消确认入口，问题只是安装页的取消按钮被禁用后用户根本点不到。

## 风险与取舍

1. NSIS 安装中断后可能保留部分已解压文件，这是 NSIS assisted installer 的现实边界。本次不做伪回滚，也不包装成“完全可恢复”的假承诺，只提供真实可用的取消入口和明确确认提示。
2. 评估过切换到 `nsis.script` 自定义根脚本，但 electron-builder 在该模式下不会继续签名 uninstaller。当前需求并不需要为日志和取消去牺牲这条签名链，因此放弃该方案。
