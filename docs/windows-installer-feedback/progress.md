# Windows 安装器日志与取消交互进度

## 2026-03-25

### 已完成

1. 复核用户截图，确认问题发生在 NSIS 安装器层，不是应用内 Setup 或 Studio。
2. 复核 electron-builder 配置，确认当前 Windows 包使用 assisted NSIS 且通过 `scripts/installer.nsh` 注入自定义逻辑。
3. 复核默认模板，确认日志缺失的直接原因是：
   - `ShowInstDetails nevershow`
   - `SetDetailsPrint none`
4. 新增安装器行为约束测试草案。
5. 复核 electron-builder 的 `nsis.script` 行为，确认该方案会让 uninstaller 退出默认签名链，因此放弃。

### 进行中

1. 在 `scripts/installer.nsh` 中补安装页日志与取消交互。

### 下一步

1. 完成 NSIS 宏与回调实现。
2. 运行测试与类型检查。
3. 重新触发 Windows 打包并人工验证安装器效果。
