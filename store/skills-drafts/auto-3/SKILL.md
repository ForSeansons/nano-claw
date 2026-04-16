---
name: auto
description: Auto-extracted recurring workflow for intent: 帮我推荐一部今晚看的电影-不要太烧脑的-温情的-推荐
---

# auto

## When to Use

- 好，帮我记一下今晚看了这部电影

## When NOT to Use

- The request belongs to a different explicit skill category.
- The user asks for unrelated one-off exploration.
- Required context or permissions are missing.

## Input Signals

- intent key: 帮我推荐一部今晚看的电影-不要太烧脑的-温情的-推荐
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
