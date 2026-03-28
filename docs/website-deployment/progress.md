# 官网部署文档进度

## 2026-03-24

- 新建 `docs/website-deployment/`
- 补齐官网部署完整操作手册
- 补齐验证清单
- 补齐已知问题记录

## 2026-03-28

- 定位 `package-beta` 失败根因是 `openclaw` 安装阶段补丁链不稳定
- 移除 `pnpm.patchedDependencies` 对 `openclaw` 的依赖
- 新增 `scripts/apply-openclaw-patch.mjs`，改为在 `dev / build / package` 前显式补丁
- 重新生成 `patches/openclaw@2026.3.13.patch`，收敛成可重复应用的规范版本

## 当前状态

- 官网部署文档已可直接用于人工发布
- 下载同步文档已和当前脚本实现对齐
- 发布链已补上 `openclaw` 补丁稳定性修复
- 后续可继续把“官网专用静态包提取”沉淀成正式脚本
