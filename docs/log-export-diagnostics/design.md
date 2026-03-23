# 平台日志导出设计

## 背景

当前设置页只能查看最近日志、复制文本、打开日志目录。用户遇到问题时，仍然需要手动进入目录找文件，再发给支持同学，流程不稳定，也容易漏日志。

现有主日志已经统一由 Electron 主进程写入 `userData/logs/XClaw-YYYY-MM-DD.log`。Gateway 子进程的启动、退出和标准错误输出也会进入同一条主日志链。因此 v1 不需要去打包 `~/.openclaw`，也不应该带聊天 transcript。

## 目标

提供一个“一键导出平台日志包”的入口，帮助用户在设置里直接导出用于排障的 zip 文件。

## 范围

### 包含

- XClaw 平台日志目录中的最近日志文件
- 一个 `manifest.json`
- 设置页 `网关 -> 日志` 区域的导出入口

### 不包含

- `~/.openclaw` 配置
- provider 凭据、API key
- 聊天 transcript
- 自动运行 doctor
- OpenClaw runtime 文件

## 导出包内容

### 文件

- `logs/XClaw-*.log`
  - 默认导出最近 `10` 份平台日志
- `manifest.json`
  - `exportedAt`
  - `appVersion`
  - `platform`
  - `arch`
  - `logDir`
  - `fileCount`
  - 每个日志文件的 `name/size/modified`

### 格式

- 统一导出为 `zip`
- 默认文件名：`xclaw-logs-YYYYMMDD-HHmmss.zip`
- 默认保存到系统 `Downloads`

## 入口设计

位置：`设置 -> 网关 -> 日志`

按钮顺序：

1. 查看日志
2. 导出日志包
3. 打开文件夹

这样符合用户排障心智：先看，再导出，再手动打开目录。

## 交互

- 点击 `导出日志包`
  - 弹出系统保存对话框
  - 用户取消：静默结束
  - 导出成功：toast 提示导出了多少份日志
  - 失败：toast 提示失败

## 兼容性

- 统一使用 `zip`，兼容 `mac / Windows`
- 不依赖系统 `zip` 命令
- 不走平台特判文件格式

## 安全边界

- 只导出 XClaw 平台日志
- 不导出 OpenClaw 配置和凭据
- 不导出聊天记录

