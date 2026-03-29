# 自动更新恢复设计

## 背景

当前仓库里的自动更新并不是“偶发失效”，而是被系统性降级成了禁用态：

1. `electron/main/updater.ts` 固定返回 disabled。
2. `src/stores/update.ts` 只保留禁用态和空动作。
3. 设置页更新面板只显示“当前版本 + 禁用说明”。
4. 官网下载同步脚本只同步下载按钮需要的安装包清单，没有同步 `electron-updater` 需要的 feed 元数据与差分文件。

所以，如果只改 `.github/workflows/package-beta.yml`，最多只能让 release 资产更像“可更新”，并不能让应用真的检查、下载和安装更新。

## 目标

本轮恢复的目标是：

1. Windows 打包版重新支持 Beta 通道的应用内检查、下载和安装更新。
2. macOS 打包版支持应用内检查新版本，并跳转手动下载安装 Beta 包。
3. 设置页可显示当前版本、最新版本、下载进度和手动更新提示。
4. 官网服务器可托管 `electron-updater` 所需的 Beta feed 文件、安装包和 blockmap。
5. 保持现有官网下载按钮逻辑，不为了自动更新重写整套官网下载页。

## 非目标

1. 本轮不恢复 Linux 自动更新，Linux 继续保留手动下载。
2. 本轮不做强制静默安装，也不做复杂的自动安装倒计时。
3. 本轮不重构 GitHub release 策略，只恢复基于静态 HTTP feed 的桌面更新闭环。
4. 本轮不为 `stable` 或 `dev` 通道构建发布体系，对外只保留 `beta`。

## 方案

### 1. 主进程 updater 恢复为真实运行时

主进程重新接回 `electron-updater`，但不再假设所有平台都能走同一条安装链路。Windows 继续使用 `electron-updater`，macOS 改成“检查版本 + 手动下载”的独立路径。

核心做法：

1. 在 `electron/main/updater.ts` 中包装 `autoUpdater`。
2. 维护统一状态机：
   - `idle`
   - `checking`
   - `available`
   - `not-available`
   - `downloading`
   - `downloaded`
   - `error`
   - `unsupported`
3. 更新源统一固定到：
   - `https://www.xclaw.live/downloads/updates/beta`
4. Windows 继续读取 canonical `latest*.yml`。
5. macOS 额外读取 `feed.json`，只拿版本号和 `.dmg` 下载名，不触发内置安装。

这样可以把“Windows 自动更新”和“macOS 手动覆盖安装”拆成两条最小可用路径，不再强行共用一套假设。

### 2. 设置页和 store 恢复为真实交互

设置页不会做成“网页式下载中心”，而是保持桌面软件常见的更新面板：

1. 顶部显示当前版本和通道。
2. 中部显示状态：
   - 正在检查
   - 发现新版本
   - 已是最新
   - 正在下载
   - 下载完成，等待安装
   - 不支持自动更新
3. 底部提供动作：
   - 检查更新
   - Windows：下载更新、重启并安装
   - macOS：下载最新版本
4. 恢复设置项：
   - 自动检查更新
   - Windows：自动下载更新
   - 固定 Beta 通道展示

`src/stores/update.ts` 作为状态单一入口，监听主进程事件并驱动 UI；`src/stores/settings.ts` 负责持久化更新偏好。

### 3. 打包配置恢复 generic publish

自动更新要可用，打包阶段必须重新产出 updater 元数据，并为安装包写入 publish 配置。

本轮做法：

1. 在 `electron-builder` 配置中恢复 `generic publish`。
2. 保留通道 metadata 生成，确保 Beta 构建带齐 `latest*.yml`。
3. 保留当前 Windows `x64 only beta` 优化，不回退到双架构合并包。

这一步的目的不是让 Electron 直接去访问 GitHub release，而是让构建产物具备完整 updater 元数据，再由官网服务器托管。

### 4. 官网新增独立 updater feed 同步

现有 `scripts/sync-release-downloads.sh` 只负责官网按钮下载清单，这个职责应该保持单一。

因此本轮新增独立脚本，例如 `scripts/sync-update-feeds.sh`，职责只做一件事：

1. 从 GitHub release 选择最新 beta release。
2. 下载该 release 对应的：
   - Windows 安装包
   - macOS dmg
   - yml metadata
   - blockmap
3. 写入服务器目录：
   - `/var/www/xclaw/downloads/updates/beta`
4. 生成 `feed.json` 供 macOS 手动更新入口读取。
5. 将通道内元数据统一映射为 `latest*.yml`，并保留旧版本 blockmap 供差分下载继续可用。

这能把“官网按钮下载”和“桌面自动更新 feed”彻底解耦，避免后续继续互相污染。

## 风险与取舍

### 1. Linux 暂不纳入自动更新

这是有意的 80/20 取舍，不是遗漏。当前用户最核心的桌面更新路径是 Windows 和 macOS；如果把 Linux 也一并做满，会把 feed 脚本、测试矩阵和失败路径显著放大。

### 2. macOS 不承诺内置自动安装

这不是体验让步，而是签名约束。当前没有 Apple 开发者签名，强行保留“内置自动安装”只会制造伪能力。

### 3. 静态 feed 目录必须保留旧 blockmap

差分更新依赖旧版本 blockmap。如果同步脚本按“覆盖最新版本”思路写，会让增量下载退化成全量下载。这是 feed 脚本的关键约束。
