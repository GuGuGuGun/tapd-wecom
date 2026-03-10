# tapd-wecom

OpenClaw 插件：用于 TAPD 查询/写入与企业微信通知投递。

## 功能概览

- 将常见 TAPD 操作代理为 OpenClaw 工具
- 创建 TAPD 缺陷 / 需求 / 任务 / Wiki / 迭代 / 评论 / 工时
- 创建实体时尽可能补充直达 TAPD 的链接
- 支持企业微信通知投递：
  - 群机器人 webhook
  - 企业微信应用的 Markdown 消息
- 支持 webhook 预览 / 转发流程
- 包含集成测试工具：`tapd_wecom_test`

## 状态

此仓库版本为 **已验证可用** 的版本。
已完成端到端验证：

- TAPD 读取能力
- TAPD 缺陷创建
- 企业微信 webhook 投递
- 企业微信应用投递

## 重要修复

本版本的关键运行时修复：

- 插件配置必须从 **`api.pluginConfig`** 读取
- 允许回退到 `api.getConfig?.()`，但这不足以保证配置可用

没有此修复时，插件可以正常加载，但运行时拿到的配置为空。

## 插件结构

- `index.ts` — 插件注册与工具定义
- `src/client.ts` — TAPD / 企业微信 客户端帮助函数
- `openclaw.plugin.json` — 插件清单与配置 schema

## 必填配置

在 `openclaw.json` 中配置 `plugins.entries["tapd-wecom"].config`。

常见字段：

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

## 最小示例

```json
{
  "plugins": {
    "entries": {
      "tapd-wecom": {
        "enabled": true,
        "config": {
          "tapdBaseUrl": "https://www.tapd.cn",
          "tapdWorkspaceId": "6",
          "mcpBaseUrl": "https://api.tapd.cn",
          "tapdAccessToken": "<token>",
          "tapdApiUser": "<user>",
          "tapdApiPassword": "<password>",
          "currentUserNick": "J",
          "wecomWebhook": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
          "wecomAppCorpId": "ww...",
          "wecomAppCorpSecret": "...",
          "wecomAppAgentId": "1000003",
          "wecomAppToUser": "J"
        }
      }
    }
  }
}
```

## 示例工具

- `get_stories_or_tasks`
- `create_story_or_task`
- `create_bug`
- `get_bug`
- `create_comments`
- `tapd_webhook_preview`
- `tapd_webhook_forward`
- `tapd_pending_reminder`
- `tapd_wecom_test`

## 验证说明

在真实 OpenClaw 运行环境中完成验证：

- 成功查询 TAPD 工作区
- 成功执行 `get_stories_or_tasks`
- 成功执行 `create_bug`
- 成功推送企业微信 webhook
- 成功推送企业微信应用消息

## 使用步骤

1. 确认插件路径已加入 `plugins.load.paths`
2. 启用 `plugins.entries.tapd-wecom.enabled`
3. 在 `openclaw.json` 中填入配置
4. 重启 gateway
5. 运行 `tapd_wecom_test`

## Skill

本插件附带技能指南：

- `../../skills/tapd-wecom/SKILL.md`

## 许可

私有 / 本地仓库使用，除非你选择发布。 
