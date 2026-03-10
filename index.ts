import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { tapdRpc, sendWecomWebhook, sendWecomAppMarkdownMessage } from './src/client.ts';

function parseCsvSet(value: unknown) {
  return new Set(String(value || '').split(',').map(s => s.trim()).filter(Boolean));
}

function pickFirst(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function normalizeTapdList(result: any) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.Story)) return result.Story;
  if (Array.isArray(result?.Task)) return result.Task;
  if (Array.isArray(result?.Bug)) return result.Bug;
  if (Array.isArray(result?.stories)) return result.stories;
  if (Array.isArray(result?.tasks)) return result.tasks;
  if (Array.isArray(result?.bugs)) return result.bugs;
  return [];
}

function buildReminderMarkdown(args: any, items: any[], cfg: any) {
  const doneStatuses = parseCsvSet(args.done_statuses || cfg.reminderDoneStatuses || '已关闭,关闭,done,closed,完成,已完成,resolved');
  const excludedAssignees = parseCsvSet(args.excluded_assignees || cfg.reminderExcludedAssignees || '');
  const assigneeField = pickFirst(args.assignee_field, cfg.reminderAssigneeField, 'owner');
  const workspaceId = String(args.workspace_id || cfg.tapdWorkspaceId || '');
  const requestedType = String(args.entity_type || 'all');
  const groups = new Map<string, any[]>();

  for (const raw of items) {
    const item = raw?.Story || raw?.Task || raw || {};
    const status = pickFirst(item.status, item.workflow_step, item.flow_status, item.state);
    if (doneStatuses.has(status)) continue;
    const owner = pickFirst(item[assigneeField], item.owner, item.current_owner, item.user, '未分配');
    if (excludedAssignees.has(owner)) continue;
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner)!.push(item);
  }

  const owners = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const totalOpen = owners.reduce((sum, [, list]) => sum + list.length, 0);
  const now = new Date();
  const nowCn = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const lines = [
    '# TAPD 未完成项提醒（完整清单）',
    `> 项目: ${workspaceId}`,
    `> 类型: ${requestedType}`,
    `> 生成时间: ${nowCn}`,
    `> 未完成负责人: ${owners.length}`,
    `> 未完成项总数: ${totalOpen}`,
  ];

  if (!owners.length) {
    lines.push('> 当前没有需要提醒的未完成项 🎉');
    return { markdown: lines.join('\n'), summary: [], totalOpen: 0 };
  }

  for (const [owner, list] of owners) {
    lines.push(`\n## ${owner}（${list.length}）`);
    for (const item of list) {
      const id = pickFirst(item.id);
      const title = pickFirst(item.name, item.title, '(无标题)');
      const status = pickFirst(item.status, item.workflow_step, item.flow_status, '未知状态');
      const entityType = pickFirst(item.__entity_type, requestedType === 'all' ? 'stories' : requestedType);
      const entityKind = entityType === 'tasks' ? 'task' : entityType === 'bugs' ? 'bug' : 'story';
      const typeLabel = entityType === 'tasks' ? '任务' : entityType === 'bugs' ? '缺陷' : '需求';
      const url = id ? makeUrl(cfg.tapdBaseUrl, workspaceId, entityKind, id) : '';
      lines.push(`- [${typeLabel}] ${title}｜ID: ${id || '-'}｜状态: ${status}${url ? `｜链接: <${url}>` : ''}`);
    }
  }

  return {
    markdown: lines.join('\n'),
    totalOpen,
    summary: owners.map(([owner, list]) => ({ owner, count: list.length })),
  };
}

function out(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], details: data };
}

function parseNotifyFlag(options: any) {
  const raw = options?.notify_wecom ?? options?.notifyWecom ?? options?.notify_group ?? options?.notifyGroup ?? options?.notify_to_group
    ?? options?.notifyToGroup ?? options?.notify_to_wecom ?? options?.notifyToWecom ?? options?.notify ?? options?.notify_wecom_group;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (!v) return false;
    return ['true', '1', 'yes', 'y', 'on', 'wecom', 'group', 'group_wecom', 'group-wecom'].includes(v);
  }
  return Boolean(raw);
}

