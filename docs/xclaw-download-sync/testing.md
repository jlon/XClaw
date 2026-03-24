# XClaw 下载同步验证

## 本地验证

- `bash -n scripts/sync-release-downloads.sh`
- `scripts/sync-release-downloads.sh --dry-run`
- `pnpm run build:vite`
- `pnpm run typecheck`

## 服务器验证

- `/usr/local/bin/xclaw-sync-downloads`
- 再执行一次 `/usr/local/bin/xclaw-sync-downloads`，确认不会重复下载
- `curl -I https://www.xclaw.live/downloads/latest.json`
- 读取 `latest.json` 中的 3 个真实 URL，再逐个 `curl -I`

## 通过标准

- 脚本能输出最新 tag 和 3 个匹配到的源文件名
- 重复执行脚本时，已有同版本文件会被跳过
- `latest.json` 返回 `200`
- `latest.json` 中的三个真实下载地址返回 `200`
- 官网首页三个下载按钮直连站点域名下载地址
