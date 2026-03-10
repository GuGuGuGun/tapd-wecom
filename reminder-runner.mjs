import fs from 'node:fs';
import plugin from './index.ts';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

const argv = parseArgs(process.argv);
const all = JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json', 'utf8'));
const cfg = all.plugins.entries['tapd-wecom']?.config;
if (!cfg) throw new Error('tapd-wecom config not found in /root/.openclaw/openclaw.json');

const tools = new Map();
const api = {
  getConfig() { return cfg; },
  registerTool(factory, meta) {
    const tool = factory();
    tools.set(meta?.name || tool.name, tool);
  },
};

plugin.register(api);

const tool = tools.get('tapd_pending_reminder');
if (!tool) throw new Error('tapd_pending_reminder not registered');

const params = {
  workspace_id: String(argv.workspace || cfg.tapdWorkspaceId || ''),
  entity_type: String(argv.entityType || 'all'),
  assignee_field: argv.assigneeField,
  done_statuses: argv.doneStatuses,
  excluded_assignees: argv.excludedAssignees,
  limit_per_owner: argv.limitPerOwner ? Number(argv.limitPerOwner) : undefined,
  dry_run: Boolean(argv.dryRun),
  notify_channel: String(argv.notifyChannel || 'webhook'),
};

if (!params.workspace_id) throw new Error('workspace_id missing; provide --workspace or set tapdWorkspaceId in config');
if (argv.queryJson) params.query = JSON.parse(argv.queryJson);
if (argv.storiesQueryJson) params.stories_query = JSON.parse(argv.storiesQueryJson);
if (argv.tasksQueryJson) params.tasks_query = JSON.parse(argv.tasksQueryJson);
if (argv.bugsQueryJson) params.bugs_query = JSON.parse(argv.bugsQueryJson);

const res = await tool.execute('cron-reminder', params);
const text = res?.details ? JSON.stringify(res.details, null, 2) : JSON.stringify(res, null, 2);
console.log(text);
if (res?.details?.ok === false) process.exit(1);
