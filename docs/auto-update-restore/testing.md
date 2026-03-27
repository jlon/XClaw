# 自动更新恢复测试记录

## 计划验证

1. 主进程 updater：
   - Windows 固定指向 Beta feed
   - Windows 检查更新时进入 `checking`
   - macOS 改走手动 feed 元数据，不调用 `electron-updater` 下载/安装
   - 下载完成后 Windows 进入 `downloaded`
2. 设置页：
   - 不再显示“已禁用”
   - 可显示当前版本、最新版本、状态和动作按钮
   - Windows 显示自动下载，macOS 显示手动更新提示
3. 打包配置：
   - 恢复 generic publish
   - 保持 Windows beta 仍走 `package:win:x64`
4. feed 同步脚本：
   - 能选择 beta release
   - 能同步 yml、zip、dmg、exe、blockmap
   - 能把 channel 目录写成统一的 `latest*.yml`
   - 能输出 macOS 手动更新用的 `feed.json`

## 本轮执行

1. 红测：
   - `corepack pnpm test tests/unit/update-settings.test.tsx tests/unit/settings-layout.test.tsx tests/unit/update-release-config.test.ts tests/unit/updater-runtime.test.ts tests/unit/sync-update-feeds.test.ts`
   - 首次执行时分别失败在设置页仍沿用旧自动安装文案、builder 配置断言错误、同步脚本仍保留 stable 分支、设置布局测试还在 mock 旧更新面板。
2. 绿测：
   - `corepack pnpm test tests/unit/update-settings.test.tsx tests/unit/settings-layout.test.tsx tests/unit/update-release-config.test.ts tests/unit/updater-runtime.test.ts tests/unit/sync-update-feeds.test.ts tests/unit/stores.test.ts`
   - 结果：6 个文件全部通过，24 个测试全部通过。
3. 类型检查：
   - `corepack pnpm run typecheck`
4. Lint：
   - `corepack pnpm exec eslint electron/main/updater.ts src/components/settings/UpdateSettings.tsx src/stores/settings.ts src/stores/update.ts electron/utils/store.ts electron/utils/config.ts config/build/electron-builder.config.cjs tests/unit/update-settings.test.tsx tests/unit/settings-layout.test.tsx tests/unit/update-release-config.test.ts tests/unit/updater-runtime.test.ts tests/unit/sync-update-feeds.test.ts tests/unit/stores.test.ts --max-warnings=0`
5. 脚本与补充检查：
   - `bash -n scripts/sync-update-feeds.sh`
   - `git diff --check`

## 当前结论

1. Windows Beta 自动更新运行时、macOS 手动更新入口、设置页面板、builder publish 配置和 feed 同步脚本已经接通。
2. 当前验证仍以单测、类型和静态检查为主，还没有对真实官网 feed 目录和真实 Windows/macOS 安装包做端到端验证。