function stripNotifyOptions(params: any) {
  const options = { ...(params?.options || {}) } as any;
  delete options.notify_wecom;
  delete options.notifyWecom;
  delete options.notify_group;
  delete options.notifyGroup;
  delete options.notify_to_group;
  delete options.notifyToGroup;
  delete options.notify_to_wecom;
  delete options.notifyToWecom;
  delete options.notify;
  delete options.notify_wecom_group;
  delete options.notify_channel;
  delete options.notifyChannel;
  return { ...params, options };
}

function makeUrl(base: string | undefined, workspaceId: string | number, kind: string, id: string | number) {
  const b = String(base || 'https://www.tapd.cn').trim().replace(/\/$/, '');
  if (kind === 'bug') return `${b}/${workspaceId}/bugtrace/bugs/view/${id}`;
  if (kind === 'story') return `${b}/${workspaceId}/prong/stories/view/${id}`;
  if (kind === 'task') return `${b}/${workspaceId}/prong/tasks/view/${id}`;
  if (kind === 'iteration') return `${b}/${workspaceId}/prong/iterations/card_view/${id}`;
  if (kind === 'wiki') return `${b}/${workspaceId}/markdown_wikis/show/#${id}`;
  if (kind === 'tcase') return `${b}/${workspaceId}/sparrow/tcase/view/${id}`;
  return `${b}/${workspaceId}`;
}

function resolveWecomChannel(cfg: any, channel?: string) {
  const raw = String(channel || cfg.wecomPreferredChannel || 'auto').trim().toLowerCase();
  if (raw === 'webhook') return 'webhook';
  if (raw === 'app') return 'app';
  return 'auto';
}

async function notifyWecom(_api: OpenClawPluginApi, cfg: any, markdown: string, channel?: string) {
  const preferred = resolveWecomChannel(cfg, channel);
  const result: Record<string, unknown> = { preferred };
  const allowWebhook = preferred === 'auto' || preferred === 'webhook';
  const allowApp = preferred === 'auto' || preferred === 'app';
  let attempted = false;
  if (allowWebhook && cfg.wecomWebhook) {
    attempted = true;
    try {
      result.group = await sendWecomWebhook(cfg, markdown);
    } catch (err) {
      result.group = { ok: false, error: String(err) };
    }
  }
  if (allowApp && cfg.wecomAppCorpId && cfg.wecomAppCorpSecret && cfg.wecomAppAgentId && cfg.wecomAppToUser) {
    attempted = true;
    try {
      result.user = await sendWecomAppMarkdownMessage(cfg, markdown);
    } catch (err) {
      result.user = { ok: false, error: String(err) };
    }
  }
  if (!attempted) {
    result.skipped = true;
    result.reason = 'no_wecom_channel_configured';
  }
  return result;
}

const OPTIONAL_TOOL = { optional: true } as const;

