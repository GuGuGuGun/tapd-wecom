# TAPD Plugin Test Plan

## API side
- verify quickstart/testauth
- get workspace info
- create story
- query story count
- add comment on created story
- add/update timesheet

## Webhook side
- simulate story::create json payload
- simulate story::update form payload
- verify secret rejection path
- verify formatted message output
- verify WeCom send adapter path
