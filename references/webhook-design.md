# TAPD Webhook → WeCom Design

## Goal
Receive TAPD webhook events and forward useful summaries to WeCom robot.

## TAPD inbound formats
- application/json
- application/x-www-form-urlencoded

## Core fields
- event
- event_from
- workspace_id
- current_user
- event_id
- id
- secret
- created
- change_fields (update events)
- old_* (update events)

## Recommended flow
1. Receive request
2. Parse json/form
3. Verify optional shared secret
4. Build TAPD web URL from event + workspace_id + id
5. Format WeCom markdown message
6. POST or relay to WeCom bot endpoint

## URL mapping
- story -> {tapd_base_url}/{workspace_id}/prong/stories/view/{id}
- bug -> {tapd_base_url}/{workspace_id}/bugtrace/bugs/view/{id}
- task -> {tapd_base_url}/{workspace_id}/prong/tasks/view/{id}
- launchform -> release/review route needs confirmation

## Message template
# TAPD 事件通知
> 事件: story::update
> 项目: 67411607
> 操作人: 江铭凯
> 时间: 2026-03-09 15:31:00
> 对象ID: 1167...
> 变更字段: owner,status
> 链接: ...
