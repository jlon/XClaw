# CI 发布分层验证

## 目标

验证新的 workflow 分层是否满足：

1. 测试包和 Beta 包语义清晰
2. 当前活跃 CI 不再假装具备 stable 正式发布能力
3. mac 测试包和 Beta 包不依赖正式签名/公证
4. Beta tag 可以独立生成对外 prerelease

## 本地静态检查

### 1. YAML 语法

使用 Ruby 标准库解析全部 workflow：

```bash
ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |f| YAML.load_file(f); puts "OK #{f}" }'
```

预期：

- 所有 workflow 都能解析成功
- 不允许出现 YAML 语法错误

### 2. 变更边界

```bash
git diff --check
```

预期：

- 不允许出现尾随空格、冲突标记、坏缩进

### 3. 关键脚本自检

```bash
node scripts/resolve-release-version.mjs --input-version 1.2.3 --channel stable
node scripts/resolve-release-version.mjs --input-version 1.2.3-beta.1 --channel beta
```

预期：

- 输出版本号正确
- workflow 中基于版本号的 beta 分流逻辑有事实基础

## GitHub CI 场景矩阵

### `package-test.yml`

手动触发：

- `platform=mac`
- `platform=win`
- `platform=linux`
- `platform=all`

预期：

- 只上传 artifact
- 不创建 GitHub Release
- mac 测试包不要求 Apple 签名 secrets

### `package-beta.yml`

触发：

- `v1.0.0-beta.1`

预期：

- workflow 执行
- 产物命名为 Beta 包
- 创建 GitHub prerelease
- 不要求签名 secrets
- Windows 默认只产出 `win-x64.exe`
- Windows `latest.yml` 只指向 `win-x64.exe`

## 风险回归点

1. `package-beta.yml` 不能误走 SignPath 或 Apple notarization
2. `package-test.yml` 不能依赖正式 secrets
3. `beta` tag 不应再触发不存在的 stable 正式发布链
4. 预装技能缓存命中时，打包不能再访问远程仓库
5. 预装技能缓存缺失时，仍然要能自动回退到远程抓取

## 预装技能缓存验证

### 本地脚本验证

```bash
XCLAW_USE_PREINSTALLED_SKILLS_CACHE=1 node --check scripts/bundle-preinstalled-skills.mjs
```

### 行为验证

准备一个完整的 `build/preinstalled-skills` 目录和 `.preinstalled-lock.json` 后，在 CI 或本地执行：

```bash
XCLAW_USE_PREINSTALLED_SKILLS_CACHE=1 pnpm run bundle:preinstalled-skills
```

预期：

- 输出 `Using cached preinstalled skills bundle`
- 不再打印 `Fetching ...`

删除 `build/preinstalled-skills` 后再次执行：

```bash
XCLAW_USE_PREINSTALLED_SKILLS_CACHE=1 pnpm run bundle:preinstalled-skills
```

预期：

- 回退到正常远程抓取
- 生成新的 `.preinstalled-lock.json`
