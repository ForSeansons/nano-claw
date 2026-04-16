---
name: capabilities
description: Show what this NanoClaw instance can do (installed skills, tool families, MCP tools, runtime context). Use for "what can you do" or /capabilities.
---

# /capabilities — System Capabilities Report

Generate a structured read-only report of what this NanoClaw instance can do.

## When to Use

Use this skill when the user asks for:

- "What can you do?"
- Installed skills and command surface
- Tool families and MCP tool availability
- Runtime capabilities overview
- `/capabilities`

## When NOT to Use

Do NOT use this skill when the user asks for:

- Runtime health right now (use `/status`)
- Web interaction/scraping (use `/agent-browser`)
- Slack formatting conversion (use `/slack-formatting`)
- Immediate troubleshooting traces/log for failures

## Input Signals

Strong signals for this skill:

- "capabilities", "what can you do", "有哪些能力"
- "installed skills", "available tools", "mcp tools"
- Explicit `/capabilities`

## Procedure

### 0) Main-channel gate

Only the main channel has `/workspace/project` mounted. Run:

```bash
test -d /workspace/project && echo "MAIN" || echo "NOT_MAIN"
```

If `NOT_MAIN`, respond with:

> This command is available in your main chat only. Send `/capabilities` there to see what I can do.

Then stop.

### 1) Installed skills

```bash
ls -1 /home/node/.claude/skills/ 2>/dev/null || echo "No skills found"
```

Each directory name maps to `/skill-name` command.

### 2) Available tools

Summarize available tool families:

- Core: Bash, Read, Write, Edit, Glob, Grep
- Web: WebSearch, WebFetch
- Orchestration: Task, TaskOutput, TaskStop, TeamCreate, TeamDelete, SendMessage
- Other: TodoWrite, ToolSearch, Skill, NotebookEdit
- MCP: mcp__nanoclaw__*

### 3) MCP server tools

List core MCP capabilities:

- send_message
- schedule_task
- list_tasks
- pause_task
- resume_task
- cancel_task
- update_task
- register_group (main only)

### 4) Container tools

```bash
which agent-browser 2>/dev/null && echo "agent-browser: available" || echo "agent-browser: not found"
```

### 5) Group context

```bash
ls /workspace/group/CLAUDE.md 2>/dev/null && echo "Group memory: yes" || echo "Group memory: no"
ls /workspace/extra/ 2>/dev/null && echo "Extra mounts: $(ls /workspace/extra/ 2>/dev/null | wc -l | tr -d ' ')" || echo "Extra mounts: none"
```

## Verification

Before replying, verify:

- Main/non-main gate handled correctly
- Skill list reflects actual directories found
- No claim about tools that are not available
- Clear separation between "capability overview" and "status health"

## Anti-patterns

Avoid these mistakes:

- Treating this as `/status`
- Listing hypothetical skills/tools not present
- Running mutation commands (read-only report only)

## Report format

```
📋 *NanoClaw Capabilities*

*Installed Skills:*
• /agent-browser — Browse and interact with web pages
• /capabilities — This report
(list all found skills)

*Tools:*
• Core: Bash, Read, Write, Edit, Glob, Grep
• Web: WebSearch, WebFetch
• Orchestration: Task, TeamCreate, SendMessage
• MCP: send_message, schedule_task, list_tasks, pause/resume/cancel/update_task, register_group

*Container Tools:*
• agent-browser: ✓

*System:*
• Group memory: yes/no
• Extra mounts: N directories
• Main channel: yes
```

Adapt output to actual findings.

See also `/status` for a quick health snapshot.
