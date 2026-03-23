# Agent 市场 58 条内置种子

## 来源原则

内置市场不做开放抓取，只使用受控来源。

当前唯一来源：

- 仓库：`mergisi/awesome-openclaw-agents`
- 本地镜像：`/Users/jianglong/workspace/awesome-openclaw-agents`
- 许可：`MIT`
- 机器可读清单：`agents.json`

注意：

- 上游 `README` 宣称 `177`
- `agents.json.total = 174`
- `agents.json.agents.length = 177`

因此 `XClaw` 不做全量镜像，而是冻结一份受控的 **58 条** catalogue，并明确偏向真实高频场景，而不是均匀分桶。

## 当前选择标准

- 必须是 OpenClaw 兼容的 `SOUL.md` 模板来源
- 必须来自 MIT 仓库
- 必须能抽取出清晰的职责、亮点与详情结构
- 优先覆盖高频真实使用场景
- 优先扩充此前明显偏弱的 `management` 与 `development`
- 不为了分类均匀而强行保留低价值模板

## 当前分类结构

### 管理 5

1. `daily-standup`
2. `meeting-notes`
3. `feature-request`
4. `product-scrum`
5. `orion`

### 效率 4

6. `focus-timer`
7. `habit-tracker`
8. `inbox-zero`
9. `metrics`

### 开发 10

10. `api-tester`
11. `bug-hunter`
12. `code-reviewer`
13. `dependency-scanner`
14. `migration-helper`
15. `pr-merger`
16. `qa-tester`
17. `schema-designer`
18. `docs-writer`
19. `test-writer`

### 商业 5

20. `customer-support`
21. `meeting-scheduler`
22. `sales-assistant`
23. `lead-gen`
24. `competitor-pricing`

### 创意 5

25. `copywriter`
26. `thumbnail-designer`
27. `ux-researcher`
28. `video-scripter`
29. `proofreader`

### 数据 5

30. `dashboard-builder`
31. `data-cleaner`
32. `report-generator`
33. `sql-assistant`
34. `anomaly-detector`

### 营销 5

35. `ab-test-analyzer`
36. `brand-monitor`
37. `influencer-finder`
38. `seo-writer`
39. `content-repurposer`

### 教育 5

40. `language-tutor`
41. `research-assistant`
42. `study-planner`
43. `essay-grader`
44. `flashcard-generator`

### 安全 5

45. `phishing-detector`
46. `security-hardener`
47. `threat-monitor`
48. `vuln-scanner`
49. `access-auditor`

### SaaS 4

50. `churn-prevention`
51. `onboarding-flow`
52. `release-notes`
53. `usage-analytics`

### 自动化 5

54. `morning-briefing`
55. `overnight-coder`
56. `negotiation-agent`
57. `job-applicant`
58. `flight-scraper`

## 为什么不是更多

不是找不到，而是 v1 不该把市场做成噪声列表。

58 条的意义是：

- 已经能覆盖管理、效率、开发、业务、内容、数据等主干场景
- 仍然可以人工 review 内容质量
- 允许为每条补齐本地化摘要和详情
- 避免把命名差、职责不清、质量不稳的条目一并带进产品

## 这一轮修正了什么

- 不再机械维持“每类 5 个”的假平衡
- 新增了真实的 `management` 分类
- 明显扩充了 `development` 的深度
- 中文市场内容已覆盖当前 58 条 catalogue
- 分类名称通过壳层本地化，不再直接暴露英文原始值

## 下一步

- 继续人工抽查每条模板的中文摘要质量
- 按真实安装和使用反馈做精选，而不是继续盲目扩容
- 保持市场是受控 catalogue，不接受任意 URL 安装
