export type TapdConfig = {
  tapdBaseUrl?: string;
  tapdAccessToken?: string;
  tapdWorkspaceId?: string;
  wecomWebhook?: string;
  mcpBaseUrl?: string;
  mcpToken?: string;
  tapdApiUser?: string;
  tapdApiPassword?: string;
  currentUserNick?: string;
  wecomAppCorpId?: string;
  wecomAppCorpSecret?: string;
  wecomAppAgentId?: number | string;
  wecomAppToUser?: string;
  wecomAppApiBaseUrl?: string;
  wecomPreferredChannel?: 'auto' | 'webhook' | 'app';
  reminderAssigneeField?: string;
  reminderDoneStatuses?: string;
  reminderExcludedAssignees?: string;
};

function authHeader(cfg: TapdConfig) {
  if (cfg.tapdAccessToken) return `Bearer ${cfg.tapdAccessToken}`;
  if (cfg.tapdApiUser && cfg.tapdApiPassword) {
    return 'Basic ' + Buffer.from(`${cfg.tapdApiUser}:${cfg.tapdApiPassword}`).toString('base64');
  }
  return undefined;
}

function headers(cfg: TapdConfig) {
  return {
    'Content-Type': 'application/json',
    ...(authHeader(cfg) ? { Authorization: authHeader(cfg)! } : {}),
    Via: 'mcp',
  };
}

function withTracking(url: URL) {
  if (!url.searchParams.has('s')) url.searchParams.set('s', 'mcp');
  return url;
}

