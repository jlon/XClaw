# XClaw 官网部署操作手册

## 目标

把 `website/` 这套单页官网稳定部署到线上，只暴露官网静态页面和下载文件，不把桌面应用壳页面一起传到服务器。

当前线上目标域名：

- `https://www.xclaw.live`
- `https://xclaw.live`

## 部署原则

### 1. 只部署官网静态产物

不能把整个 `dist/` 原样上传。

原因：

- `dist/index.html` 是桌面应用渲染入口，不是官网
- 上传整包后，线上会暴露 `/#/setup`、`assets/app-*.js` 等桌面应用资源
- 用户只需要官网站点和下载资源，不需要桌面应用 Web 壳

### 2. 官网与下载文件分离

官网静态页和安装包要分开存放：

- 官网目录：`/var/www/xclaw/current`
- 下载目录：`/var/www/xclaw/downloads`

这样官网重发时不会覆盖安装包，安装包同步时也不会污染官网目录。

### 3. 根路径直接打开官网

线上根路径 `/` 必须直接返回官网，不允许落到桌面应用入口或旧的 Hash 路由。

## 仓库内相关文件

### 官网页面

- `website/index.html`
- `website/main.ts`
- `website/content.ts`
- `website/styles.css`

### 构建配置

- `vite.config.ts`

`vite` 目前是双入口构建：

- `index.html`：桌面应用渲染入口
- `website/index.html`：官网入口

### 下载同步脚本

- `scripts/sync-release-downloads.sh`

这个脚本负责把 GitHub Releases 的安装包同步到服务器，并生成：

- `/downloads/<tag>/真实文件名`
- `/downloads/latest.json`

官网下载按钮会读取 `latest.json`，再跳到当前版本的真实文件。

## 服务器目录约定

```text
/var/www/xclaw/
  current/                  # 当前线上官网根目录
  releases/                 # 官网发布目录
  downloads/                # 下载文件目录
```

建议保持：

- 每次发布都创建一个新的 `releases/<release-name>` 目录
- 发布完成后再同步到 `current/`
- 回滚时直接把旧版本重新 rsync 回 `current/`

## Nginx 配置

当前官网要求的核心逻辑如下：

1. 根路径 `/` 返回 `/website/index.html`
2. `/downloads/` 走单独的静态目录
3. 其他路径只返回官网静态资源，不给桌面应用壳兜底

推荐配置：

```nginx
server {
    listen 80;
    server_name xclaw.live www.xclaw.live;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xclaw.live www.xclaw.live;

    root /var/www/xclaw/current;

    ssl_certificate /etc/letsencrypt/live/www.xclaw.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.xclaw.live/privkey.pem;

    location = / {
        try_files /website/index.html =404;
    }

    location /downloads/ {
        alias /var/www/xclaw/downloads/;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

配置文件建议放在：

- `/etc/nginx/conf.d/xclaw.conf`

变更后执行：

```bash
nginx -t
systemctl reload nginx
```

## 一次性初始化

### 1. 创建目录

```bash
mkdir -p /var/www/xclaw/current
mkdir -p /var/www/xclaw/releases
mkdir -p /var/www/xclaw/downloads
```

### 2. 放行端口

必须放行：

- `80`
- `443`

### 3. 签发 HTTPS 证书

如果还没有证书，可以用 `certbot`：

```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
certbot --nginx -d xclaw.live -d www.xclaw.live
```

### 4. 安装下载同步脚本

把仓库内脚本复制到服务器：

```bash
scp scripts/sync-release-downloads.sh root@<server>:/usr/local/bin/xclaw-sync-downloads
ssh root@<server> 'chmod +x /usr/local/bin/xclaw-sync-downloads'
```

首次验证：

```bash
ssh root@<server> '/usr/local/bin/xclaw-sync-downloads --dry-run'
```

## 每次官网发布流程

下面是完整的标准发布步骤。

### 步骤 1：本地构建官网

在仓库根目录执行：

```bash
pnpm run build:vite
```

构建后需要的来源是：

- `dist/website/index.html`
- `dist/assets/` 中官网实际引用到的资源
- 根目录 favicon 资源

注意：

- 不要直接上传整个 `dist/`
- 特别不要上传 `dist/index.html`

## 步骤 2：打包“官网专用静态包”

当前最稳妥的做法是从 `dist/website/index.html` 和官网入口 JS 中提取实际依赖，再组一个只包含官网的目录。

在本地仓库根目录执行：

```bash
rm -rf /tmp/xclaw-site-website-only
mkdir -p /tmp/xclaw-site-website-only/website
mkdir -p /tmp/xclaw-site-website-only/assets

