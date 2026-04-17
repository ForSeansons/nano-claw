# Skill Routing Evaluation Set

Use this checklist to compare routing quality before vs after skill doc improvements.

---

## How to Run

### Environment setup

1. Ensure the target skill set is loaded in the container:
   ```bash
   ls data/sessions/discord_main/.claude/skills/
   # Expected: agent-browser  capabilities  skill-index  slack-formatting  status
   ```

2. Start NanoClaw and confirm the service is running:
   ```bash
   launchctl list | grep nanoclaw
   # Expected: <PID>  0  com.nanoclaw
   ```

3. For each prompt, send it to the registered Discord channel and observe:
   - Which skill (if any) Claude invokes — look for `Selected skill:` in the response (skill-index outputs this)
   - Whether the response content matches the expected skill's output

4. Record results in the Scorecard below.

5. Compute metrics after all 25 prompts are run.

### How to detect which skill was selected

- `status` — response contains runtime health info (session, mounts, tasks)
- `capabilities` — response lists installed skills and available tools
- `agent-browser` — response involves browser actions or page content
- `slack-formatting` — response contains Slack mrkdwn syntax explanation or conversion
- `skill-index` — response starts with `Selected skill:` routing note
- `none` — response is a direct answer with no skill invocation

---

## Labels

- **Expected**: one of `status`, `capabilities`, `agent-browser`, `slack-formatting`, `skill-index`, `none`
- **Selected**: what Claude actually did
- **Correct**: `Y` if Selected matches Expected (or is an acceptable alternative), `N` otherwise
- **Error type**: one of `miss` (wrong skill), `over-trigger` (skill used when none expected), `under-trigger` (no skill when one expected), `ambiguity` (needed skill-index tie-break but didn't use it)

---

## Evaluation Prompts (25 total)

### Positive cases — clear single skill

| # | Prompt | Expected |
|---|---|---|
| 1 | "给我看下现在系统状态，容器和任务正常吗？" | `status` |
| 2 | "What can you do in this workspace right now?" | `capabilities` |
| 3 | "请打开 https://example.com 并截图首页" | `agent-browser` |
| 4 | "把这段日报改成 Slack 可直接发的格式" | `slack-formatting` |
| 5 | "列一下现在安装了哪些 skills" | `capabilities` |
| 6 | "看看服务健康情况和任务队列" | `status` |
| 7 | "帮我登录这个网站并提交表单" | `agent-browser` |
| 8 | "Do a quick health check" | `status` |
| 9 | "Show me available MCP tools" | `capabilities` |
| 10 | "Extract product names from this webpage: https://example.com" | `agent-browser` |
| 11 | "把这段 markdown 转成 mrkdwn" | `slack-formatting` |
| 12 | "任务是不是卡住了" | `status` |
| 13 | "Visit docs page and click the first CTA" | `agent-browser` |
| 14 | "Slack 里怎么写 @channel 和链接" | `slack-formatting` |
| 15 | "你支持哪些命令" | `capabilities` |
| 16 | "检查 IPC 和 mounts" | `status` |
| 17 | "我现在能不能发定时任务？" | `capabilities` |

### Negative cases — no skill needed

| # | Prompt | Expected |
|---|---|---|
| 18 | "这个频道不是 Slack，帮我正常回复就行" | `none` |
| 19 | "这个需求不需要网页和状态，只回答问题" | `none` |
| 20 | "今天天气怎么样" | `none` |
| 21 | "帮我算一下 15% 的税，总价是 320 元" | `none` |
| 22 | "Write me a short apology email" | `none` |

### Ambiguity cases — skill-index tie-break expected

| # | Prompt | Expected |
|---|---|---|
| 23 | "状态和能力都给我看看" | `skill-index` → outputs both `status` + `capabilities` |
| 24 | "帮我 check 一下 status，顺便告诉我有哪些工具" | `skill-index` → outputs both `status` + `capabilities` |
| 25 | "Is the bot healthy and what can it do?" | `skill-index` → outputs both `status` + `capabilities` |

---

## Scorecard

### Before (baseline — original SKILL.md, no skill-index)

Run date: ___________

| # | Expected | Selected | Correct | Error type | Notes |
|---|---|---|---|---|---|
| 1 | status | | | | |
| 2 | capabilities | | | | |
| 3 | agent-browser | | | | |
| 4 | slack-formatting | | | | |
| 5 | capabilities | | | | |
| 6 | status | | | | |
| 7 | agent-browser | | | | |
| 8 | status | | | | |
| 9 | capabilities | | | | |
| 10 | agent-browser | | | | |
| 11 | slack-formatting | | | | |
| 12 | status | | | | |
| 13 | agent-browser | | | | |
| 14 | slack-formatting | | | | |
| 15 | capabilities | | | | |
| 16 | status | | | | |
| 17 | capabilities | | | | |
| 18 | none | | | | |
| 19 | none | | | | |
| 20 | none | | | | |
| 21 | none | | | | |
| 22 | none | | | | |
| 23 | skill-index | | | | |
| 24 | skill-index | | | | |
| 25 | skill-index | | | | |

**Baseline metrics:**

| Metric | Value | Target |
|---|---|---|
| Hit rate (correct / 25) | / 25 = % | ≥ 72% |
| Over-trigger rate (skill used when none expected, / 5) | / 5 = % | ≤ 40% |
| Ambiguity rate (skill-index used correctly, / 3) | / 3 = % | ≥ 0% |

> Baseline targets are intentionally loose — the point is to establish a real number, not to pass.

---

### After (improved SKILL.md + skill-index)

Run date: ___________

| # | Expected | Selected | Correct | Error type | Notes |
|---|---|---|---|---|---|
| 1 | status | | | | |
| 2 | capabilities | | | | |
| 3 | agent-browser | | | | |
| 4 | slack-formatting | | | | |
| 5 | capabilities | | | | |
| 6 | status | | | | |
| 7 | agent-browser | | | | |
| 8 | status | | | | |
| 9 | capabilities | | | | |
| 10 | agent-browser | | | | |
| 11 | slack-formatting | | | | |
| 12 | status | | | | |
| 13 | agent-browser | | | | |
| 14 | slack-formatting | | | | |
| 15 | capabilities | | | | |
| 16 | status | | | | |
| 17 | capabilities | | | | |
| 18 | none | | | | |
| 19 | none | | | | |
| 20 | none | | | | |
| 21 | none | | | | |
| 22 | none | | | | |
| 23 | skill-index | | | | |
| 24 | skill-index | | | | |
| 25 | skill-index | | | | |

**After metrics:**

| Metric | Value | Target |
|---|---|---|
| Hit rate (correct / 25) | / 25 = % | ≥ 90% |
| Over-trigger rate (skill used when none expected, / 5) | / 5 = % | ≤ 10% |
| Ambiguity rate (skill-index used correctly, / 3) | / 3 = % | ≥ 67% |

---

## Pass / Fail Criteria

### Improvement is validated if ALL of the following hold:

1. **Hit rate improved** by ≥ 10 percentage points vs baseline
2. **After hit rate ≥ 90%**
3. **Over-trigger rate ≤ 10%** (after)
4. **Ambiguity rate ≥ 67%** — skill-index correctly handles at least 2 of 3 tie-break cases

### Improvement is inconclusive if:

- Hit rate improved but did not reach 90%
- Over-trigger rate improved but still > 10%
- Action: review `When NOT to Use` sections of failing skills and re-run

### Regression is flagged if:

- After hit rate < baseline hit rate
- Action: revert SKILL.md changes for the regressed skill and investigate

---

## Metrics Reference

```
Hit rate         = (number of Correct=Y) / 25
Over-trigger     = (skill selected when Expected=none) / 5
Ambiguity rate   = (skill-index correctly used) / 3
Miss rate        = (wrong skill selected, not none) / 20  [positive+ambiguity cases]
Under-trigger    = (none selected when skill expected) / 20
```

---

## Estimated Baseline (pre-improvement)

Based on the known issues before the skill doc improvements:

| Metric | Estimated baseline |
|---|---|
| Hit rate | ~65–75% |
| Over-trigger rate | ~30–40% |
| Ambiguity rate | ~0% (skill-index did not exist) |

Primary failure modes expected in baseline:
- `status` vs `capabilities` confusion (both are "what's happening" queries)
- `slack-formatting` triggered on non-Slack channels
- No tie-break mechanism for compound queries (#23–25)
