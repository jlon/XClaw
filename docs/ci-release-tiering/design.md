# CI 发布分层设计

## 背景

当前 `.github/workflows` 能跑，但发布语义不清晰：

- `release.yml` 同时承担构建、签名、发布、latest 提升
- Windows 有两条手动链，分别对应无签名打包和 SignPath 签名测试，但名称看不出边界
- mac 测试包路径主要依赖本地脚本，不符合“GitHub CI 为主”的发布方式

这会导致两个问题：

1. 无法一眼判断“这次跑出来的是测试包、预发布包，还是正式发布包”
2. 签名参数和平台要求都藏在 workflow 细节里，交接成本高

## 目标

按当前真实能力，把 CI 明确收成三条活跃链：

1. `check.yml`
   - 只做 PR 校验
2. `package-test.yml`
   - 只产出内部测试包
   - 不发布 GitHub Release
   - 不走正式签名/公证
3. `package-beta.yml`
   - 只产出对外 Beta 包
   - tag 时自动发布 GitHub prerelease
   - 当前仍为未签名包

稳定正式发布链暂时不放进活跃 workflow，避免假装已经具备签名能力。

## 设计原则

### 1. 先按“产物语义”分，不按“操作方式”分

命名和职责都要回答一句话：

- 这条链打出来的包是给谁用的？
- 它是否正式签名？
- 它是否会发布到 GitHub Release？

不能再出现“manual / build-test”这种只描述操作、不描述产物语义的命名。

### 2. 渠道优先，而不是“假定已经具备签名能力”

当前现实是：

- 无法完成正式签名/公证
- 但需要内部测试包
- 也需要对外 Beta 包

所以当前 CI 先按渠道分：

- `test`
- `beta`

而不是提前挂一个并不真正可用的 `stable release` 主线。

### 3. mac 测试包走 ad-hoc，不卡正式签名链

新增 `package:mac:adhoc`：

- `mac.notarize=false`
- `mac.identity=-`
- `CSC_IDENTITY_AUTO_DISCOVERY=false`

目的不是“伪装成正式包”，而是让 CI 可以稳定产出可测试的 mac 包，而不被正式公证链拦住。

### 4. Beta 只负责 Beta

`package-beta.yml` 只处理：

- `beta` 版本号
- `beta` tag
- GitHub prerelease

不再把 `dev / alpha / stable` 混进去。

## Workflow 结构

### `check.yml`

保留现状：

- PR 检查
- lint / typecheck / test / vite build

### `package-test.yml`

触发：

- `workflow_dispatch`

职责：

- 根据选择的平台打测试包
- 上传 artifact
- 不发布 Release

平台策略：

- mac：`package:mac:adhoc`
- win：`package:win`
- linux：`package:linux`

### `package-beta.yml`

触发：

- tag：`v*-beta*`
- 手动触发

职责：

- 构建对外 Beta 包
- tag 触发时发布 GitHub prerelease
- 手动触发时只上传 artifact

mac 产物约束：

- 只产出 `dmg`
- 保留 `x64 + arm64`
- 不再为 Beta/Test 额外产出 `zip`

### `release.yml`

当前不进入活跃 workflow。

稳定正式发布在具备签名能力后再恢复，不在这次设计里假做。

## Secrets 边界

### 测试包 / Beta 包

不需要：

- `MAC_CERTS`
- `MAC_CERTS_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `SIGNPATH_API_TOKEN`

## 非目标

这次不做：

- 恢复 stable 正式发布链
- 引入签名/公证 secrets
- 统一成 reusable workflow
- 改 electron-builder 的平台 target 组合

先把**当前真实可用**的 CI 架构收清楚，避免过度设计。

## 预装技能缓存策略

当前预装技能仍然来自第三方仓库，不改成功能降级的“跳过下载”模式。

本轮采用的是最小风险加速方案：

1. `package-test.yml` / `package-beta.yml` 在 CI 中缓存 `build/preinstalled-skills`
2. `bundle-preinstalled-skills.mjs` 在显式开启 `XCLAW_USE_PREINSTALLED_SKILLS_CACHE=1` 时，若发现缓存目录和锁文件完整，则直接复用
3. 缓存未命中或目录不完整时，仍按 manifest 从远程仓库重新抓取

这样做的取舍是：

- 优点：不损失内置技能功能，重复构建明显更快
- 缺点：仍然依赖远程仓库，且 `ref=main` 的上游变更不会主动打爆缓存

所以这只是当前阶段的加速手段，不是最终的可复现打包方案。
