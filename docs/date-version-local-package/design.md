## 设计

本轮目标有两件：

1. 版本号从手工 semver 改成发版时自动生成的日期版号
2. 本地 mac 打包形成闭环，不再依赖外部下载 Electron 资产，也不再需要人工补压 zip

### 日期版号

- 新增 `scripts/version-date.mjs`
- 默认生成稳定版：`YYYY.M.D`
- 预发布支持：
  - `YYYY.M.D-beta.0`
  - `YYYY.M.D-dev.0`
- 脚本直接写回 `package.json`
- 运行时仍然只读取已经固化的 `package.json version`

### 本地 mac 打包

- `package:mac:local` 改成只打当前主机架构，不再盲打 `x64 + arm64`
- 优先复用本机 `node_modules/electron/dist`
- 如果本机没有可用的 Electron dist，就自动回退到 `electron-builder` 的下载流程
- 本地打包主流程只要求先产出 unpacked app
- zip 由脚本使用系统 `ditto` 自行生成并校验
- 在旧版本 macOS 上跳过 dmg，只保证本地 zip 闭环

### CI 发版版本决策

- 新增 `scripts/resolve-release-version.mjs`
- GitHub Actions 中统一用它决定最终版本：
  - 有 `v<version>` tag 时，直接使用 tag
  - 手动触发且传了 `version` 时，直接使用输入值
  - 手动触发未传 `version` 时，按 `Asia/Shanghai` 时区自动生成日期版本
- 同一个脚本会在 CI 中把结果写回 `package.json`，保证产物名、安装包元数据和 Release 文案一致
- `stable / beta / dev` 通道继续兼容 `YYYY.M.D`、`YYYY.M.D-beta.0`、`YYYY.M.D-dev.0`

### 不做的事

- 本轮不重写 README
- 本轮不处理同一天多次稳定版递增规则
