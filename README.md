# tapd-wecom

OpenClaw 插件：连接 TAPD 与企业微信（WeCom），提供 TAPD 读写工具，并支持通过群机器人 webhook / 应用消息进行通知。

## 功能

- TAPD 代理工具（需求/任务/缺陷/评论/迭代/用例/Wiki/工时/工作流元数据等）
- 创建实体时自动补充 TAPD 直达链接
- 企业微信通知投递：
  - 群机器人 webhook
  - 企业微信应用 Markdown 消息
- webhook 预览与转发工具
- 集成测试工具：`tapd_wecom_test`

## 安装（OpenClaw）

### 1) 放置插件目录

将插件放到 OpenClaw workspace：

```
~/.openclaw/workspace/plugins/tapd-wecom
```

### 2) 在 `openclaw.json` 中启用插件

添加插件路径与配置：

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

### 3) 重启 OpenClaw

重启主进程以加载插件。

### 4) 验证

运行测试工具：

```
.tapd_wecom_test
```

（或通过 OpenClaw UI/API 直接调用工具）

## 配置说明

配置路径：

```
plugins.entries["tapd-wecom"].config
```

常用字段：

- `tapdBaseUrl`
- `tapdWorkspaceId`
- `mcpBaseUrl`
- `tapdAccessToken` 或 `tapdApiUser` + `tapdApiPassword`
- `currentUserNick`
- `wecomWebhook`
- `wecomAppCorpId`, `wecomAppCorpSecret`, `wecomAppAgentId`, `wecomAppToUser`
- `wecomPreferredChannel`（`webhook|app|auto`）

## 使用示例

### 创建缺陷并通知企微

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

### 手动触发未完成项提醒

```json
{
  "workspace_id": "67411607",
  "entity_type": "all",
  "notify_channel": "webhook"
}
```

## 定时巡检（未完成项）

可通过配置在启动时自动巡检：

- `reminderCron`: cron 表达式（如 `0 9 * * 1-5`）
- `reminderCronTimezone`: 时区（如 `Asia/Shanghai`）
- `reminderEntityType`: `stories|tasks|bugs|all`
- `reminderNotifyChannel`: `webhook|app|auto`
- 可选过滤：`reminderQuery` / `reminderStoriesQuery` / `reminderTasksQuery` / `reminderBugsQuery`

> 注意：`tapd_configure_reminder` 仅更新运行时配置；若要重启后生效，必须写入 `openclaw.json` 并重启。

## 通知模板（默认）

- 缺陷创建：`# 🐞 TAPD 缺陷已创建`
- 需求/任务创建：`# ✅ TAPD 需求/任务已创建`
- 事件通知：`# 🔔 TAPD 事件通知`

## 开发说明

- `index.ts` — 插件入口与工具定义
- `src/client.ts` — TAPD/企业微信 客户端封装
- `openclaw.plugin.json` — 插件清单与配置 schema

## License

UNLICENSED（私有/本地使用，除非你决定发布）。
