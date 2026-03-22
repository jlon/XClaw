# 应用图标品牌对齐验证

## 验证目标

1. 图标生成脚本能正常产出桌面与 Web 所需资源。
2. `index.html` 正确引用 favicon 资源。
3. Electron 打包引用链不需要额外改动即可继续使用新图标。

## 本次验证

已执行：

- `pnpm run icons`
- `pnpm exec vitest run tests/unit/icon-brand-assets.test.ts --reporter=dot`
- `pnpm exec eslint scripts/generate-icons.mjs tests/unit/icon-brand-assets.test.ts --max-warnings=0`
- `pnpm run typecheck`

## 关注点

- `public/favicon.svg`、`public/favicon.ico`、`public/apple-touch-icon.png` 是否生成
- `resources/icons/icon.icns`、`resources/icons/icon.ico` 是否生成
- `tray-icon-Template.png` 是否仍可生成

## 结果

- `pnpm run icons` 通过，`resources/icons/*` 与 `public/favicon*` 已生成
- `tests/unit/icon-brand-assets.test.ts` 通过，`3 passed`
- ESLint 通过
- `pnpm run typecheck` 未全绿，但阻塞来自现存的 `src/pages/Channels/index.tsx` 与 `src/components/channels/ChannelAccountList.tsx` 无关错误，不是本次图标改造引入
