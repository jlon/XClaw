# 工作室多皮肤切换测试方案

## 已完成验证

- `pnpm exec vitest run tests/unit/studio-skins.test.ts tests/unit/studio-routes.test.ts tests/unit/studio-page.test.tsx`
- `pnpm run typecheck`
- `pnpm dev`
- `curl http://127.0.0.1:3210/api/studio/skins/registry`
- `curl -X POST http://127.0.0.1:3210/api/studio/skins/apply -d '{"skinKey":"frost-ops"}'`
- `curl -X POST http://127.0.0.1:3210/api/studio/skins/apply -d '{"skinKey":"lodge-default"}'`

## 当前覆盖点

- 首次进入工作室前由 renderer 侧选择本次实例皮肤
- 自动随机时默认避开上一轮离开工作室时的皮肤
- 手动换皮只从当前皮肤之外的可用池里选择
- host 侧在 runtime 未启动时也能返回皮肤注册表
- runtime apply 接口会返回统一结果对象与刷新资产列表
- `electron-standalone?skinKey=...` 能在首次加载前触发目标皮肤应用
- 工作室页面会把 `skinKey` 编码进 runtime URL
- 当前实例内显示“换皮”按钮，且点击后会调用 runtime apply 链
- runtime apply 失败时会尝试回退默认皮肤

## 尚未自动化覆盖

- 真实 Electron webview 内的肉眼视觉差异与切换体感
- 资源刷新失败后前端强制 fallback 的截图级验证
- 如果未来把精灵表也纳入皮肤包，需要补专门的刷新验证
