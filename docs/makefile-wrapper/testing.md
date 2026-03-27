# Makefile 薄包装验证

## 验证目标

确认 `Makefile` 只是对现有 `pnpm` 打包脚本的静态包装，没有引入第二套逻辑。

## 已执行命令

```bash
make -n package-win
make -n package-mac-adhoc
make -n package-linux
make -n release
make help
```

## 预期

- `make -n ...` 输出的实际命令应直接对应 `corepack pnpm run ...`
- `make help` 能列出全部本地打包快捷入口
- 不依赖额外脚本，不改变现有 CI
