---
name: auto-g10
description: Auto-extracted recurring workflow for intent: 帮我查一下明天上海到北京的高铁-最早几点出发-g10-的二等座
---

# auto-g10

## When to Use

- 好的，帮我明天早上6点设个闹钟提醒出发

## When NOT to Use

- The request belongs to a different explicit skill category.
- The user asks for unrelated one-off exploration.
- Required context or permissions are missing.

## Input Signals

- intent key: 帮我查一下明天上海到北京的高铁-最早几点出发-g10-的二等座
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
