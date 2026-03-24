# XClaw 下载同步设计

## 目标

把官网首页的三个下载按钮改成站点自有下载地址，不再直接落到 GitHub Releases 页面。

## 范围

- 新增一个手动执行的同步脚本
- 同步最新公开 release 的 3 个安装包到服务器固定目录
- 官网下载按钮改成固定下载地址
- Nginx 为 `/downloads/` 提供静态文件访问

## 下载地址设计

- 服务器真实文件路径保留版本号，例如：
  - `/downloads/v2026.3.24-beta.0/XClaw-2026.3.24-beta.0-mac-arm64.dmg`
  - `/downloads/v2026.3.24-beta.0/XClaw-2026.3.24-beta.0-mac-x64.dmg`
  - `/downloads/v2026.3.24-beta.0/XClaw-2026.3.24-beta.0-win-x64.exe`
- 官网不直接硬编码最新 tag，而是读取 `/downloads/latest.json`

## 同步策略

- 使用 GitHub 官方 releases API：`/repos/jlon/XClaw/releases?per_page=1`
- 只取最新一个非草稿发布结果，允许是 prerelease
- 文件匹配规则：
  - `macArm64` 对应 `-mac-arm64.dmg`
  - `macX64` 对应 `-mac-x64.dmg`
  - `win` 优先 `-win-x64.exe`，其次 `-win.exe`，最后兜底 `-win-arm64.exe`
- 同步后写入 `/downloads/latest.json`，提供最新 tag、真实文件名和访问 URL
- 同步脚本必须幂等：如果同版本文件已存在且大小一致，直接跳过下载

## 服务器落点

- 下载目录：`/var/www/xclaw/downloads`
- 手动同步脚本：`/usr/local/bin/xclaw-sync-downloads`
- 元数据文件：`/var/www/xclaw/downloads/latest.json`

## 设计约束

- 不做定时任务
- 不接对象存储
- 不增加新的官网按钮
- 下载文件必须与官网静态页面解耦，避免后续官网重发覆盖下载包
