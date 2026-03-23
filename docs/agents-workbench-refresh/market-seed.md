# Agent 市场首批 50 条内置种子

## 来源原则

首批内置市场不做开放抓取，只使用受控来源。

当前确定的唯一来源：

- 仓库：`mergisi/awesome-openclaw-agents`
- 许可：MIT
- 机器可读清单：`agents.json`

注意：

- 该仓库 `README` 宣称 `177`
- `agents.json.total = 174`
- `agents.json.agents.length = 177`

因此 `XClaw` 不做全量镜像，而是冻结一份受控的 50 条 catalogue。

## 选择标准

- 必须是 OpenClaw 兼容的 `SOUL.md` 模板来源
- 必须来自 MIT 仓库
- 优先覆盖高频真实使用场景
- 优先选择命名和职责较清晰的条目
- 首批以办公、开发、业务、内容、数据为主

## 首批 50 条

### 生产力 5

1. `daily-standup`
2. `focus-timer`
3. `habit-tracker`
4. `inbox-zero`
5. `meeting-notes`

### 开发 5

6. `api-tester`
7. `bug-hunter`
8. `code-reviewer`
9. `docs-writer`
10. `test-writer`

### 业务 5

11. `competitor-pricing`
12. `customer-support`
13. `meeting-scheduler`
14. `sales-assistant`
15. `lead-gen`

### 创意 5

16. `copywriter`
17. `thumbnail-designer`
18. `ux-researcher`
19. `video-scripter`
20. `proofreader`

### 数据 5

21. `dashboard-builder`
22. `data-cleaner`
23. `report-generator`
24. `sql-assistant`
25. `anomaly-detector`

### 营销 5

26. `ab-test-analyzer`
27. `brand-monitor`
28. `influencer-finder`
29. `seo-writer`
30. `content-repurposer`

### 教育 5

31. `language-tutor`
32. `research-assistant`
33. `study-planner`
34. `essay-grader`
35. `flashcard-generator`

### 安全 5

36. `phishing-detector`
37. `security-hardener`
38. `threat-monitor`
39. `vuln-scanner`
40. `access-auditor`

### SaaS 5

41. `churn-prevention`
42. `feature-request`
43. `onboarding-flow`
44. `release-notes`
45. `usage-analytics`

### 自动化 5

46. `morning-briefing`
47. `overnight-coder`
48. `negotiation-agent`
49. `job-applicant`
50. `flight-scraper`

## 为什么不是更多

不是找不到，而是 v1 不该把市场做成噪声列表。

50 条的意义是：

- 覆盖足够广的真实场景
- 仍然可以人工 review
- 便于后续做首屏分类和精选
- 避免把来源不清晰或命名质量差的条目一起带进产品

## 下一步

- 把这 50 条固化成代码清单
- 为每条补齐：
  - 显示名称
  - 简介
  - 分类
  - 来源路径
  - 安装语义
- 市场 v1 只读取这份冻结清单
