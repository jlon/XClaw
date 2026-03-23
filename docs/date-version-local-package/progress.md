## 当前进度

### 已完成

- 新增 `version:date / version:date:beta / version:date:dev`
- `package:mac:local` 已改成当前架构闭环模式
- 为日期版号与本地打包脚本补充单测
- GitHub Release CI 已接入共享版本解析脚本
- `package:mac:local` 已支持“本地 Electron dist 优先，缺失时自动回退下载”

### 下一步

- 执行日期版号脚本并产出新的本地 mac 包
- 如需进一步自动化，再补“同日多次正式版”的递增策略
