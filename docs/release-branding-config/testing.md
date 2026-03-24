## 验证范围

- `release/build/menu` 必须从同一份 branding 配置读取关键信息
- 仓库中不再依赖 `electron-builder.yml`
- release workflow 需要从脚本读取 `github owner/repo`
- 构建必须通过

## 已执行命令

- `pnpm exec vitest run tests/unit/release-branding-source.test.ts tests/unit/update-release-config.test.ts`
- `pnpm exec eslint electron/main/menu.ts tests/unit/release-branding-source.test.ts tests/unit/update-release-config.test.ts --max-warnings=0`
- `pnpm run build:vite`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release.yml'); puts 'release workflow yaml ok'"`

## 预期结果

- `config/release-branding.json` 成为单点配置源
- `config/build/electron-builder.config.cjs` 与 workflow 均从该配置派生
- 菜单帮助入口不再硬编码文档地址
