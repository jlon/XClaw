## 验证范围

- 更新面板必须显示“内置自动更新已禁用”
- 设置页不再出现自动检查更新、自动下载更新开关
- 仓库配置不得再出现 OSS 发布链路
- 菜单与内置 CLI 不得再出现旧官网和旧 issue 链接
- release workflow YAML 必须保持可解析
- 构建必须通过

## 已执行命令

- `pnpm exec vitest run tests/unit/update-settings.test.tsx tests/unit/settings-layout.test.tsx tests/unit/update-release-config.test.ts`
- `pnpm exec eslint electron/main/menu.ts electron/main/updater.ts electron/main/tray.ts src/stores/update.ts src/components/settings/UpdateSettings.tsx src/pages/Settings/index.tsx tests/unit/update-settings.test.tsx tests/unit/settings-layout.test.tsx tests/unit/update-release-config.test.ts --max-warnings=0`
- `pnpm run build:vite`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release.yml'); puts 'release workflow yaml ok'"`

## 预期结果

- 更新页通过中性 pane 呈现禁用状态
- 设置页更新 tab 只有版本与说明
- workflow 不再包含 `upload-oss / ossutil / valuecell-XClaw`
- release workflow 解析通过