python3 - <<'PY'
from pathlib import Path
import re
import shutil

root = Path.cwd()
dist = root / 'dist'
stage = Path('/tmp/xclaw-site-website-only')

index_path = dist / 'website' / 'index.html'
index_text = index_path.read_text()

script_match = re.search(r'src=\"\\.\\./assets/([^\"]+)\"', index_text)
style_match = re.search(r'href=\"\\.\\./assets/([^\"]+)\"', index_text)
preload_matches = re.findall(r'href=\"\\.\\./assets/([^\"]+)\"', index_text)

if not script_match or not style_match:
    raise SystemExit('无法从 website/index.html 提取官网入口资源。')

asset_names = set(preload_matches)
asset_names.add(script_match.group(1))
asset_names.add(style_match.group(1))

script_name = script_match.group(1)
script_text = (dist / 'assets' / script_name).read_text()
asset_names.update(re.findall(r'new URL\\(\"\\.\\/([^\\\"]+)\"', script_text))

for asset_name in asset_names:
    src = dist / 'assets' / asset_name
    if src.exists():
        shutil.copy2(src, stage / 'assets' / asset_name)

shutil.copy2(index_path, stage / 'website' / 'index.html')

for icon_name in ('apple-touch-icon.png', 'favicon-32.png', 'favicon.ico', 'favicon.svg'):
    icon_path = dist / icon_name
    if icon_path.exists():
        shutil.copy2(icon_path, stage / icon_name)
PY

tar -C /tmp -czf /tmp/xclaw-site-website-only.tgz xclaw-site-website-only
```

打包结果：

- `/tmp/xclaw-site-website-only.tgz`

### 步骤 3：上传官网静态包

```bash
scp /tmp/xclaw-site-website-only.tgz root@<server>:/root/
```

### 步骤 4：在服务器上发布

登录服务器执行：

```bash
release_name="website-only-$(date +%Y%m%d-%H%M%S)"
release_dir="/var/www/xclaw/releases/${release_name}"

