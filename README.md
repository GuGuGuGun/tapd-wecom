# tapd-wecom

OpenClaw plugin for TAPD query/mutation and WeCom notification delivery.

## What it does

- Proxies common TAPD operations into OpenClaw tools
- Creates TAPD bugs / stories / tasks / wiki / iterations / comments / timesheets
- Adds direct TAPD URLs to created entities when possible
- Sends WeCom notifications through:
  - group robot webhook
  - WeCom app markdown messages
- Supports webhook preview / forwarding workflows
- Includes an integration test tool: `tapd_wecom_test`

## Status

This repository version is the **working, verified version**.
It has been validated end-to-end for:

- TAPD read access
- TAPD bug creation
- WeCom webhook delivery
- WeCom app delivery

## Important fix

The key runtime fix in this version is:

- plugin config must be read from **`api.pluginConfig`**
- falling back to `api.getConfig?.()` is fine, but not sufficient in this runtime

Without this fix, the plugin can load successfully while receiving an empty runtime config.

## Plugin layout

- `index.ts` — plugin registration and tool definitions
- `src/client.ts` — TAPD / WeCom client helpers
- `openclaw.plugin.json` — plugin manifest and config schema

## Required config

Configure `plugins.entries["tapd-wecom"].config` in `openclaw.json`.

Typical fields:

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

## Minimal example

```json
{
  "plugins": {
    "entries": {
      "tapd-wecom": {
        "enabled": true,
        "config": {
          "tapdBaseUrl": "https://www.tapd.cn",
          "tapdWorkspaceId": "67411607",
          "mcpBaseUrl": "https://api.tapd.cn",
          "tapdAccessToken": "<token>",
          "tapdApiUser": "<user>",
          "tapdApiPassword": "<password>",
          "currentUserNick": "JiangMingKai",
          "wecomWebhook": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
          "wecomAppCorpId": "ww...",
          "wecomAppCorpSecret": "...",
          "wecomAppAgentId": "1000003",
          "wecomAppToUser": "JiangMingKai"
        }
      }
    }
  }
}
```

## Example tools

- `get_stories_or_tasks`
- `create_story_or_task`
- `create_bug`
- `get_bug`
- `create_comments`
- `tapd_webhook_preview`
- `tapd_webhook_forward`
- `tapd_pending_reminder`
- `tapd_wecom_test`

## Verification notes

Validated in a live OpenClaw runtime with:

- successful TAPD workspace query
- successful `get_stories_or_tasks`
- successful `create_bug`
- successful WeCom webhook push
- successful WeCom app push

## Usage

1. Ensure plugin path is listed in `plugins.load.paths`
2. Enable `plugins.entries.tapd-wecom.enabled`
3. Fill config in `openclaw.json`
4. Restart gateway
5. Run `tapd_wecom_test`

## Skill

This plugin ships with a companion skill guide at:

- `../../skills/tapd-wecom/SKILL.md`

## License

Private / workspace-local unless you choose to publish it.