export async function tapdApiGet(cfg: TapdConfig, path: string, query?: Record<string, unknown>) {
  const base = String(cfg.mcpBaseUrl || 'https://api.tapd.cn').trim();
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(withTracking(url), { headers: headers(cfg) });
  const text = await res.text();
  if (!res.ok) throw new Error(`TAPD API failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function tapdApiPost(cfg: TapdConfig, path: string, body: Record<string, unknown>) {
  const base = String(cfg.mcpBaseUrl || 'https://api.tapd.cn').trim();
  const url = withTracking(new URL(path, base.endsWith('/') ? base : base + '/'));
  const res = await fetch(url, { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`TAPD API failed: ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function isCloudEnv(cfg: TapdConfig) {
  const base = cfg.mcpBaseUrl || 'https://api.tapd.cn';
  return base.includes('api.tapd.cn');
}

function toLongId(cfg: TapdConfig, workspaceId: string | number, id: unknown) {
  const raw = String(id ?? '').trim();
  if (!/^\d+$/.test(raw) || raw.length > 9) return raw;
  const padded = raw.padStart(9, '0');
  const prefix = isCloudEnv(cfg) ? '11' : '10';
  return `${prefix}${workspaceId}${padded}`;
}

function normalizeEntityIdFields(cfg: TapdConfig, workspaceId: string | undefined, data: Record<string, unknown>) {
  if (!workspaceId) return data;
  const keys = ['id', 'entry_id', 'entity_id', 'object_id', 'story_id', 'target_id', 'source_id'];
  for (const key of keys) {
    if (key in data && data[key] !== undefined && data[key] !== '') data[key] = toLongId(cfg, workspaceId, data[key]);
  }
  return data;
}

const getEndpoints: Record<string, string> = {
  get_workspace_info: 'workspaces/get_workspace_info',
  get_stories_or_tasks: 'stories',
  get_story_or_task_count: 'stories/count',
  get_bug: 'bugs',
  get_bug_count: 'bugs/count',
  get_comments: 'comments',
  get_entity_custom_fields: 'stories/custom_fields_settings',
  get_image: 'files/get_image',
  get_iterations: 'iterations',
  get_related_bugs: 'stories/get_related_bugs',
  get_release_info: 'releases',
  get_stories_fields_info: 'stories/get_fields_info',
  get_tcases: 'tcases',
  get_timesheets: 'timesheets',
  get_todo: 'users/todo',
  get_user_participant_projects: 'workspaces/user_participant_projects',
  get_wiki: 'tapd_wikis',
  get_workflows_all_transitions: 'workflows/all_transitions',
  get_workflows_last_steps: 'workflows/last_steps',
  get_workflows_status_map: 'workflows/status_map',
  get_workitem_types: 'workitem_types',
  get_commit_msg: 'svn_commits/get_scm_copy_keywords'
};

const postEndpoints: Record<string, string> = {
  create_story_or_task: 'stories',
  update_story_or_task: 'stories',
  create_bug: 'bugs',
  update_bug: 'bugs',
  create_comments: 'comments',
  update_comments: 'comments',
  create_iteration: 'iterations',
  update_iteration: 'iterations',
  create_or_update_tcases: 'tcases',
  create_wiki: 'tapd_wikis',
  update_wiki: 'tapd_wikis',
  entity_relations: 'relations',
  update_timesheets: 'timesheets',
  add_timesheets: 'timesheets'
};

export async function tapdRpc(cfg: TapdConfig, tool: string, args: Record<string, unknown>) {
  const workspaceId = String((args.workspace_id as string | undefined) || cfg.tapdWorkspaceId || '');
  const options = { ...(((args.options as Record<string, unknown> | undefined) || {})) };

  if (tool === 'send_qiwei_message') return sendWecomWebhook(cfg, String((args as any).msg || ''));

  if (tool === 'get_user_participant_projects') {
    return tapdApiGet(cfg, getEndpoints[tool], { ...(args as any) });
  }

  if (tool === 'get_workspace_info') return tapdApiGet(cfg, getEndpoints[tool], { workspace_id: workspaceId });

  if (tool === 'get_todo') {
    const entityType = String((args as any).entity_type || 'story');
    const userNick = String((args as any).user_nick || cfg.currentUserNick || '');
    return tapdApiGet(cfg, `users/todo/${userNick}/${entityType}`);
  }

  if (tool === 'get_entity_custom_fields') {
    const entityType = String(options.entity_type || 'stories');
    return tapdApiGet(cfg, `${entityType}/custom_fields_settings`, { workspace_id: workspaceId });
  }

  if (tool === 'get_stories_or_tasks' || tool === 'get_story_or_task_count') {
    const entityType = String(options.entity_type || 'stories');
    delete options.entity_type;
    const path = tool === 'get_story_or_task_count' ? `${entityType}/count` : entityType;
    normalizeEntityIdFields(cfg, workspaceId, options);
    return tapdApiGet(cfg, path, { workspace_id: workspaceId, ...options });
  }

  if (tool === 'get_bug' || tool === 'get_bug_count' || tool === 'get_comments' || tool === 'get_timesheets' || tool === 'get_tcases' || tool === 'get_iterations' || tool === 'get_release_info' || tool === 'get_related_bugs' || tool === 'get_workitem_types' || tool === 'get_commit_msg' || tool === 'get_image' || tool === 'get_workflows_all_transitions' || tool === 'get_workflows_last_steps' || tool === 'get_workflows_status_map') {
    normalizeEntityIdFields(cfg, workspaceId, options);
    return tapdApiGet(cfg, getEndpoints[tool], { workspace_id: workspaceId, ...options });
  }

  if (tool === 'create_story_or_task' || tool === 'update_story_or_task') {
    const entityType = String(options.entity_type || 'stories');
    delete options.entity_type;
    const body = normalizeEntityIdFields(cfg, workspaceId, { workspace_id: workspaceId, name: (args as any).name, ...options });
    if (cfg.currentUserNick) {
      if ('id' in body) body.current_user = cfg.currentUserNick;
      else body.creator = cfg.currentUserNick;
    }
    return tapdApiPost(cfg, entityType, body);
  }

  if (tool === 'create_bug' || tool === 'update_bug') {
    const body = normalizeEntityIdFields(cfg, workspaceId, { workspace_id: workspaceId, ...(('title' in args) ? { title: (args as any).title } : {}), ...options });
    if (cfg.currentUserNick) {
      if ('id' in body) body.current_user = cfg.currentUserNick;
      else body.reporter = cfg.currentUserNick;
    }
    return tapdApiPost(cfg, 'bugs', body);
  }

  if (tool === 'create_comments' || tool === 'update_comments') {
    const body = normalizeEntityIdFields(cfg, workspaceId, { workspace_id: workspaceId, ...options });
    if ('type' in body && !('entry_type' in body)) {
      body.entry_type = body.type;
      delete body.type;
    }
    if (cfg.currentUserNick) {
      if ('id' in body) body.change_creator = cfg.currentUserNick;
      else body.author = cfg.currentUserNick;
    }
    return tapdApiPost(cfg, 'comments', body);
  }

  if (tool === 'create_iteration' || tool === 'update_iteration') {
    const body = { workspace_id: workspaceId, ...options } as Record<string, unknown>;
    if (cfg.currentUserNick) {
      if ('id' in body) body.current_user = cfg.currentUserNick;
      else body.creator = cfg.currentUserNick;
    }
    return tapdApiPost(cfg, 'iterations', body);
  }

  if (tool === 'create_or_update_tcases') {
    const body = { workspace_id: workspaceId, ...options } as Record<string, unknown>;
    if (cfg.currentUserNick) {
      if ('id' in body) body.modifier = cfg.currentUserNick;
      else body.creator = cfg.currentUserNick;
    }
    return tapdApiPost(cfg, 'tcases', body);
  }

  if (tool === 'create_wiki' || tool === 'update_wiki') {
    const body = { workspace_id: workspaceId, ...options } as Record<string, unknown>;
    if (cfg.currentUserNick) {
      if ('id' in body) body.modifier = cfg.currentUserNick;
      else body.creator = cfg.currentUserNick;
    }
    return tapdApiPost(cfg, 'tapd_wikis', body);
  }

  if (tool === 'entity_relations') {
    const body = normalizeEntityIdFields(cfg, workspaceId, { workspace_id: workspaceId, ...options });
    return tapdApiPost(cfg, 'relations', body);
  }

  if (tool === 'add_timesheets' || tool === 'update_timesheets') {
    const body = normalizeEntityIdFields(cfg, workspaceId, { workspace_id: workspaceId, ...options });
    if (cfg.currentUserNick && !('owner' in body)) body.owner = cfg.currentUserNick;
    return tapdApiPost(cfg, 'timesheets', body);
  }

  throw new Error(`Unsupported TAPD tool: ${tool}`);
}

const wecomAccessTokenCache = new Map<string, { token: string; expiresAt: number }>();

function resolveWecomAppBaseUrl(cfg: TapdConfig) {
  return (cfg.wecomAppApiBaseUrl || 'https://qyapi.weixin.qq.com').replace(/\/+$/, '');
}

async function getWecomAppAccessToken(cfg: TapdConfig) {
  if (!cfg.wecomAppCorpId || !cfg.wecomAppCorpSecret) throw new Error('Missing wecomAppCorpId or wecomAppCorpSecret');
  const key = `${cfg.wecomAppCorpId}:${cfg.wecomAppAgentId || 'default'}`;
  const cached = wecomAccessTokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const url = `${resolveWecomAppBaseUrl(cfg)}/cgi-bin/gettoken?corpid=${encodeURIComponent(cfg.wecomAppCorpId)}&corpsecret=${encodeURIComponent(cfg.wecomAppCorpSecret)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.errcode !== undefined && data.errcode !== 0) throw new Error(`gettoken failed: ${data.errmsg || 'unknown'} (errcode=${data.errcode})`);
  if (!data.access_token) throw new Error('gettoken returned empty access_token');
  wecomAccessTokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + 7000 * 1000 });
  return data.access_token;
}

export async function sendWecomAppMarkdownMessage(cfg: TapdConfig, markdown: string, toUser?: string) {
  if (!cfg.wecomAppCorpId || !cfg.wecomAppCorpSecret || !cfg.wecomAppAgentId) {
    throw new Error('wecom-app active sending not configured (need corpId, corpSecret, agentId)');
  }
  const targetUser = (toUser || cfg.wecomAppToUser || '').trim();
  if (!targetUser) throw new Error('Missing wecomAppToUser');
  const token = await getWecomAppAccessToken(cfg);
  const payload = {
    msgtype: 'markdown',
    agentid: Number(cfg.wecomAppAgentId),
    markdown: { content: markdown },
    touser: targetUser,
  };
  const resp = await fetch(`${resolveWecomAppBaseUrl(cfg)}/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  return {
    ok: data.errcode === 0,
    errcode: data.errcode,
    errmsg: data.errmsg,
    invaliduser: data.invaliduser,
    invalidparty: data.invalidparty,
    invalidtag: data.invalidtag,
    msgid: data.msgid,
    payload,
  };
}

export async function sendWecomWebhook(cfg: TapdConfig, text: string) {
  const preferred = cfg.wecomPreferredChannel || 'auto';
  const hasApp = Boolean(cfg.wecomAppCorpId && cfg.wecomAppCorpSecret && cfg.wecomAppAgentId);
  const hasWebhook = Boolean(cfg.wecomWebhook);

  if (preferred === 'app') {
    if (!hasApp) throw new Error('wecomPreferredChannel=app but app sending is not fully configured');
    return sendWecomAppMarkdownMessage(cfg, text);
  }

  if (preferred === 'webhook') {
    if (!hasWebhook) throw new Error('wecomPreferredChannel=webhook but wecomWebhook is missing');
  } else if (!hasWebhook && hasApp) {
    return sendWecomAppMarkdownMessage(cfg, text);
  }

  const webhook = String(cfg.wecomWebhook || '').trim();
  if (!webhook) throw new Error('Missing wecomWebhook');
  const payload = text.includes('@')
    ? { msgtype: 'markdown', markdown: { content: text } }
    : { msgtype: 'markdown_v2', markdown_v2: { content: text } };
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`WeCom webhook failed: ${res.status} ${body}`);
  try { return JSON.parse(body); } catch { return { raw: body }; }
}
