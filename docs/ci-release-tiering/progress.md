# CI 发布分层进度

## 已完成

- 明确按当前真实能力收口成 `check / test / beta` 三条活跃链
- 新增 `package-test.yml`
  - 专门产出内部测试包 artifact
- 新增 `package-beta.yml`
  - 专门产出对外 Beta 包
  - tag 时发布 GitHub prerelease
  - 手动触发时可选直接发布 GitHub prerelease
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
- `package-beta.yml` 已支持 `workflow_dispatch` 下显式发布 prerelease，并通过固定 `tag_name + overwrite_files` 支持同版本重复覆盖

## 2026-03-25 补充

- 已确认线上旧 Beta Release 仍然是旧提交产物，所以 Windows 资产体积暂时未反映最新瘦身结果
- `package-beta.yml` 的 Windows 步骤已切换到 `package:win:x64`
- 新增 `electron-builder.win-x64.config.cjs`，把 Beta Windows 目标锁定为 `nsis/x64`
- 本地验证 `package:win:x64` 只生成 `win-x64.exe` 与单文件 `latest.yml`
