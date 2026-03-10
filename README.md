# tapd-wecom

OpenClaw plugin that connects TAPD with WeCom (企业微信). It exposes TAPD read/write tools and can deliver notifications to WeCom via group robot webhook or app markdown messages.

## Features

- TAPD proxy tools (stories, tasks, bugs, comments, iterations, test cases, wiki, timesheets, workflow metadata)
- Create entities with direct TAPD URLs attached
- WeCom delivery:
  - Group robot webhook
  - WeCom app markdown message
- Webhook preview/forward helpers
- Built-in integration test tool (`tapd_wecom_test`)

## Installation (OpenClaw)

### 1) Clone or place the plugin

Put the plugin folder under your OpenClaw workspace:

```
~/.openclaw/workspace/plugins/tapd-wecom
```

### 2) Enable the plugin in `openclaw.json`

Add the plugin path and entry:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/root/.openclaw/workspace/plugins/tapd-wecom"
      ]
    },
    "entries": {
      "tapd-wecom": {
        "enabled": true,
        "config": {
          "tapdBaseUrl": "https://www.tapd.cn",
          "tapdWorkspaceId": "<workspace_id>",
          "mcpBaseUrl": "https://api.tapd.cn",
          "tapdAccessToken": "<token>",
          "tapdApiUser": "<user>",
          "tapdApiPassword": "<password>",
          "currentUserNick": "<your_nick>",
          "wecomWebhook": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
          "wecomAppCorpId": "ww...",
          "wecomAppCorpSecret": "...",
          "wecomAppAgentId": "1000003",
          "wecomAppToUser": "<user_id>",
          "wecomPreferredChannel": "webhook"
        }
      }
    }
  }
}
```

### 3) Restart OpenClaw

Restart your OpenClaw main process so the plugin loads.

### 4) Validate

Run the built-in test tool:

```
.tapd_wecom_test
```

(or call the tool directly via OpenClaw UI/API)

## Configuration

Required fields live under:

```
plugins.entries["tapd-wecom"].config
```

Common fields:

- `tapdBaseUrl`
- `tapdWorkspaceId`
- `mcpBaseUrl`
- `tapdAccessToken` or `tapdApiUser` + `tapdApiPassword`
- `currentUserNick`
- `wecomWebhook`
- `wecomAppCorpId`, `wecomAppCorpSecret`, `wecomAppAgentId`, `wecomAppToUser`
- `wecomPreferredChannel` (`webhook|app|auto`)

## Usage Examples

### Create a bug and notify WeCom

```json
{
  "workspace_id": "67411607",
  "title": "登录按钮无响应",
  "options": {
    "description": "点击后无反应",
    "priority": "高",
    "severity": "高",
    "notify_wecom": true,
    "notify_channel": "webhook"
  }
}
```

### Pending reminder (manual trigger)

```json
{
  "workspace_id": "67411607",
  "entity_type": "all",
  "notify_channel": "webhook"
}
```

## Scheduled reminders

The plugin can run periodic reminders on startup using cron config:

- `reminderCron`: cron expression (e.g. `0 9 * * 1-5`)
- `reminderCronTimezone`: timezone (e.g. `Asia/Shanghai`)
- `reminderEntityType`: `stories|tasks|bugs|all`
- `reminderNotifyChannel`: `webhook|app|auto`
- Optional filters: `reminderQuery`, `reminderStoriesQuery`, `reminderTasksQuery`, `reminderBugsQuery`

> Note: `tapd_configure_reminder` only changes runtime config. To make reminders persistent across restarts, update `openclaw.json` and restart.

## Notification templates (default)

- Bug created: `# 🐞 TAPD 缺陷已创建`
- Story/Task created: `# ✅ TAPD 需求/任务已创建`
- Event: `# 🔔 TAPD 事件通知`

## Development

- `index.ts` — plugin entry and tool definitions
- `src/client.ts` — TAPD/WeCom client helpers
- `openclaw.plugin.json` — plugin manifest + config schema

## License

UNLICENSED (private/local use unless you choose to publish).
