---
name: configure-swarm-policy
description: Configure Skill Policy and Swarm Policy as reusable CLAUDE.md policy blocks. Use when user wants to apply or update team-routing rules without committing personal groups/* CLAUDE.md files.
---

# Configure Swarm/Skill Policy (Operational Skill)

Apply `Skill Policy` + `Swarm Policy` + optional `Integrator Role Card` to a target `CLAUDE.md` in a reusable, user-selected way.

This skill is for operational configuration, not personal preset commits.

## Goal

- Add/update policy blocks in the user's chosen `CLAUDE.md`.
- Keep repo clean: do not directly commit personal `groups/*/CLAUDE.md` by default.
- Use a simple, stable policy format that works with current NanoClaw architecture.

## Policy Template (Recommended)

Use this exact policy content unless the user requests edits:

```md
## Skill Policy

Allowed skills:
- status
- capabilities
- agent-browser
- skill-index

Denied skills:
- slack-formatting (for non-Slack groups)

Preferred routing:
- capability/what-can-you-do questions: capabilities > status

## Swarm Policy

Default behavior:
- Use single-agent by default.
- Start swarm only when at least one condition is true:
  - 3+ relatively independent sub-problems
  - Need parallel retrieval from multiple data sources
  - Need cross-validation between independent analyses

Swarm size/model:
- Default teammate count: 3
- Hard maximum teammate count: 5
- Prefer haiku for researcher/analyst teammates when creating them

Scratch workspace convention (prompt-level rule):
- researcher writes only to `/workspace/group/.swarm/researcher/`
- analyst writes only to `/workspace/group/.swarm/analyst/`
- judge writes only to `/workspace/group/.swarm/judge/`
- integrator is the only role allowed to merge results into formal output paths
- teammates must not directly modify formal files under `/workspace/group/` root

Artifact naming convention (keep simple):
- `.swarm/{role}/{YYYYMMDD_HHMMSS}_{desc}.md`
- Example: `.swarm/researcher/20260417_143022_sources.md`

Integrator merge/cleanup rule:
- If merge verification passes: clean up `.swarm/*`
- If merge fails or merge is skipped: keep `.swarm/*` and record reason in `.swarm/_merge_notes.md`
```

Optional (recommended) compact role card:

```md
## Integrator Role Card (Compact)

Role goal:
- Collect teammate outputs from `.swarm/*` and produce final merged deliverable.

Execution checklist:
- Read teammate artifacts first; do not write formal files before review.
- Verify filename format is compliant: `.swarm/{role}/{YYYYMMDD_HHMMSS}_{desc}.md`.
- Merge only validated content into formal output paths.
- Run merge verification (scope/consistency/completeness).

Cleanup decision:
- Verification passed: clean `.swarm/*`.
- Verification failed or merge skipped: keep `.swarm/*` and log reason in `.swarm/_merge_notes.md`.
```

## Workflow

1. Confirm target file with user:
- Default options:
  - `groups/main/CLAUDE.md`
  - `groups/global/CLAUDE.md`
  - a specific group `groups/<name>/CLAUDE.md`

2. Read target `CLAUDE.md` first.

3. Apply policy safely:
- If `## Skill Policy` / `## Swarm Policy` already exist, replace those blocks.
- If not present, append policy blocks after communication/general behavior sections.
- Keep unrelated existing content unchanged.

4. If user asks for channel-specific behavior:
- Keep one generic template.
- Only adjust the `Denied skills` line (e.g., non-Slack groups deny `slack-formatting`).

5. Validation:
- Re-open file and confirm all required sections exist:
  - `## Skill Policy`
  - `## Swarm Policy`
  - (optional) `## Integrator Role Card (Compact)`

6. Reporting:
- Summarize what was inserted/updated and file path.
- Explain this is prompt-level governance (not hard sandbox permissions).

## Git/Commit Guidance

- Do not commit `groups/*/CLAUDE.md` automatically unless user explicitly asks.
- Preferred repo artifact to commit: operational skill file(s) and docs.

If the user asks to share this capability with others:
- Commit this skill under `.claude/skills/configure-swarm-policy/`.
- Optionally add a short Chinese doc in `docs/` explaining policy intent and limitations.

