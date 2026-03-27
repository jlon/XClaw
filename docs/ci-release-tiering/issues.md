# CI 发布分层待确认问题

## 当前已知问题

### 1. mac 测试包是否需要保留 `dmg`

当前 `package:mac:adhoc` 直接沿用 electron-builder 的 `dmg + zip` 目标。

优点：

- 测试用户体验更接近正式包

风险：

- 构建时间更长
- CI 失败面更大

后续可根据使用频率决定是否只保留 `zip`。

### 2. 未来是否需要单独恢复稳定正式发布链

本次设计里：

- 当前活跃 CI 不再保留正式签名发布 workflow

这是为了避免“仓库里存在一条看似可用、实际跑不通的正式发布链”。  
后续一旦具备 Apple / Windows 签名能力，再单独恢复 stable release workflow。

### 3. Release Notes 仍然有通用安全提示

`package-beta.yml` 里的安装说明已经强调“未签名 Beta 包”，但语气还可以继续收口。

这不是当前阻塞问题，但后续可继续收口。

### 4. mac 测试包是否长期保留 `dmg`

当前 `package:mac:adhoc` 仍沿用 `dmg + zip`。

这更接近真实分发体验，但也让构建时间和失败面更大。  
后续可根据外测反馈决定是否只保留 `zip`。

### 5. Beta 发布阶段不能再把可选产物写成必需 glob

已经出现过一次真实故障：

- `package` 三平台都成功
- `publish` 因为 `release-artifacts/**/*.zip` 未命中而失败

结论：

- 增量更新元数据本身不是根因
- 根因是发布阶段把“可选资产类型”写成了“必须命中”

当前修复已改成按实际 artifact 收集待发布文件，但后续如果新增资产类型，仍然要同步更新 `scripts/collect-release-assets.mjs` 的白名单。
