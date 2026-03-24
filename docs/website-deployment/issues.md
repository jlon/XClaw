# 官网部署已知问题

## 1. 官网专用静态包提取流程仍然偏手工

当前流程已经可操作，但“只提取官网依赖资源”的步骤还是依赖一段内联 Python 脚本。

影响：

- 可执行，但不够产品化
- 新同学接手时理解成本偏高
- 如果 `website/index.html` 的资源引用方式变化，需要同步调整提取逻辑

建议：

- 后续沉淀成仓库内正式脚本，例如 `scripts/package-website-static.mjs`

## 2. 本地命令行代理环境可能干扰联调判断

如果本机存在：

- `HTTP_PROXY`
- `HTTPS_PROXY`
- `http_proxy`
- `https_proxy`

那么本地 `curl`、`node fetch` 等验证命令可能被代理接管，导致对 `127.0.0.1` 的判断失真。

建议：

- 验证本地端口时优先显式关闭代理环境变量
- 不要把 shell 代理结论直接等同于 Electron 代理结论

## 3. 官网根路径依赖 Nginx 映射到 `/website/index.html`

当前线上根路径不是物理上的 `/index.html`，而是 Nginx 将 `/` 映射到 `/website/index.html`。

影响：

- 如果误删这条规则，根路径会直接失效
- 不能把这套部署方式误认为普通单页站点根目录结构

建议：

- 服务器变更前先检查 `/etc/nginx/conf.d/xclaw.conf`

## 4. 下载同步脚本依赖 GitHub Releases API

如果 GitHub API 被限流、网络不通或 release 资产命名改变，同步会失败。

建议：

- 发布前先执行一次 `--dry-run`
- 资产命名规则变化时优先更新 `scripts/sync-release-downloads.sh`
