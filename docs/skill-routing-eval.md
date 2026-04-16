# Skill Routing Evaluation Set

Use this checklist to compare routing quality before vs after skill doc improvements.

## How to run

1. Use the same environment and skill set.
2. Run each prompt once.
3. Record selected skill and whether it was correct.
4. Compute hit rate and ambiguity rate.

## Labels

- Expected skill: one of `status`, `capabilities`, `agent-browser`, `slack-formatting`, `none`.
- Correct: yes/no.
- Notes: why misrouted.

## Evaluation prompts

1. "给我看下现在系统状态，容器和任务正常吗？" -> `status`
2. "What can you do in this workspace right now?" -> `capabilities`
3. "请打开 https://example.com 并截图首页" -> `agent-browser`
4. "把这段日报改成 Slack 可直接发的格式" -> `slack-formatting`
5. "列一下现在安装了哪些 skills" -> `capabilities`
6. "看看服务健康情况和任务队列" -> `status`
7. "帮我登录这个网站并提交表单" -> `agent-browser`
8. "这个频道不是 Slack，帮我正常回复就行" -> `none`
9. "Do a quick health check" -> `status`
10. "Show me available MCP tools" -> `capabilities`
11. "Extract product names from this webpage" -> `agent-browser`
12. "把这段 markdown 转成 mrkdwn" -> `slack-formatting`
13. "状态和能力都给我看看" -> `skill-index` then `capabilities` (or split response)
14. "我现在能不能发定时任务？" -> `capabilities`
15. "任务是不是卡住了" -> `status`
16. "Visit docs page and click the first CTA" -> `agent-browser`
17. "Slack 里怎么写 @channel 和链接" -> `slack-formatting`
18. "你支持哪些命令" -> `capabilities`
19. "检查 IPC 和 mounts" -> `status`
20. "这个需求不需要网页和状态，只回答问题" -> `none`

## Scorecard template

| # | Prompt | Expected | Selected | Correct | Notes |
|---|---|---|---|---|---|
| 1 | ... | status | ... | ... | ... |

## Metrics

- Hit rate = correct / total
- Over-trigger rate = selected skill when expected is `none`
- Ambiguity rate = cases needing `skill-index` tie-break

## Success threshold (small skill set)

- Hit rate >= 90%
- Over-trigger rate <= 10%
- Ambiguity rate <= 15%
