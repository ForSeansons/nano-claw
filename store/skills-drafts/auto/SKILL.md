---
name: auto
description: Auto-extracted recurring workflow for intent: 今天天气怎么样-适合出门跑步吗-帮我列一下今天要做的事情-好的
---

# auto

## When to Use

- 好的，帮我在 9:45 提醒开会

## When NOT to Use

- The request belongs to a different explicit skill category.
- The user asks for unrelated one-off exploration.
- Required context or permissions are missing.

## Input Signals

- intent key: 今天天气怎么样-适合出门跑步吗-帮我列一下今天要做的事情-好的
- frequent patterns from trajectory with source count: 1

## Procedure

1. Confirm the request matches the intent signals.
2. Run the minimum necessary steps for this recurring task.
3. Return concise result and key evidence.

## Verification

- Output directly addresses the user request.
- Evidence/check output is included when applicable.
- No unnecessary steps are executed.

## Anti-patterns

- Over-expanding scope beyond the recurring task.
- Claiming success without evidence.
- Mixing unrelated workflows into one response.
