import fs from 'node:fs';
import plugin from './index.ts';

const all = JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json','utf8'));
const cfg = all.plugins.entries['tapd-wecom'].config;

const tools = new Map();
const api = {
  getConfig() { return cfg; },
  registerTool(factory, meta) {
    const tool = factory();
    tools.set(meta?.name || tool.name, tool);
  }
};

plugin.register(api);

const tool = tools.get('create_story_or_task');
if (!tool) throw new Error('create_story_or_task not registered');

const params = {
  workspace_id: String(cfg.tapdWorkspaceId),
  name: `OpenClaw 随机联调测试 ${new Date().toISOString().replace('T',' ').slice(0,16)} UTC`,
  options: {
    entity_type: 'stories',
    description: '由 OpenClaw 自动创建，用于测试 tapd-wecom webhook 创建后企微通知链路。可删除。'
  }
};

const res = await tool.execute('manual-test', params);
console.log(JSON.stringify(res, null, 2));
