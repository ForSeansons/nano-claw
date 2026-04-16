---
name: slack-formatting
description: Convert responses into Slack mrkdwn style for Slack contexts (group folder starts with slack_ or chat context is Slack).
---

# Slack Message Formatting (mrkdwn)

Use Slack mrkdwn syntax instead of standard Markdown when responding in Slack contexts.

## When to Use

Use this skill when:

- Current chat is Slack (`slack_*` group context)
- User asks to format/rewrite message for Slack
- Output needs Slack-compatible markup

## When NOT to Use

Do NOT use this skill when:

- Chat is not Slack
- User did not request format conversion and plain response is sufficient
- Task is system status/capabilities/web browsing

## Input Signals

Strong signals:

- "format for Slack", "slack message", "mrkdwn"
- Slack group folder prefix (`slack_`)
- Need mention/channel/link formatting in Slack syntax

## How to detect Slack context

Check:

- Group folder starts with `slack_` (e.g., `slack_engineering`)
- Workspace/group path includes `slack_`

If Slack context is unclear, ask a short clarification before converting syntax.

## Procedure

1. Determine whether current context is Slack.
2. If yes, rewrite message in mrkdwn.
3. Preserve semantics; only transform formatting.
4. Verify links, mentions, bullets, and emphasis follow Slack rules.

## Verification

Before sending, verify:

- Bold uses `*text*` (not `**text**`)
- Links use `<url|text>`
- Lists use bullets (not numbered markdown lists)
- No markdown headers/tables/horizontal rules

## Anti-patterns

Avoid these mistakes:

- Applying Slack syntax in non-Slack channels
- Altering factual content while only formatting was requested
- Mixing Markdown and mrkdwn styles

## Formatting reference

### Text styles

| Style | Syntax | Example |
|-------|--------|---------|
| Bold | `*text*` | *bold text* |
| Italic | `_text_` | _italic text_ |
| Strikethrough | `~text~` | ~strikethrough~ |
| Code (inline) | `` `code` `` | `inline code` |
| Code block | ` ```code``` ` | Multi-line code |

### Links and mentions

```
<https://example.com|Link text>
<https://example.com>
<@U1234567890>
<#C1234567890>
<!here>
<!channel>
```

### Lists

Use bullets:

```
• First item
• Second item
• Third item
```

### Block quotes

```
> This is a block quote
> It can span multiple lines
```

### Emoji

Use shortcode form: `:white_check_mark:`, `:x:`, `:rocket:`, `:tada:`

## What NOT to use

- `##` headings
- `**double asterisks**` for bold
- `[text](url)` links
- `1.` markdown numbered lists
- markdown tables
- `---` horizontal rules
