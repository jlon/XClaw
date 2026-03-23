## 当前进度

### 已完成

- 新增 `config/release-branding.json`
- 新增 `electron-builder.config.cjs`，替代静态 `electron-builder.yml`
- 新增 `scripts/read-release-branding.mjs` 供 GitHub workflow 读取
- release workflow 改为从 branding 配置源读取 `owner/repo`、发布标题和 issue 链接
- 运行时帮助菜单改为从 branding 配置源读取文档入口

### 下一步

- 视需要继续把 `package.json` 与更多 UI 品牌文案抽成同源配置
