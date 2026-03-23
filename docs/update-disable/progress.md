## 当前进度

### 已完成

- 更新器已切换为固定禁用态
- 设置页更新 pane 已退化为“当前版本 + 禁用说明”
- 设置页自动检查更新、自动下载更新开关已移除
- 托盘“检查更新”入口已删除
- `electron-builder.yml` 已移除 OSS publish
- `release.yml` 已移除 OSS 上传链路
- `package.json` 的 `release` 脚本已停止使用 `--publish always`
- 菜单与内置 CLI 的旧 `claw-x.com / jlon/XClaw` 链接已移除
- 为更新禁用合同补充了测试

### 下一步

- 单独切版本号到日期格式
- 如需进一步清理，可删除 store 中历史更新偏好字段
