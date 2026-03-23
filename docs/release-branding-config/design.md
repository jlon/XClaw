## 设计

本轮目标不是立刻改品牌，而是把 GitHub Release 的 `owner/repo` 与打包品牌文案从散落常量抽成单点配置源，避免 fork 后继续漏改。

### 单点配置源

- 新增 `config/release-branding.json`
- 统一承载：
  - `appId`
  - `productName`
  - `executableName`
  - `vendor`
  - `teamName`
  - `maintainerEmail`
  - `copyrightOwner`
  - `description`
  - `releaseSummary`
  - `synopsis`
  - `desktopComment`
  - `documentationLabel`
  - `documentationUrl`
  - `githubOwner`
  - `githubRepo`

### 代码消费点

- `electron-builder` 不再使用静态 `electron-builder.yml`，改成 `electron-builder.config.cjs` 读取 JSON
- GitHub Release workflow 通过 `scripts/read-release-branding.mjs` 读取配置并输出到 `GITHUB_OUTPUT`
- 运行时帮助菜单使用同一份配置中的文档入口

### 不做的事

- 本轮不切版本号到日期格式
- 本轮不重写 README
- 本轮不引入环境变量优先级链，先保持文件级单点配置
