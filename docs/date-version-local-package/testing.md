## 验证范围

- 日期版号脚本必须生成稳定版与预发布版
- CI 必须通过统一版本解析脚本决定最终版本
- 本地 mac 打包脚本必须改成“当前架构 + 本机 Electron dist 优先 + 自动下载回退 + 本地 zip”
- 本地 zip 必须能通过 `unzip -t`

## 已执行命令

- `pnpm exec vitest run tests/unit/version-date.test.ts tests/unit/package-mac-local.test.ts tests/unit/release-version-source.test.ts`
- `pnpm exec eslint scripts/version-date.mjs scripts/resolve-release-version.mjs scripts/package-mac-local.mjs tests/unit/version-date.test.ts tests/unit/package-mac-local.test.ts tests/unit/release-version-source.test.ts --max-warnings=0`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release.yml'); puts 'release workflow yaml ok'"`

## 预期结果

- `version:date` 输出 `2026.3.23`
- GitHub Actions 在 tag / 手动 version / 自动日期 三种入口下都能解析出单一版本
- `package:mac:local` 生成 `release/<product>-<version>-mac-<arch>-local.zip`
- 本地 zip 校验通过
