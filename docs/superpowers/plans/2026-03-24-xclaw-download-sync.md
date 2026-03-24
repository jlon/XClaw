# XClaw Download Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为官网提供带版本号的下载地址，并通过手动脚本把最新 GitHub release 的 3 个安装包幂等同步到服务器。

**Architecture:** 下载文件独立存放在服务器共享目录，并保留原始版本号文件名。同步脚本通过 GitHub releases API 获取最新发布和资产列表，按命名规则选择 3 个安装包，同版本同大小文件直接跳过；脚本写出 `latest.json` 给官网运行时读取。Nginx 通过独立 `location /downloads/` 暴露这些文件。

**Tech Stack:** Bash、curl、python3、Nginx、Vite

---

### Task 1: 本地实现同步脚本

**Files:**
- Create: `scripts/sync-release-downloads.sh`
- Test: 手动执行 `bash -n scripts/sync-release-downloads.sh`

- [ ] 编写 GitHub releases API 拉取逻辑
- [ ] 编写资产匹配、版本目录和幂等跳过逻辑
- [ ] 增加 `--dry-run` 模式
- [ ] 用 `bash -n` 和 `--dry-run` 验证脚本输出

### Task 2: 改官网固定下载地址

**Files:**
- Modify: `website/content.ts`

- [ ] 把三个下载按钮改成运行时读取 `latest.json`
- [ ] 把下载区文案改成“官网直连下载，更新说明在 GitHub”
- [ ] 重新构建静态站点

### Task 3: 配置服务器下载目录

**Files:**
- Deploy: `/usr/local/bin/xclaw-sync-downloads`
- Deploy: `/etc/nginx/conf.d/xclaw.conf`

- [ ] 增加 `/downloads/` 的静态目录映射
- [ ] 创建服务器下载目录
- [ ] 上传并安装同步脚本
- [ ] 执行首次同步

### Task 4: 验证线上下载

**Files:**
- Verify only

- [ ] 验证 `latest.json` 和三个真实 HTTPS 下载地址返回 `200`
- [ ] 验证官网首页按钮链接已切到站点自有下载地址
- [ ] 记录验证结果
