# 微信频道集成进度

## 当前状态

- [x] 完成 XClaw 频道底层实现 review
- [x] 完成官方微信插件与 CLI 安装器 review
- [x] 确认本轮范围为 `A + B`
- [x] 识别出 `web.login.*` 单 provider 约束
- [x] 确认微信插件已有 `loginWithQrStart / loginWithQrWait` 能力
- [x] 确认 QClaw 桌面端实际采用 `start / poll / cancel` 而不是依赖插件内部 wait
- [x] 确认微信账号 id 由扫码结果生成，不能走通用手输模型
- [x] 输出 `docs/weixin-channel/design.md`
- [x] 输出 `docs/weixin-channel/testing.md`
- [x] 输出 `docs/weixin-channel/issues.md`
- [x] 完成至少 3 轮自我反思
- [x] 开始代码实现
- [ ] 完成单测与 e2e
- [x] 同步 README 多语言文档
- [x] 完成定向 ESLint、构建验证与主链路单测

## 已落地实现

- [x] `@tencent-weixin/openclaw-weixin` 已加入依赖
- [x] `scripts/bundle-openclaw-plugins.mjs` 已纳入 `openclaw-weixin`
- [x] `scripts/after-pack.cjs` 已纳入 `openclaw-weixin`
- [x] `electron/gateway/config-sync.ts` 已纳入 `openclaw-weixin`
- [x] 主进程 `weixin-login` 已改为 QClaw 对齐的 `start / poll / cancel`
- [x] 微信登录成功后已按官方插件格式写入账号状态文件
- [x] 主进程 `weixin-login` 路由已落地
- [x] Channels 页面已支持扫码添加账号、重新扫码、只读账号 ID
- [x] 微信配置弹窗已移除 `channel:weixin-*` host event 依赖，改为本地轮询 host-api
- [x] 微信健康守护开关、风险卡、限制说明卡已落地
- [x] 微信健康守护状态已持久化到 `electron-store`
- [x] 主进程已支持桌面提醒检查
- [x] 已将微信登录主链路从旧的 Gateway method 依赖前移到主进程
- [x] 已修复官方微信插件错误导入未导出 `plugin-sdk/gateway/protocol` 导致 Gateway 启动期加载失败的问题
- [x] 频道相关 UI 已统一为彩色渠道图标，包括 Channels / Agents / 配置弹窗 / Cron
- [x] 已移除微信二维码入口的主动 Gateway 重启，改为缺方法时按 `reload -> restart` 懒修复
- [x] 已替换 Telegram / Discord / WhatsApp / DingTalk / QQ / Feishu / WeCom 的真实彩色品牌图标资源
- [x] 已确认并对齐 QClaw 的关键二维码语义：二维码值是内容字符串，前端必须本地绘制 canvas
- [x] 已将微信 `start` 路由改为立即返回 `qrcodeUrl + sessionKey`
- [x] 已将二维码状态轮询改为 `poll` 快照，而不是事件推送
- [x] 已修复二维码持续刷新问题，当前只在真实过期时返回 `expired`
- [x] 已移除微信事件总线兼容层，避免回退到旧链路
- [x] 已将 Agent 绑定选择前移到扫码配置弹窗，新增账号与重新扫码都可在流程内直接绑定 Agent

## 本轮范围

- 内置官方微信插件镜像
- 频道中心增加微信渠道
- GUI 扫码登录与重新扫码
- 多账号展示与 Agent 绑定
- 首选账号语义
- 健康守护与风险提示

## 当前结论

- 正确方案是“官方插件内置化 + QClaw 对齐的桌面登录服务”
- 错误方案是“在 XClaw 里直接跑官方 CLI 安装器”
- 错误方案是“复用通用 `web.login.*` 并和 WhatsApp 竞争同一入口”
- 错误方案是“自动发消息做保活”

## 下一步

1. 补真实微信扫码人工验证记录
2. 视情况补充 e2e 或最小人工录屏
3. 决定是否单独处理当前分支里与微信无关的 `typecheck` 失败

## 当前验证结论

- 微信功能相关定向 ESLint 已通过
- 微信功能相关主链路单测已通过，历史主链路批次结果为 `74/74`，新增回归命令也已全部通过
- `pnpm run build:vite` 已通过，微信引入后不再破坏 Electron 主构建
- 已补充验证“当前扫码主链路不再依赖 `xclaw.weixin.login.start`”
- 已补充验证“当前 dev 环境触发扫码开始请求时不再立刻重启 Gateway”
- 已补充验证“微信二维码内容字符串会调用 `QRCode.toCanvas` 绘制”
- 已补充验证“`/api/channels/weixin/start` 会立即返回 `qrcodeUrl + sessionKey`”
- 已补充验证“`/api/channels/weixin/poll` 会返回状态快照并在确认后完成落盘”
- 已补充验证“前端不会再订阅 `channel:weixin-*` host event”
- 已补充验证“微信扫码弹窗会透传 Agent 列表，并在重新扫码时保留当前绑定 Agent”
- `pnpm run typecheck` 当前仍失败，但失败点位于与微信无关的 `src/stores/chat.ts` 和 `src/stores/chat/slash-commands.ts`

## 暂不纳入

- CLI 安装模式
- 自动消息保活
- 微信真实账号 id 重命名
- `baseUrl` 可编辑表单
