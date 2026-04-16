---
name: status
description: Quick health check for the current NanoClaw runtime (session, mounts, tools, scheduled tasks). Use only for "current status/health" questions or /status.
---

# /status — System Status Check

Generate a quick read-only status report of the current agent environment.

## When to Use

Use this skill when the user asks for:

- Current runtime health/status
- Whether the bot is working now
- Mounted workspace visibility
- Scheduled task snapshot
- `/status`

## When NOT to Use

Do NOT use this skill when the user asks for:

- Full capability inventory (use `/capabilities`)
- Web browsing or extraction (use `/agent-browser`)
- Slack message style conversion (use `/slack-formatting`)
- Setup, installation, or debugging deep root causes

## Input Signals

Strong signals for this skill:

- "status", "health", "is it running", "当前状态", "现在是否正常"
- "check mounts", "check tasks", "runtime check"
- Explicit `/status`

## Procedure

### 0) Main-channel gate

Only the main channel has `/workspace/project` mounted. Run:

```bash
test -d /workspace/project && echo "MAIN" || echo "NOT_MAIN"
```

If `NOT_MAIN`, respond with:

> This command is available in your main chat only. Send `/status` there to check system status.

Then stop.

### 1) Session context

```bash
echo "Timestamp: $(date)"
echo "Working dir: $(pwd)"
echo "Channel: main"
```

### 2) Workspace and mounts

```bash
echo "=== Workspace ==="
ls /workspace/ 2>/dev/null
echo "=== Group folder ==="
ls /workspace/group/ 2>/dev/null | head -20
echo "=== Extra mounts ==="
ls /workspace/extra/ 2>/dev/null || echo "none"
echo "=== IPC ==="
ls /workspace/ipc/ 2>/dev/null
```

### 3) Tool availability (summary)

Confirm tool families are available:

- Core: Bash, Read, Write, Edit, Glob, Grep
- Web: WebSearch, WebFetch
- Orchestration: Task, TaskOutput, TaskStop, TeamCreate, TeamDelete, SendMessage
- MCP: mcp__nanoclaw__* (send_message, schedule_task, list_tasks, pause_task, resume_task, cancel_task, update_task, register_group)

### 4) Container utilities

```bash
which agent-browser 2>/dev/null && echo "agent-browser: available" || echo "agent-browser: not installed"
node --version 2>/dev/null
claude --version 2>/dev/null
```

### 5) Task snapshot

Call `mcp__nanoclaw__list_tasks` to get scheduled tasks.

If no tasks exist, report "No scheduled tasks."

## Verification

Before replying, verify:

- Main/non-main gate handled correctly
- Report includes session, workspace, tools, container info, and tasks
- Output is concise (health snapshot, not deep troubleshooting)

## Anti-patterns

Avoid these mistakes:

- Dumping long diagnostics logs unrelated to status
- Returning capability catalog instead of health snapshot
- Running write/edit commands (this skill is read-only)

## Report format

```
🔍 *NanoClaw Status*

*Session:*
• Channel: main
• Time: 2026-03-14 09:30 UTC
• Working dir: /workspace/group

*Workspace:*
• Group folder: ✓ (N files)
• Extra mounts: none / N directories
• IPC: ✓ (messages, tasks, input)

*Tools:*
• Core: ✓  Web: ✓  Orchestration: ✓  MCP: ✓

*Container:*
• agent-browser: ✓ / not installed
• Node: vXX.X.X
• Claude Code: vX.X.X

*Scheduled Tasks:*
• N active tasks / No scheduled tasks
```

Adapt based on actual findings.

See also `/capabilities` for a full list of installed skills and tools.
