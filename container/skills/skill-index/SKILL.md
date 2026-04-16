---
name: skill-index
description: Lightweight skill routing index. Use when multiple skills might apply and you need to choose one before execution.
---

# Skill Index — Pre-selection Router

This is a decision aid skill. It helps select the right skill before loading/executing it.

## When to Use

Use this skill when:

- More than one skill looks plausible
- User request is ambiguous
- You want a fast route decision before loading deeper skill content

## When NOT to Use

Do NOT use this skill when:

- User explicitly invoked a specific skill (`/status`, `/capabilities`, etc.)
- Only one skill is clearly applicable

## Selection order

Always follow this order:

1. Platform/context gate
2. Tool/ability gate
3. Fallback check
4. Disabled-policy check (from CLAUDE.md policy notes)
5. Semantic match (intent + skill name/description)
6. If still ambiguous, load target skill and follow `When to Use` / `When NOT to Use`

## Fast decision table

| User intent | Preferred skill | Avoid |
|---|---|---|
| Runtime health/status now | `status` | `capabilities`, `agent-browser` |
| What can this bot do | `capabilities` | `status` |
| Interact with website / forms / screenshot | `agent-browser` | `status`, `capabilities` |
| Convert reply style for Slack | `slack-formatting` | all non-formatting skills |

## Tie-breakers

If two skills still match:

1. Prefer the one with narrower scope
2. Prefer explicit command invoked by user
3. Prefer read-only/reporting skill before heavy-action skill

## Output requirement

When used, output a short routing note before execution:

- `Selected skill: <name>`
- `Reason: <one sentence>`
- `Rejected: <skill list + short reason>`

Then load and execute only the selected skill.
