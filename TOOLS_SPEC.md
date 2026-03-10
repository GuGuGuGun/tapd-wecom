# TAPD MCP Tools Spec

Source: user-provided MCP server capability summary.

Implemented priority tools:
- add_timesheets
- get_timesheets
- update_timesheets
- create_bug
- create_comments
- create_iteration
- create_or_update_tcases
- create_tcases_batch_save
- create_story_or_task
- create_wiki
- entity_relations
- get_bug
- get_bug_count
- get_bug_custom_fields
- get_comments
- get_commit_msg
- get_scm_copy_keywords
- get_entity_custom_fields
- get_image
- get_attachments
- get_attachment_download_url
- get_iterations
- get_related_bugs
- get_release_info
- get_stories_fields_info
- get_stories_fields_lable
- get_tcases
- get_tcases_custom_fields_settings
- get_story_or_task_count
- get_stories_or_tasks
- get_category_id
- get_todo
- get_user_story_todo
- get_user_bug_todo
- get_user_task_todo
- get_user_participant_projects
- get_wiki
- get_workflows_all_transitions
- get_workflows_last_steps
- get_workflows_status_map
- get_workitem_types
- get_workspace_info
- send_qiwei_message
- tapd_pending_reminder
- tapd_configure_reminder
- update_bug
- update_comments
- update_iteration
- update_story_or_task
- update_timesheets
- update_wiki

Notes:
- add_timesheets should first query get_timesheets by owner+spentdate and update when an existing record exists.
- URL rendering rules are defined per entity type.
- WeCom integration can be implemented via send_qiwei_message / robot webhook.
