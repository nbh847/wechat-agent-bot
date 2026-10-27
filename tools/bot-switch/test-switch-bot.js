'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { descendants, nodeBridge, selectBridge, matchesAgent, parseArgs, codexConfig, validateSelection, codexModels } = require('./switch-bot');
const cli = '/repo/runtime-data/vendor/wechat-acp/dist/bin/wechat-acp.js';
const bot = { pid: 10, ppid: 1, created: 'a', cmd: `/usr/local/bin/node ${cli} --agent claude --cwd /repo` };
test('recognizes the fixed bridge but not unrelated node processes', () => {
  assert.equal(nodeBridge(bot), true);
  assert.equal(nodeBridge({ cmd: '/usr/local/bin/node /repo/switch-bot.js claude' }), false);
});
test('tracks all descendants, including grandchildren', () => {
  const list = [bot, {pid: 11, ppid: 10}, {pid: 12, ppid: 11}, {pid: 13, ppid: 1}];
  assert.deepEqual(descendants(list, 10).map(p => p.pid), [10, 11, 12]);
});
test('accepts only a unique matching bridge with matching PID and project', () => {
  assert.equal(selectBridge([bot], 10, cli, '/repo'), bot);
  assert.equal(selectBridge([], null, cli, '/repo'), null);
  assert.throws(() => selectBridge([bot], null, cli, '/repo'));
  assert.throws(() => selectBridge([], 10, cli, '/repo'));
  assert.throws(() => selectBridge([bot], 10, cli, '/other'));
  assert.throws(() => selectBridge([bot, {...bot, pid: 20}], 10, cli, '/repo'));
  assert.throws(() => selectBridge([{...bot, cmd: 'node unrelated'}], 10, cli, '/repo'));
});
test('recognizes Windows node bridge commands', () => {
  assert.equal(nodeBridge({cmd: '"C:\\Program Files\\nodejs\\node.exe" D:\\repo\\runtime-data\\codex-acp\\node_modules\\wechat-acp\\dist\\bin\\wechat-acp.js --cwd D:\\repo'}), true);
});
test('recognizes the requested agent and rejects a different one', () => {
  assert.equal(matchesAgent(bot.cmd, 'claude'), true);
  assert.equal(matchesAgent(bot.cmd, 'codex'), false);
  assert.equal(matchesAgent('node bridge --agent "codebuddy --acp"', 'codebuddy'), true);
  assert.equal(matchesAgent('node bridge --agent codex --config /repo/codex-config.json', 'codex'), true);
});
test('accepts optional Codex model and effort and rejects malformed or irrelevant options', () => {
  assert.deepEqual(parseArgs(['codex']), { agent: 'codex', model: undefined, effort: undefined });
  assert.deepEqual(parseArgs(['codex', '--model', 'gpt-6-luna', '--effort', 'max']), { agent: 'codex', model: 'gpt-6-luna', effort: 'max' });
  for (const input of [['claude', '--model', 'x'], ['codebuddy', '--effort', 'high'], ['codex', '--model'], ['codex', '--effort', 'unknown'], ['codex', '--model', 'a b'], ['codex', '--model', 'a', '--model', 'b'], ['codex', '--unknown', 'x']]) {
    assert.throws(() => parseArgs(input));
  }
});
test('validates model-specific efforts from the local catalog', () => {
  assert.equal(Object.keys(codexModels).length, 8);
  for (const [model, efforts] of Object.entries(codexModels)) for (const effort of efforts) assert.doesNotThrow(() => validateSelection(model, effort));
  assert.doesNotThrow(() => parseArgs(['codex', '--model', 'gpt-6.1-terra', '--effort', 'ultra']));
  assert.throws(() => parseArgs(['codex', '--model', 'gpt-6-luna', '--effort', 'ultra']));
  assert.throws(() => parseArgs(['codex', '--model', 'unknown-model', '--effort', 'medium']));
  assert.throws(() => validateSelection('gpt-6-luna', 'ultra'));
});
test('changes only requested Codex settings without changing the source configuration', () => {
  const original = {agents: {codex: {command: 'node', args: ['adapter'], env: {CODEX_CONFIG: '{"model":"default","model_reasoning_effort":"max","other":true}', INITIAL_AGENT_MODE: 'workspace-write'}}}};
  const modified = codexConfig(original, {model: 'gpt-6-luna', effort: 'high'});
  assert.deepEqual(JSON.parse(modified.agents.codex.env.CODEX_CONFIG), {model: 'gpt-6-luna', model_reasoning_effort: 'high', other: true});
  assert.equal(JSON.parse(original.agents.codex.env.CODEX_CONFIG).model, 'default');
  assert.equal(JSON.parse(codexConfig(original, {model: 'other'}).agents.codex.env.CODEX_CONFIG).model_reasoning_effort, 'max');
  assert.equal(JSON.parse(codexConfig(original, {effort: 'low'}).agents.codex.env.CODEX_CONFIG).model, 'default');
  assert.throws(() => codexConfig({}, {model: 'x'}));
});
test('macOS startup preflight accepts model overrides and rejects unrelated changes without starting a Bot', () => {
  const root = path.resolve(__dirname, '../..');
  const parent = path.join(root, '.tmp', 'bot-switch-config');
  fs.mkdirSync(parent, {recursive: true});
  const temp = fs.mkdtempSync(path.join(parent, 'test-'));
  try {
    const base = JSON.parse(fs.readFileSync(path.join(root, 'scripts/wechat-acp/codex-config.json'), 'utf8'));
    const configFile = path.join(temp, 'config.json');
    const script = `import sys,subprocess\nfrom pathlib import Path\nfrom unittest.mock import patch\nroot=Path(sys.argv[1]); config=sys.argv[2]\nmanifest=__import__('json').loads((root/'scripts/wechat-acp/build-manifest.json').read_text())\ncode=(root/'scripts/wechat-acp/start-codex-daemon.sh').read_text().split("<<'PY'\\n",1)[1].split('\\nPY',1)[0]\noriginal=Path.is_file\ndef is_file(p):\n return True if p.name=='token.json' else original(p)\ndef output(args,**kwargs):\n return manifest['upstreamCommit'] if 'git' in args[0] else ''\nsys.argv=['test',str(root),config]\nwith patch.object(Path,'is_file',is_file), patch.object(subprocess,'check_output',output):\n exec(compile(code,'preflight','exec'))\n`;
    const check = () => cp.spawnSync('python3', ['-c', script, root, configFile], {encoding: 'utf8'});
    const good = codexConfig(base, {model: 'gpt-6-luna', effort: 'high'});
    fs.writeFileSync(configFile, JSON.stringify(good));
    assert.equal(check().status, 0);
    good.agents.codex.env.INITIAL_AGENT_MODE = 'danger-full-access';
    fs.writeFileSync(configFile, JSON.stringify(good));
    const rejected = check();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Unexpected Codex config changes/);
  } finally { fs.rmSync(temp, {recursive: true}); }
});
