# Windows 安装器日志与取消交互进度

## 2026-03-25

### 已完成

1. 复核用户截图，确认问题发生在 NSIS 安装器层，不是应用内 Setup 或 Studio。
2. 复核 electron-builder 配置，确认当前 Windows 包使用 assisted NSIS 且通过 `scripts/installer.nsh` 注入自定义逻辑。
3. 复核默认模板，确认日志缺失的直接原因是：
   - `ShowInstDetails nevershow`
   - `SetDetailsPrint none`
4. 复核用户反馈的新安装包异常，确认高风险点集中在安装页定时器、自定义回调和窗口句柄轮询方案。
5. 将安装器脚本回退到稳定的详情页展示方案，移除定时器覆盖文案逻辑。
6. 同步回退安装器行为约束测试，避免后续再次引入同类高风险逻辑。
7. 复核 electron-builder 的 `nsis.script` 行为，确认该方案会让 uninstaller 退出默认签名链，因此放弃。

### 进行中

1. 验证回退后的安装器脚本与打包链路是否正常。

### 下一步

1. 运行安装器相关测试。
2. 重新触发 Windows 打包。
3. 在 Windows 机器上人工验证安装流程稳定性、日志展示与取消交互。
