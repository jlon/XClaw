## 已知问题

- 版本号仍是旧 semver，尚未切换到日期格式
- `release.yml` 仍保留先发 prerelease 再 promote 的旧策略，本轮未处理
- settings store 与 electron store 仍保留 `autoCheckUpdate / autoDownloadUpdate` 字段，只是当前不再消费
- 帮助菜单当前只保留 `OpenClaw Documentation`，若 fork 需要自有官网或反馈入口，后续应改成 fork 自己的地址
