# CI 发布分层进度

## 已完成

- 明确按当前真实能力收口成 `check / test / beta` 三条活跃链
- 新增 `package-test.yml`
  - 专门产出内部测试包 artifact
- 新增 `package-beta.yml`
  - 专门产出对外 Beta 包
  - tag 时发布 GitHub prerelease
- 删除旧的：
  - `release.yml`
  - `package-win-manual.yml`
  - `win-build-test.yml`
  - `package-prerelease.yml`
  - `package-win-signed-test.yml`
- 新增 `package:mac:adhoc`
  - 用于 CI 中的 mac 测试包 / Beta 包

## 当前结果

`.github/workflows` 现在的职责层次变成：

- `check.yml`：PR 检查
- `package-test.yml`：测试包
- `package-beta.yml`：对外 Beta 包
- `comms-regression.yml`：专项回归

## 下一步

1. 在 GitHub 上实际跑一轮：
   - `package-test.yml`
   - `package-beta.yml`
2. 确认 mac ad-hoc 包在 CI 上的产物形式是否稳定
3. 如有需要，再补一份“未来恢复正式签名发布”的迁移文档

## 2026-03-24 补充

- 已为 `package-test.yml` 和 `package-beta.yml` 增加 `build/preinstalled-skills` 缓存
- `bundle-preinstalled-skills.mjs` 已支持在 CI 显式开启缓存复用时直接消费已有 bundle
- 当前仍保留远程抓取作为缓存未命中的兜底路径，不损失内置技能能力
- `package:mac:adhoc` 已收成只产出 `dmg`，保留 `x64 + arm64`，不再额外打 `zip`
