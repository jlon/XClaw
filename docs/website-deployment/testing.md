# 官网部署验证记录

## 文档目标

本文件记录官网部署文档要求的验证项，方便每次发布后逐项检查。

## 基础连通性

- 验证 `https://www.xclaw.live/` 返回 `200`
- 验证 `https://xclaw.live/` 返回 `200`
- 验证 `http://www.xclaw.live/` 自动跳转到 HTTPS

## 站点内容正确性

- 验证根路径返回官网，不是桌面应用 Web 壳
- 验证 `/#/setup` 不会打开桌面应用 setup 页面
- 验证官网右上角联系方式弹层可正常展开
- 验证首页下载按钮能读取 `/downloads/latest.json`

## 下载链路

- 验证 `/downloads/latest.json` 返回 `200`
- 验证 `latest.json` 中的 3 个下载文件都返回 `200`
- 验证下载 URL 带版本号目录，不是硬编码 GitHub Releases 页面

## 发布流程验证

- 验证本地 `pnpm run build:vite` 能生成官网构建产物
- 验证 `pnpm install --frozen-lockfile --ignore-scripts` 能通过，不再卡在 `openclaw` 补丁安装
- 验证 `node scripts/apply-openclaw-patch.mjs` 可幂等执行，并能把补丁落到 `node_modules/openclaw`
- 验证官网发布后 `nginx -t` 成功
- 验证回滚目录存在且可重新 rsync 到 `current/`

## 当前结论

- 已补齐完整操作文档
- 当前文档覆盖官网构建、打包、上传、Nginx、下载同步、验证和回滚
- 仍建议后续把官网专用静态包提取流程固化成仓库脚本，减少人工步骤