mkdir -p "$release_dir"
tar -xzf /root/xclaw-site-website-only.tgz -C "$release_dir" --strip-components=1
rsync -a --delete "$release_dir"/ /var/www/xclaw/current/
nginx -t
systemctl reload nginx
```

### 步骤 5：同步下载文件

在服务器执行：

```bash
/usr/local/bin/xclaw-sync-downloads
```

这个步骤会：

1. 读取 `jlon/XClaw` 最新 release
2. 选择 3 个安装包
3. 同步到 `/var/www/xclaw/downloads/<tag>/`
4. 生成 `/var/www/xclaw/downloads/latest.json`
5. 如果同一个 beta tag 下有多轮重发资产，优先同步最新那一批安装包

## GitHub Beta 打包注意

- 手动触发 `.github/workflows/package-beta.yml` 时，默认会同时发布 GitHub Beta Release。
- 如果只是验证打包、不想覆盖 GitHub Release，才需要显式把 `publish_release` 设为 `false`。
- 同一个 beta tag 反复重发时，发布流程会先清理旧安装包资产，再上传新资产，避免官网同步脚本继续命中旧文件。

## 下载同步脚本行为说明

### 固定输入

默认仓库：

- `jlon/XClaw`

可通过环境变量覆盖：

```bash
XCLAW_RELEASE_REPO=<owner/repo> /usr/local/bin/xclaw-sync-downloads
```

### 默认输出目录

```bash
/var/www/xclaw/downloads
```

可通过环境变量覆盖：

```bash
XCLAW_DOWNLOAD_DIR=/data/xclaw-downloads /usr/local/bin/xclaw-sync-downloads
```

### 当前匹配规则

- `macArm64`：匹配 `-mac-arm64.dmg`
- `macX64`：匹配 `-mac-x64.dmg`
- `win`：优先 `-win-x64.exe`，其次 `-win.exe`，最后 `-win-arm64.exe`

### 幂等策略

脚本不会只按 tag 跳过。

同一个 tag 下，只有同时满足下面条件才跳过：

- `latest.json` 中当前 tag 相同
- 文件名相同
- 文件大小相同
- `updatedAt` 相同
- 目标文件存在且本地大小一致

这允许在同一个 release tag 下重复执行 CI 并替换资源。

### 干跑

```bash
/usr/local/bin/xclaw-sync-downloads --dry-run
```

## 发布后验证

### 1. 验证官网首页

```bash
curl -I https://www.xclaw.live/
curl -I https://xclaw.live/
```

期望：

- HTTPS 返回 `200`
- HTTP 自动跳转到 HTTPS

### 2. 验证官网入口不是桌面应用壳

```bash
curl -s https://www.xclaw.live/ | head -n 20
```

期望：

- 返回的是官网入口 HTML
- 不应出现桌面应用的 `dist/index.html` 壳页面

### 3. 验证旧 hash 路由不会落到应用壳

浏览器访问：

- `https://www.xclaw.live/#/setup`

期望：

- 页面会被官网脚本回正到官网根路径
- 不出现桌面应用 setup 页面

### 4. 验证下载元数据

```bash
curl -I https://www.xclaw.live/downloads/latest.json
curl -s https://www.xclaw.live/downloads/latest.json
```

期望：

- 返回 `200`
- JSON 中包含 `tag` 和 3 个下载项

### 5. 验证三个安装包

把 `latest.json` 中的 3 个 URL 取出来逐个验证：

```bash
curl -I https://www.xclaw.live/downloads/<tag>/<mac-arm64-file>
curl -I https://www.xclaw.live/downloads/<tag>/<mac-x64-file>
curl -I https://www.xclaw.live/downloads/<tag>/<win-file>
```

期望：

- 都返回 `200`

## 回滚流程

如果新官网有问题，不需要重新构建，直接回滚旧发布目录：

```bash
release_dir="/var/www/xclaw/releases/<old-release-name>"
rsync -a --delete "$release_dir"/ /var/www/xclaw/current/
nginx -t
systemctl reload nginx
```

注意：

- 回滚官网不会影响 `/var/www/xclaw/downloads`
- 下载目录要单独维护，不跟官网发布目录耦合

## 常见误区

### 1. 直接上传整个 `dist/`

这是错误做法。

后果：

- 线上会混入桌面应用 Web 壳
- 用户可能访问到 `/#/setup`
- `assets/app-*.js` 会暴露在站点根目录

### 2. 用官网发布覆盖下载目录

这是错误做法。

后果：

- 官网静态页重发时可能把下载包删掉
- 安装包生命周期和页面生命周期绑死

### 3. 只靠 tag 判断下载是否需要重拉

这也是错误做法。

原因：

- 同一个 tag 下，CI 可能重复生成资产并替换原文件
- 必须结合 `name + size + updatedAt` 判断

### 4. 把服务器密码写进仓库文档

禁止这样做。

文档里只写：

- 目录
- 命令
- 配置路径
- 流程

登录凭据由运维环境单独保管。

## 后续建议

当前这份文档已经能支撑人工发布，但长期看还应再补两件事：

1. 把“官网专用静态包”提取流程沉淀成仓库脚本，避免每次复制内联 Python
2. 把官网发布和下载同步做成两个独立命令，减少发布时的人肉步骤
