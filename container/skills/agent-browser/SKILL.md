---
name: agent-browser
description: Use browser automation for tasks that require interacting with live websites (navigation, extraction, forms, screenshots, checks). Prefer this for dynamic web pages.
allowed-tools: Bash(agent-browser:*)
---

# Browser Automation with agent-browser

## When to Use

Use this skill when the task needs:

- Visiting live websites
- Clicking/typing/selecting on pages
- Reading dynamic content after JS rendering
- Taking screenshots/PDFs
- Filling forms or validating UI flows

## When NOT to Use

Do NOT use this skill when:

- The user only asked for system status/capabilities (`/status` or `/capabilities`)
- The task is only text formatting (e.g., Slack mrkdwn conversion)
- A quick static fetch/search is enough (prefer lightweight tools first)
- The user did not ask for web interaction and no browser action is needed

## Input Signals

Strong signals for this skill:

- "open website", "click", "fill form", "take screenshot"
- "extract from page", "test this page", "登录并提交"
- URLs plus interaction verbs

## Quick start

```bash
agent-browser open <url>
agent-browser snapshot -i
agent-browser click @e1
agent-browser fill @e2 "text"
agent-browser close
```

## Procedure

1. Navigate: `agent-browser open <url>`
2. Snapshot: `agent-browser snapshot -i` to get interactive refs
3. Interact with refs (`@e1`, `@e2`, ...)
4. Re-snapshot after navigation or major DOM changes
5. Verify expected state/text/url before reporting success

## Verification

Before finishing, confirm at least one of:

- Target text/value/attribute is present
- URL/state changed as expected
- Screenshot/PDF captured if requested
- Form action succeeded (toast, redirect, row created, etc.)

## Anti-patterns

Avoid these mistakes:

- Using stale refs without re-snapshot after page changes
- Reporting success without checking page state
- Running unnecessary browser steps for simple non-web tasks

## Command reference

### Navigation

```bash
agent-browser open <url>
agent-browser back
agent-browser forward
agent-browser reload
agent-browser close
```

### Snapshot

```bash
agent-browser snapshot
agent-browser snapshot -i
agent-browser snapshot -c
agent-browser snapshot -d 3
agent-browser snapshot -s "#main"
```

### Interactions

```bash
agent-browser click @e1
agent-browser dblclick @e1
agent-browser fill @e2 "text"
agent-browser type @e2 "text"
agent-browser press Enter
agent-browser hover @e1
agent-browser check @e1
agent-browser uncheck @e1
agent-browser select @e1 "value"
agent-browser scroll down 500
agent-browser upload @e1 file.pdf
```

### Read data

```bash
agent-browser get text @e1
agent-browser get html @e1
agent-browser get value @e1
agent-browser get attr @e1 href
agent-browser get title
agent-browser get url
agent-browser get count ".item"
```

### Output artifacts

```bash
agent-browser screenshot
agent-browser screenshot path.png
agent-browser screenshot --full
agent-browser pdf output.pdf
```

### Wait

```bash
agent-browser wait @e1
agent-browser wait 2000
agent-browser wait --text "Success"
agent-browser wait --url "**/dashboard"
agent-browser wait --load networkidle
```

### Semantic locators

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"
```

### Auth state

```bash
agent-browser state save auth.json
agent-browser state load auth.json
```

### Cookies/storage/eval

```bash
agent-browser cookies
agent-browser cookies set name value
agent-browser cookies clear
agent-browser storage local
agent-browser storage local set k v
agent-browser eval "document.title"
```
