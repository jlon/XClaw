## 目标

- 从仓库中移除 OSS 发布链路
- 禁用应用内置自动更新能力，不再执行检查、下载、安装
- 设置页只保留当前版本与中性说明
- 保持 GitHub Release 打包与发布能力，不再依赖 OSS

## 设计

### 主进程

- `electron/main/updater.ts` 固定返回 `disabled`
- `update:check / update:download / update:install` 全部改为无副作用禁用响应
- `update:setChannel / update:setAutoDownload / update:cancelAutoInstall` 改为 no-op
- 托盘移除“检查更新”入口

### Renderer

- `src/stores/update.ts` 不再读取自动检查和自动下载设置
- `UpdateSettings` 只显示：
  - 当前版本
  - 内置自动更新已禁用
  - 手动安装新版本的说明
- 设置页删除自动检查更新、自动下载更新开关

### 构建与发版

- `electron-builder.yml` 删除 OSS `generic publish`
- `.github/workflows/release.yml` 删除 OSS 上传 job 与相关脚本
- `finalize` 只依赖 GitHub Release 发布 job
- 本地 `release` 脚本不再用 `--publish always`

## 不做的事

- 本轮不修改版本号格式
- 本轮不重写 README
- 本轮不调整 GitHub prerelease 策略
- 本轮不清理 settings store 中遗留的更新偏好字段，只停止消费
