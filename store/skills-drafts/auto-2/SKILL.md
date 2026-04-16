---
name: auto
description: Auto-extracted recurring workflow for intent: 帮我起草一封邮件-给客户道歉项目延期-语气再正式一点-加上具体的补偿方案
---

# auto

## When to Use

- 语气再正式一点，加上具体的补偿方案：免费延长一个月维护期

## When NOT to Use

- The request belongs to a different explicit skill category.
- The user asks for unrelated one-off exploration.
- Required context or permissions are missing.

## Input Signals

- intent key: 帮我起草一封邮件-给客户道歉项目延期-语气再正式一点-加上具体的补偿方案
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
