## 已知问题

- 同一天如果需要发第二个稳定版，当前日期版本策略还没有附加递增位
- `package:mac:local` 当前优先保证本地 zip 闭环，较老 macOS 主机不产 dmg
- 手动触发 GitHub Release 且不传 `version` 时，会自动取当天日期；如果团队需要“同日第二次正式版”，仍需补充递增规则
