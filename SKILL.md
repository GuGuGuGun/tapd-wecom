---
name: tapd-wecom
description: Use when working with the tapd-wecom plugin to query TAPD work items, create or update TAPD entities, preview or forward TAPD webhook events, and send linked notifications into WeCom.
---

# tapd-wecom

This skill is the companion guide for the `tapd-wecom` OpenClaw plugin.

## Use this skill when

- querying TAPD stories / tasks / bugs
- creating TAPD bugs, stories, tasks, comments, wiki, iterations, or timesheets
- previewing or forwarding TAPD webhook payloads
- sending linked notifications into WeCom
- testing TAPD + WeCom integration through the plugin

## Core rule

Prefer the existing plugin tools instead of rebuilding TAPD or WeCom API calls manually.

## Runtime config note

This verified version depends on reading plugin config from:

- `api.pluginConfig`

and only using `api.getConfig?.()` as fallback.

That fix is important in this runtime, because using only `api.getConfig?.()` can produce an empty config even when `openclaw.json` is correctly populated.

## Main tools

### TAPD entity tools

- `get_stories_or_tasks`
- `get_story_or_task_count`
- `create_story_or_task`
- `update_story_or_task`
- `create_bug`
- `update_bug`
- `get_bug`
- `get_bug_count`
- `create_comments`
- `update_comments`
- `get_comments`
- `create_iteration`
- `update_iteration`
- `get_iterations`
- `create_or_update_tcases`
- `get_tcases`
- `create_wiki`
- `update_wiki`
- `get_wiki`
- `add_timesheets`
- `update_timesheets`
- `get_timesheets`

### WeCom / bridge tools

- `send_qiwei_message`
- `tapd_webhook_preview`
- `tapd_webhook_forward`
- `tapd_pending_reminder`
- `tapd_wecom_test`

## Expected config

Typical keys under `plugins.entries["tapd-wecom"].config`:

- `tapdBaseUrl`
- `tapdWorkspaceId`
- `mcpBaseUrl`
- `tapdAccessToken`
- `tapdApiUser`
- `tapdApiPassword`
- `currentUserNick`
- `wecomWebhook`
- `wecomAppCorpId`
- `wecomAppCorpSecret`
- `wecomAppAgentId`
- `wecomAppToUser`

## Recommended workflows

### Create a bug and notify WeCom

1. Call `create_bug`
2. Read returned `id` / `url`
3. Check `notified` for webhook/app delivery result
4. Report both TAPD object creation and WeCom delivery status

### Query stories or tasks

Use `get_stories_or_tasks` with:

- `entity_type: "stories"` for stories
- `entity_type: "tasks"` for tasks

### Test integration

Use `tapd_wecom_test` to verify:

- TAPD access works
- WeCom webhook works
- WeCom app push works

## Output guidance

When replying to users:

- state success/failure first
- include object type + id
- include TAPD URL when available
- distinguish webhook success from app-message success

## Repository note

This plugin repository is intended to be self-contained with:

- `README.md`
- `SKILL.md`
- `openclaw.plugin.json`
- `index.ts`
- `src/client.ts`

If you publish or move it later, keep the skill and manifest with the code.