const plugin = {
  id: 'tapd-wecom',
  name: 'TAPD + WeCom',
  description: 'TAPD MCP proxy and WeCom linked notification tools',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tapdBaseUrl: { type: 'string' },
      tapdAccessToken: { type: 'string' },
      tapdWorkspaceId: { type: 'string' },
      wecomWebhook: { type: 'string' },
      mcpBaseUrl: { type: 'string' },
      mcpToken: { type: 'string' },
      tapdApiUser: { type: 'string' },
      tapdApiPassword: { type: 'string' },
      currentUserNick: { type: 'string' },
      wecomAppCorpId: { type: 'string' },
      wecomAppCorpSecret: { type: 'string' },
      wecomAppAgentId: { type: 'string' },
      wecomAppToUser: { type: 'string' },
      wecomAppApiBaseUrl: { type: 'string' },
      wecomPreferredChannel: { type: 'string', enum: ['auto', 'webhook', 'app'] },
      reminderAssigneeField: { type: 'string' },
      reminderDoneStatuses: { type: 'string' },
      reminderExcludedAssignees: { type: 'string' },
    },
  },
  register(api: OpenClawPluginApi) {
    const cfg = () => {
      const pluginCfg = ((api as any).pluginConfig ?? (api.getConfig?.() ?? {})) as any;
      return pluginCfg;
    };

    const tapdPendingReminderInternal = async (runtimeCfg: any, params: any) => {
      const requestedType = String(params.entity_type || 'all');
      const targets = requestedType === 'all' ? ['stories', 'tasks', 'bugs'] : [requestedType];
      const allItems: any[] = [];
      const fetchedByType: Record<string, number> = {};

      for (const entityType of targets) {
        const scopedQuery = entityType === 'stories'
          ? (params.stories_query || params.query || {})
          : entityType === 'tasks'
            ? (params.tasks_query || params.query || {})
            : (params.bugs_query || params.query || {});
        const result = entityType === 'bugs'
          ? await tapdRpc(runtimeCfg, 'get_bug', {
              workspace_id: params.workspace_id,
              options: { limit: 200, page: 1, ...scopedQuery },
            })
          : await tapdRpc(runtimeCfg, 'get_stories_or_tasks', {
              workspace_id: params.workspace_id,
              options: { limit: 200, page: 1, ...scopedQuery, entity_type: entityType },
            });
        const items = normalizeTapdList(result).map((item: any) => ({ ...item, __entity_type: entityType }));
        fetchedByType[entityType] = items.length;
        allItems.push(...items);
      }

      const built = buildReminderMarkdown({ ...params, entity_type: requestedType }, allItems, runtimeCfg);
      const notified = params.dry_run ? null : await notifyWecom(api, runtimeCfg, built.markdown, params.notify_channel || 'webhook');
      return {
        ok: true,
        entity_type: requestedType,
        workspace_id: params.workspace_id,
        totalFetched: allItems.length,
        fetchedByType,
        totalOpen: built.totalOpen,
        summary: built.summary,
        markdown: built.markdown,
        notified,
      };
    };

    const startReminderCron = () => {
      const runtimeCfg = cfg();
      const cronExpr = String(runtimeCfg.reminderCron || '').trim();
      if (!cronExpr) return;
      let CronJob: any;
      try {
        const cronPkg = require('cron');
        CronJob = cronPkg.CronJob || cronPkg.default || cronPkg;
      } catch (err) {
        api.logger?.warn?.('tapd-wecom: reminderCron is set but cron package is missing');
        return;
      }
      try {
        const timeZone = String(runtimeCfg.reminderCronTimezone || 'Asia/Shanghai');
        const job = new CronJob(cronExpr, async () => {
          try {
            await tapdPendingReminderInternal(runtimeCfg, {
              workspace_id: runtimeCfg.tapdWorkspaceId,
              entity_type: runtimeCfg.reminderEntityType || 'all',
              query: runtimeCfg.reminderQuery,
              stories_query: runtimeCfg.reminderStoriesQuery,
              tasks_query: runtimeCfg.reminderTasksQuery,
              bugs_query: runtimeCfg.reminderBugsQuery,
              assignee_field: runtimeCfg.reminderAssigneeField,
              done_statuses: runtimeCfg.reminderDoneStatuses,
              excluded_assignees: runtimeCfg.reminderExcludedAssignees,
              notify_channel: runtimeCfg.reminderNotifyChannel || 'webhook',
            });
          } catch (err) {
            api.logger?.error?.('tapd-wecom: reminderCron run failed', err);
          }
        }, null, false, timeZone);
        job.start();
        api.logger?.info?.(`tapd-wecom: reminderCron scheduled (${cronExpr}) tz=${timeZone}`);
      } catch (err) {
        api.logger?.error?.('tapd-wecom: reminderCron schedule failed', err);
      }
    };

    startReminderCron();

    api.registerTool({
      name: 'tapd_configure_reminder',
      description: '配置 tapd-wecom 的定时巡检（保存到运行时配置，需重启插件生效）。',
      parameters: Type.Object({
        cron: Type.String(),
        cron_timezone: Type.Optional(Type.String({ default: 'Asia/Shanghai' })),
        entity_type: Type.Optional(Type.String({ default: 'all' })),
        notify_channel: Type.Optional(Type.String({ default: 'webhook' })),
        query: Type.Optional(Type.Any()),
        stories_query: Type.Optional(Type.Any()),
        tasks_query: Type.Optional(Type.Any()),
        bugs_query: Type.Optional(Type.Any()),
        assignee_field: Type.Optional(Type.String()),
        done_statuses: Type.Optional(Type.String()),
        excluded_assignees: Type.Optional(Type.String()),
      }),
      async execute(_id, params: any) {
        const runtimeCfg = cfg();
        const next = {
          ...runtimeCfg,
          reminderCron: params.cron,
          reminderCronTimezone: params.cron_timezone || runtimeCfg.reminderCronTimezone || 'Asia/Shanghai',
          reminderEntityType: params.entity_type || runtimeCfg.reminderEntityType || 'all',
          reminderNotifyChannel: params.notify_channel || runtimeCfg.reminderNotifyChannel || 'webhook',
          reminderQuery: params.query || runtimeCfg.reminderQuery,
          reminderStoriesQuery: params.stories_query || runtimeCfg.reminderStoriesQuery,
          reminderTasksQuery: params.tasks_query || runtimeCfg.reminderTasksQuery,
          reminderBugsQuery: params.bugs_query || runtimeCfg.reminderBugsQuery,
          reminderAssigneeField: params.assignee_field || runtimeCfg.reminderAssigneeField,
          reminderDoneStatuses: params.done_statuses || runtimeCfg.reminderDoneStatuses,
          reminderExcludedAssignees: params.excluded_assignees || runtimeCfg.reminderExcludedAssignees,
        };
        const output = {
          ok: true,
          reminderCron: next.reminderCron,
          reminderCronTimezone: next.reminderCronTimezone,
          reminderEntityType: next.reminderEntityType,
          reminderNotifyChannel: next.reminderNotifyChannel,
          reminderQuery: next.reminderQuery,
          reminderStoriesQuery: next.reminderStoriesQuery,
          reminderTasksQuery: next.reminderTasksQuery,
          reminderBugsQuery: next.reminderBugsQuery,
          reminderAssigneeField: next.reminderAssigneeField,
          reminderDoneStatuses: next.reminderDoneStatuses,
          reminderExcludedAssignees: next.reminderExcludedAssignees,
        };
        return out({
          ok: true,
          message: '已更新运行时配置（需要重启插件生效）。',
          config: output,
        });
      },
    }, OPTIONAL_TOOL);

    const registerProxy = (name: string, schema: any, after?: (params: any, result: any) => Promise<any>) => {
      api.registerTool({
        name,
        description: `Proxy TAPD MCP tool ${name}`,
        parameters: schema,
        async execute(_id, params: any) {
          const cleaned = stripNotifyOptions(params);
          const result = await tapdRpc(cfg(), name, cleaned);
          const patched = after ? await after(params, result) : result;
          return out(patched);
        },
      }, OPTIONAL_TOOL);
    };

    registerProxy('get_timesheets', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('update_timesheets', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('add_timesheets', Type.Object({ workspace_id: Type.String(), options: Type.Any() }), async (params) => {
      const options = params.options || {};
      const existing = await tapdRpc(cfg(), 'get_timesheets', {
        workspace_id: params.workspace_id,
        options: {
          entity_type: options.entity_type,
          entity_id: options.entity_id,
          owner: options.owner,
          spentdate: options.spentdate,
          limit: 30,
        },
      });
      const list = existing?.data || existing?.items || existing?.Timesheet || existing;
      const first = Array.isArray(list) ? list[0] : null;
      if (first?.id || first?.Timesheet?.id) {
        const id = first.id || first.Timesheet.id;
        return tapdRpc(cfg(), 'update_timesheets', {
          workspace_id: params.workspace_id,
          options: {
            id,
            timespent: options.timespent,
            timeremain: options.timeremain,
            memo: options.memo,
          },
        });
      }
      return tapdRpc(cfg(), 'add_timesheets', params);
    });

    registerProxy('create_bug', Type.Object({
      workspace_id: Type.String(),
      title: Type.String(),
      options: Type.Optional(Type.Object({
        notify_wecom: Type.Optional(Type.Boolean()),
        notifyWecom: Type.Optional(Type.Boolean()),
        notify_group: Type.Optional(Type.Boolean()),
        notifyGroup: Type.Optional(Type.Boolean()),
        notify_to_group: Type.Optional(Type.Boolean()),
        notifyToGroup: Type.Optional(Type.Boolean()),
        notify_to_wecom: Type.Optional(Type.Boolean()),
        notifyToWecom: Type.Optional(Type.Boolean()),
        notify: Type.Optional(Type.Boolean()),
        notify_wecom_group: Type.Optional(Type.Boolean()),
        notify_channel: Type.Optional(Type.String()),
        notifyChannel: Type.Optional(Type.String()),
      }, { additionalProperties: true })),
    }), async (params, result) => {
      const id = result?.id || result?.data?.id || result?.Bug?.id || result?.data?.Bug?.id;
      const url = id ? makeUrl(cfg().tapdBaseUrl, params.workspace_id, 'bug', id) : undefined;
      const markdown = id ? `# 🐞 TAPD 缺陷已创建\n> 项目: ${params.workspace_id}\n> 标题: ${params.title}\n> ID: ${id}\n> 链接: ${url}` : undefined;
      const notifyChannel = params.options?.notify_channel || params.options?.notifyChannel;
      const notified = markdown && parseNotifyFlag(params.options) ? await notifyWecom(api, cfg(), markdown, notifyChannel) : null;
      return { ...result, url, notified };
    });
    registerProxy('update_bug', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_bug', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_bug_count', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('create_comments', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('update_comments', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_comments', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('create_iteration', Type.Object({ workspace_id: Type.String(), options: Type.Any() }), async (params, result) => {
      const id = result?.id || result?.data?.id || result?.Iteration?.id;
      return { ...result, url: id ? makeUrl(cfg().tapdBaseUrl, params.workspace_id, 'iteration', id) : undefined };
    });
    registerProxy('update_iteration', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_iterations', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('create_or_update_tcases', Type.Object({ workspace_id: Type.String(), options: Type.Any() }), async (params, result) => {
      const id = result?.id || result?.data?.id || result?.Tcase?.id;
      return { ...result, url: id ? makeUrl(cfg().tapdBaseUrl, params.workspace_id, 'tcase', id) : undefined };
    });
    registerProxy('get_tcases', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('create_tcases_batch_save', Type.Object({
      workspace_id: Type.String(),
      tcases: Type.Array(Type.Any()),
    }));
    registerProxy('create_story_or_task', Type.Object({
      workspace_id: Type.String(),
      name: Type.String(),
      options: Type.Object({
        entity_type: Type.Optional(Type.String()),
        notify_wecom: Type.Optional(Type.Boolean()),
        notifyWecom: Type.Optional(Type.Boolean()),
        notify_group: Type.Optional(Type.Boolean()),
        notifyGroup: Type.Optional(Type.Boolean()),
        notify_to_group: Type.Optional(Type.Boolean()),
        notifyToGroup: Type.Optional(Type.Boolean()),
        notify_to_wecom: Type.Optional(Type.Boolean()),
        notifyToWecom: Type.Optional(Type.Boolean()),
        notify: Type.Optional(Type.Boolean()),
        notify_wecom_group: Type.Optional(Type.Boolean()),
        notify_channel: Type.Optional(Type.String()),
        notifyChannel: Type.Optional(Type.String()),
      }, { additionalProperties: true }),
    }), async (params, result) => {
      const entity = params.options?.entity_type === 'tasks' ? 'task' : 'story';
      const id = result?.id || result?.data?.id || result?.Story?.id || result?.Task?.id || result?.data?.Story?.id || result?.data?.Task?.id;
      const url = id ? makeUrl(cfg().tapdBaseUrl, params.workspace_id, entity, id) : undefined;
      const typeLabel = entity === 'task' ? '任务' : '需求';
      const markdown = id ? `# ✅ TAPD ${typeLabel}已创建\n> 项目: ${params.workspace_id}\n> 标题: ${params.name}\n> ID: ${id}\n> 链接: ${url}` : undefined;
      const notifyChannel = params.options?.notify_channel || params.options?.notifyChannel;
      const notified = markdown && parseNotifyFlag(params.options) ? await notifyWecom(api, cfg(), markdown, notifyChannel) : null;
      return { ...result, url, notified };
    });
    registerProxy('update_story_or_task', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_stories_or_tasks', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_story_or_task_count', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('create_wiki', Type.Object({ workspace_id: Type.String(), options: Type.Any() }), async (params, result) => {
      const id = result?.id || result?.data?.id || result?.Wiki?.id;
      return { ...result, url: id ? makeUrl(cfg().tapdBaseUrl, params.workspace_id, 'wiki', id) : undefined };
    });
    registerProxy('update_wiki', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_wiki', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('entity_relations', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_entity_custom_fields', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_image', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_attachments', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_attachment_download_url', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_related_bugs', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_release_info', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_stories_fields_info', Type.Object({ workspace_id: Type.String() }));
    registerProxy('get_stories_fields_lable', Type.Object({ workspace_id: Type.String() }));
    registerProxy('get_tcases_custom_fields_settings', Type.Object({ workspace_id: Type.String() }));
    registerProxy('get_bug_custom_fields', Type.Object({ workspace_id: Type.String() }));
    registerProxy('get_category_id', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_commit_msg', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_scm_copy_keywords', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_todo', Type.Object({ entity_type: Type.String(), user_nick: Type.Optional(Type.String()) }));
    registerProxy('get_user_story_todo', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_user_bug_todo', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_user_task_todo', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_user_participant_projects', Type.Object({ nick: Type.Optional(Type.String()) }));
    registerProxy('get_workflows_all_transitions', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_workflows_last_steps', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_workflows_status_map', Type.Object({ workspace_id: Type.String(), options: Type.Any() }));
    registerProxy('get_workitem_types', Type.Object({ workspace_id: Type.String(), options: Type.Optional(Type.Any()) }));
    registerProxy('get_workspace_info', Type.Object({ workspace_id: Type.String() }));

    api.registerTool({
      name: 'send_qiwei_message',
      description: 'Proxy TAPD MCP tool send_qiwei_message',
      parameters: Type.Object({ msg: Type.String() }),
      async execute(_id, params: any) {
        return out(await sendWecomWebhook(cfg(), params.msg));
      },
    }, OPTIONAL_TOOL);

    api.registerTool({
      name: 'tapd_webhook_preview',
      description: '输入 TAPD webhook payload，返回格式化后的企业微信通知内容与对象链接。',
      parameters: Type.Object({ payload: Type.Any() }),
      async execute(_id, params: any) {
        const p = params.payload || {};
        const event = String(p.event || 'unknown');
        const workspaceId = String(p.workspace_id || cfg().tapdWorkspaceId || '');
        const id = String(p.id || '');
        const actor = String(p.current_user || '-');
        const created = String(p.created || '-');
        const changeFields = String(p.change_fields || '');
        const kind = event.startsWith('story::') ? 'story' : event.startsWith('bug::') ? 'bug' : event.startsWith('task::') ? 'task' : event.startsWith('launchform::') ? 'launchform' : 'unknown';
        const url = kind === 'story' ? makeUrl(cfg().tapdBaseUrl, workspaceId, 'story', id)
          : kind === 'bug' ? makeUrl(cfg().tapdBaseUrl, workspaceId, 'bug', id)
          : kind === 'task' ? makeUrl(cfg().tapdBaseUrl, workspaceId, 'task', id)
          : `${(cfg().tapdBaseUrl || 'https://www.tapd.cn').replace(/\/$/, '')}/${workspaceId}`;
        const markdown = [
          '# 🔔 TAPD 事件通知',
          `> 事件: ${event}`,
          `> 项目: ${workspaceId}`,
          `> 操作人: ${actor}`,
          `> 时间: ${created}`,
          `> 对象ID: ${id}`,
          changeFields ? `> 变更字段: ${changeFields}` : '',
          `> 链接: ${url}`,
        ].filter(Boolean).join('\n');
        return out({ markdown, url, payload: p });
      },
    }, OPTIONAL_TOOL);

    api.registerTool({
      name: 'tapd_webhook_forward',
      description: '输入 TAPD webhook payload，校验可选 secret 后转发格式化消息到企业微信。',
      parameters: Type.Object({ payload: Type.Any(), secret: Type.Optional(Type.String()) }),
      async execute(_id, params: any) {
        const p = params.payload || {};
        if (params.secret && p.secret && String(params.secret) !== String(p.secret)) {
          return out({ ok: false, error: 'secret mismatch' });
        }
        const event = String(p.event || 'unknown');
        const workspaceId = String(p.workspace_id || cfg().tapdWorkspaceId || '');
        const id = String(p.id || '');
        const actor = String(p.current_user || '-');
        const created = String(p.created || '-');
        const changeFields = String(p.change_fields || '');
        const kind = event.startsWith('story::') ? 'story' : event.startsWith('bug::') ? 'bug' : event.startsWith('task::') ? 'task' : 'unknown';
        const url = kind === 'story' ? makeUrl(cfg().tapdBaseUrl, workspaceId, 'story', id)
          : kind === 'bug' ? makeUrl(cfg().tapdBaseUrl, workspaceId, 'bug', id)
          : kind === 'task' ? makeUrl(cfg().tapdBaseUrl, workspaceId, 'task', id)
          : `${(cfg().tapdBaseUrl || 'https://www.tapd.cn').replace(/\/$/, '')}/${workspaceId}`;
        const markdown = [
          '# 🔔 TAPD 事件通知',
          `> 事件: ${event}`,
          `> 项目: ${workspaceId}`,
          `> 操作人: ${actor}`,
          `> 时间: ${created}`,
          `> 对象ID: ${id}`,
          changeFields ? `> 变更字段: ${changeFields}` : '',
          `> 链接: ${url}`,
        ].filter(Boolean).join('\n');
        const forwarded = await notifyWecom(api, cfg(), markdown);
        return out({ ok: true, markdown, url, forwarded });
      },
    }, OPTIONAL_TOOL);

    api.registerTool({
      name: 'tapd_pending_reminder',
      description: '查询空间内未完成的需求或任务；可只查 stories、只查 tasks，或一起巡检 all 并按负责人聚合后发送到企业微信群/应用消息。适合被 cron 定时调用。',
      parameters: Type.Object({
        workspace_id: Type.String(),
        entity_type: Type.Optional(Type.String({ default: 'all' })),
        query: Type.Optional(Type.Any()),
        stories_query: Type.Optional(Type.Any()),
        tasks_query: Type.Optional(Type.Any()),
        bugs_query: Type.Optional(Type.Any()),
        assignee_field: Type.Optional(Type.String()),
        done_statuses: Type.Optional(Type.String()),
        excluded_assignees: Type.Optional(Type.String()),
        limit_per_owner: Type.Optional(Type.Number()),
        dry_run: Type.Optional(Type.Boolean()),
        notify_channel: Type.Optional(Type.String({ default: 'webhook' })),
      }),
      async execute(_id, params: any) {
        const result = await tapdPendingReminderInternal(cfg(), params);
        return out(result);
      },
    }, OPTIONAL_TOOL);

    api.registerTool({
      name: 'tapd_wecom_test',
      description: '测试若干 TAPD 工具和企业微信 webhook 是否工作。',
      parameters: Type.Object({ workspace_id: Type.String(), owner: Type.Optional(Type.String()) }),
      async execute(_id, params: any) {
        const runtimeCfg = cfg();
        const debug = {
          workspace_id: params.workspace_id,
          runtime: {
            tapdBaseUrl: String(runtimeCfg.tapdBaseUrl || ''),
            mcpBaseUrl: String(runtimeCfg.mcpBaseUrl || ''),
            tapdWorkspaceId: String(runtimeCfg.tapdWorkspaceId || ''),
            currentUserNick: String(runtimeCfg.currentUserNick || ''),
            hasTapdAccessToken: Boolean(runtimeCfg.tapdAccessToken),
            hasTapdApiUser: Boolean(runtimeCfg.tapdApiUser),
            hasTapdApiPassword: Boolean(runtimeCfg.tapdApiPassword),
            hasWecomWebhook: Boolean(runtimeCfg.wecomWebhook),
            hasWecomApp: Boolean(runtimeCfg.wecomAppCorpId && runtimeCfg.wecomAppCorpSecret && runtimeCfg.wecomAppAgentId),
          },
        };
        const stories = await tapdRpc(runtimeCfg, 'get_stories_or_tasks', { workspace_id: params.workspace_id, options: { entity_type: 'stories', limit: 1, page: 1 } });
        const qiwei = await notifyWecom(api, runtimeCfg, `# TAPD 联动测试\n> workspace_id: ${params.workspace_id}\n已成功调用 get_stories_or_tasks。`);
        return out({ ok: true, debug, stories, qiwei });
      },
    }, OPTIONAL_TOOL);
  },
};

export default plugin;
