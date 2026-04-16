# Skill Routing Guidelines (Container-side Claude Code)

## Scope and architecture

NanoClaw does not run a host-side skill router. Skill selection happens inside containerized Claude Code from `.claude/skills/` content.

This guideline improves routing quality by improving skill signals, not by adding a separate router process.

## Routing principle

Use a two-step strategy:

1. Pre-selection: use `skill-index` when intent is ambiguous.
2. Execution: load one target skill and follow its `When to Use` + `When NOT to Use` + `Procedure`.

## Required SKILL.md sections

Every container skill should include:

- `description` (precise, disambiguating)
- `When to Use`
- `When NOT to Use`
- `Input Signals`
- `Procedure`
- `Verification`
- `Anti-patterns`

## Description writing rules

Good descriptions should:

- Say what the skill does in one sentence.
- Include scope boundaries (where it should NOT be used).
- Use route-specific keywords users actually type.

Avoid:

- Generic wording like "helpful for many tasks".
- Overlapping broad descriptions across multiple skills.

## Suggested routing flow

1. Platform/context gate (main-only, Slack context, etc.)
2. Tool/ability gate (is required capability available?)
3. Fallback check (is this only a fallback skill?)
4. Policy check (allowed/denied/preferred from CLAUDE.md)
5. Semantic match (intent vs skill name/description)
6. If ambiguous, load `skill-index` first
7. Execute one selected skill

## Lightweight policy in CLAUDE.md

Prefer natural-language policy in group `CLAUDE.md` over custom parser code.

Recommended block:

```md
## Skill Policy

Allowed skills:
- status
- capabilities
- agent-browser

Denied skills:
- slack-formatting

Preferred mappings:
- runtime health -> status
- capability inventory -> capabilities
```

The model should treat this block as routing constraints.

## Operational checklist for new skills

1. Add the required sections.
2. Add at least 3 "When NOT to Use" bullets.
3. Add one-line tie-breaker against neighboring skills.
4. Add one verification checklist.
5. Add examples with realistic prompts.

## Why this approach

- Works with current architecture (container-side selection).
- Low implementation risk and no extra runtime layer.
- Improves routing quality immediately with few skills.
