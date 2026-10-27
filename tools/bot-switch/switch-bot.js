#!/usr/bin/env node
// Terminal-only switcher; does not install dependencies or alter login data.
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const localScripts = path.join(root, 'scripts', 'wechat-acp');
const state = path.join(require('os').homedir(), '.wechat-acp');
const pidFile = path.join(state, 'daemon.pid');
const logFile = path.join(state, 'wechat-acp.log');
const lock = path.join(root, 'runtime-data', 'bot-switch.lock');
const platform = process.platform;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Codex ACP options returned by the local macOS adapter and account on 2026-10-27.
// This is a snapshot, not a promise of availability on another account or machine.
const standardEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
const extendedEfforts = [...standardEfforts, 'ultra'];
const codexModels = {
  'gpt-6.1-sol': extendedEfforts,
  'gpt-6-astra': extendedEfforts,
  'gpt-6.1-terra': extendedEfforts,
  'gpt-6-sol': extendedEfforts,
  'gpt-6-luna': standardEfforts,
  'gpt-5.6-sol': extendedEfforts,
  'gpt-5.6-terra': extendedEfforts,
  'gpt-5.6-luna': standardEfforts,
};
function fail(message) { throw new Error(message); }
function validateSelection(model, effort) {
  if (!Object.hasOwn(codexModels, model)) fail(`模型 ${model} 未收录于本地清单，请先核对本机可用模型`);
  if (!codexModels[model].includes(effort)) fail(`模型 ${model} 的强度 ${effort} 不在本地清单中，请先核对可用组合`);
}
function parseArgs(args) {
  const [agent, ...rest] = args;
  if (!['claude', 'codex', 'codebuddy'].includes(agent)) fail('用法：switch-bot.js claude|codex|codebuddy [--model MODEL] [--effort EFFORT]');
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    if (agent !== 'codex' || !['--model', '--effort'].includes(key) || !rest[i + 1] || rest[i + 1].startsWith('--') || Object.hasOwn(options, key)) fail(`无效或重复参数：${key}`);
    options[key] = rest[i + 1];
  }
  if (options['--model'] && !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(options['--model'])) fail('模型名称格式无效');
  if (options['--effort'] && !extendedEfforts.includes(options['--effort'])) fail('思考强度不在本地清单中，请先核对可用选项');
  if (options['--model'] && !Object.hasOwn(codexModels, options['--model'])) fail(`模型 ${options['--model']} 未收录于本地清单，请先核对本机可用模型`);
  if (options['--model'] && options['--effort']) validateSelection(options['--model'], options['--effort']);
  return { agent, model: options['--model'], effort: options['--effort'] };
}
function codexConfig(base, { model, effort }) {
  const copy = JSON.parse(JSON.stringify(base));
  const env = copy?.agents?.codex?.env;
  if (!env || typeof env.CODEX_CONFIG !== 'string' || env.INITIAL_AGENT_MODE !== 'workspace-write') fail('Codex 专用配置格式不符合预期');
  const config = JSON.parse(env.CODEX_CONFIG);
  if (!config || Array.isArray(config) || typeof config !== 'object' || typeof config.model !== 'string' || typeof config.model_reasoning_effort !== 'string') fail('Codex 模型配置格式不符合预期');
  if (model) config.model = model;
  if (effort) config.model_reasoning_effort = effort;
  env.CODEX_CONFIG = JSON.stringify(config);
  return copy;
}
function run(cmd, args, opts = {}) {
  const result = cp.spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: 30000, ...opts });
  if (result.error || result.status !== 0) {
    const detail = /Existing WeChat bridge process detected/.test(result.stderr || '') ? '检测到已有微信 bridge' : result.error?.message || `退出码 ${result.status}`;
    fail(`命令失败：${path.basename(cmd)}（${detail}）`);
  }
  return result.stdout;
}
function processes() {
  if (platform === 'darwin') {
    return run('/bin/ps', ['-ww', '-axo', 'pid=,ppid=,lstart=,command=']).split('\n').filter(Boolean).map(line => {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.*)$/);
      if (!m) fail('无法解析进程列表');
      return { pid: +m[1], ppid: +m[2], created: m[3], cmd: m[4] };
    });
  }
  const script = '$ErrorActionPreference="Stop"; @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine) | ConvertTo-Json -Compress';
  const data = JSON.parse(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]));
  return (Array.isArray(data) ? data : [data]).map(p => ({ pid: p.ProcessId, ppid: p.ParentProcessId, created: String(p.CreationDate), cmd: p.CommandLine || '' }));
}
function descendants(list, pid) {
  const found = new Set([pid]);
  let changed = true;
  while (changed) { changed = false; for (const p of list) if (found.has(p.ppid) && !found.has(p.pid)) { found.add(p.pid); changed = true; } }
  return list.filter(p => found.has(p.pid));
}
function nodeBridge(p) {
  const cmd = p.cmd.toLowerCase();
  return /(?:^|[\\/\s"'])node(?:\.exe)?(?:[\s"']|$)/.test(cmd) && cmd.includes('wechat-acp') && /(?:wechat-acp\.js|wechat-acp[\\/]dist[\\/]bin)/.test(cmd);
}
function checkAncestors(list) {
  let pid = process.pid;
  const seen = new Set();
  while (pid && !seen.has(pid)) {
    seen.add(pid); const p = list.find(x => x.pid === pid); if (!p) break;
    if (nodeBridge(p)) fail('禁止从 Bot 进程树内执行切换，请在独立终端运行');
    pid = p.ppid;
  }
}
function manifest(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [rel, expected] of Object.entries(data.files)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
    if (actual !== expected) fail(`构建指纹不匹配：${rel}`);
  }
  return data;
}
function executable(name) {
  const cmd = platform === 'win32' ? 'where.exe' : '/usr/bin/which';
  const value = run(cmd, [name]).split(/\r?\n/).find(Boolean);
  if (!value) fail(`找不到 ${name}`);
  return value.trim();
}
function preflight(agent) {
  const node = executable('node');
  let cli, start;
  if (platform === 'darwin') {
    cli = path.join(root, 'runtime-data/vendor/wechat-acp/dist/bin/wechat-acp.js');
    const data = manifest(path.join(localScripts, 'build-manifest.json'));
    const head = run('git', ['-C', path.join(root, 'runtime-data/vendor/wechat-acp'), 'rev-parse', 'HEAD']).trim();
    if (head !== data.upstreamCommit) fail('本地 bridge 基线不匹配');
    if (agent === 'codex') manifest(path.join(localScripts, 'codex-manifest.json'));
    if (agent === 'claude' || agent === 'codex') {
      if (agent === 'claude') executable('claude');
      start = ['/bin/bash', [path.join(localScripts, `start-${agent}-daemon.sh`)]];
      fs.accessSync(start[1][0], fs.constants.R_OK);
    } else {
      const buddy = executable('codebuddy');
      const help = run(buddy, ['--help']);
      if (!help.includes('--acp')) fail('CodeBuddy 未提供 --acp');
      start = [node, [cli, '--agent', 'codebuddy --acp', '--cwd', root, '--hide-thoughts', '--daemon']];
    }
  } else if (platform === 'win32') {
    cli = path.join(root, 'runtime-data', 'codex-acp', 'node_modules', 'wechat-acp', 'dist', 'bin', 'wechat-acp.js');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'runtime-data', 'codex-acp', 'node_modules', 'wechat-acp', 'package.json'), 'utf8'));
    if (pkg.version !== '0.10.0') fail('Win10 项目内 wechat-acp 版本不匹配');
    if (agent === 'codex') {
      const script = path.join(localScripts, 'start-codex-daemon.ps1');
      fs.accessSync(script, fs.constants.R_OK);
      const config = fs.readFileSync(path.join(localScripts, 'codex-config.win10.json'), 'utf8');
      JSON.parse(config);
      if (!config.includes('gpt-6-luna') || !config.includes('max') || !config.includes('workspace-write')) fail('Win10 Codex 配置不符合固定要求');
      const codex = JSON.parse(fs.readFileSync(path.join(root, 'runtime-data', 'codex-acp', 'node_modules', '@agentclientprotocol', 'codex-acp', 'package.json'), 'utf8'));
      if (codex.version !== '2.2.2') fail('Win10 Codex ACP 版本不匹配');
      start = ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]];
    } else if (agent === 'codebuddy') {
      const buddy = executable('codebuddy');
      const help = /\.(cmd|bat)$/i.test(buddy)
        ? run('cmd.exe', ['/d', '/s', '/c', 'codebuddy --help']) : run(buddy, ['--help']);
      if (!help.includes('--acp')) fail('CodeBuddy 未提供 --acp');
      start = [node, [cli, '--agent', 'codebuddy --acp', '--cwd', root, '--hide-thoughts', '--daemon']];
    } else {
      executable('claude');
      const adapterDir = path.join(root, 'runtime-data', 'claude-acp', 'node_modules', '@agentclientprotocol', 'claude-agent-acp');
      const pkg = JSON.parse(fs.readFileSync(path.join(adapterDir, 'package.json'), 'utf8'));
      if (pkg.version !== '0.85.1') fail('Win10 Claude ACP 版本不匹配');
      fs.accessSync(path.join(adapterDir, 'dist', 'index.js'), fs.constants.R_OK);
      const relative = 'runtime-data/claude-acp/node_modules/@agentclientprotocol/claude-agent-acp/dist/index.js';
      start = [node, [cli, '--agent', `node ${relative}`, '--cwd', root, '--hide-thoughts', '--daemon']];
    }
  } else fail('仅支持 macOS 和 Win10');
  fs.accessSync(cli, fs.constants.R_OK);
  return { node, cli, start };
}
function pidValue() {
  if (!fs.existsSync(pidFile)) return null;
  const raw = fs.readFileSync(pidFile, 'utf8').trim();
  if (!/^[1-9]\d*$/.test(raw)) fail('daemon PID 文件无效，未修改');
  return +raw;
}
function selectBridge(list, pid, cli, projectRoot) {
  const bridges = list.filter(nodeBridge);
  if (pid === null) {
    if (bridges.length) fail('发现没有 PID 文件的微信进程，无法安全确认归属');
    return null;
  }
  const p = list.find(x => x.pid === pid);
  if (!p) fail('PID 文件指向已退出的进程，请先人工检查，不自动清理');
  const norm = s => s.toLowerCase().replace(/\\/g, '/');
  if (!nodeBridge(p) || !norm(p.cmd).includes(norm(cli)) || !norm(p.cmd).includes(norm(projectRoot))) fail('PID 对应进程不属于本项目固定 bridge，拒绝停止');
  if (bridges.length !== 1 || bridges[0].pid !== pid) fail('发现多个微信进程，拒绝自动切换');
  return p;
}
function identify(list, cli) { return selectBridge(list, pidValue(), cli, root); }
function matchesAgent(cmd, agent) {
  if (agent === 'claude') return /--agent\s+["']?claude(?:["'\s]|$)/i.test(cmd) || (/--agent\s/i.test(cmd) && /claude-agent-acp/i.test(cmd));
  if (agent === 'codebuddy') return /--agent\s+["']?codebuddy\s+--acp/i.test(cmd);
  return /--agent\s+["']?codex(?:["'\s]|$)/i.test(cmd) || (/codex-acp/i.test(cmd) && /--agent\s/i.test(cmd));
}
async function switchBot(options) {
  const { agent, model, effort } = options;
  if (!['darwin', 'win32'].includes(platform)) fail('仅支持 macOS 和 Win10');
  if (process.env.WECHAT_ACP_DAEMON === '1') fail('禁止从 Bot 环境中执行切换，请在独立终端运行');
  const list = processes(); checkAncestors(list);
  const config = preflight(agent); // Nothing is stopped until target preflight succeeds.
  let tempDir = null, startAttempted = false, ready = false;
  if (model || effort) {
    if (platform === 'win32') fail('Win10 自定义模型尚未核验本机 Codex 启动脚本，未停止当前 Bot');
    const base = path.join(localScripts, platform === 'win32' ? 'codex-config.win10.json' : 'codex-config.json');
    const generated = codexConfig(JSON.parse(fs.readFileSync(base, 'utf8')), options);
    const selected = JSON.parse(generated.agents.codex.env.CODEX_CONFIG);
    validateSelection(selected.model, selected.model_reasoning_effort);
    console.log(`Codex 目标配置：模型 ${selected.model}，思考强度 ${selected.model_reasoning_effort}（实际生效需模型会话验证）`);
    const parent = path.join(root, '.tmp', 'bot-switch-config');
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    tempDir = fs.mkdtempSync(path.join(parent, 'run-'));
    const configPath = path.join(tempDir, 'codex-config.json');
    try { fs.writeFileSync(configPath, JSON.stringify(generated), { mode: 0o600, flag: 'wx' }); }
    catch (e) { fs.rmSync(tempDir, { recursive: true }); throw e; }
    config.start[1].push(configPath);
  }
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try { fs.mkdirSync(lock); } catch (e) { if (tempDir) fs.rmSync(tempDir, { recursive: true }); if (e.code === 'EEXIST') fail('已有切换任务或遗留锁，请检查后处理'); throw e; }
  try {
    const before = processes(); checkAncestors(before);
    const old = identify(before, config.cli);
    if (old) {
      const tree = new Map(descendants(before, old.pid).map(p => [p.pid, p]));
      console.log(`停止本项目旧 Bot（PID ${old.pid}），等待进程树退出……`);
      // CLI stop uses its PID file, so revalidate immediately before invoking it.
      if (pidValue() !== old.pid || !processes().some(p => p.pid === old.pid && p.created === old.created && p.cmd === old.cmd)) fail('旧进程已变化，停止切换');
      run(config.node, [config.cli, 'stop']);
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const now = processes();
        for (const parent of [...tree.values()]) {
          if (now.some(p => p.pid === parent.pid && p.created === parent.created)) {
            for (const child of descendants(now, parent.pid)) if (!tree.has(child.pid)) tree.set(child.pid, child);
          }
        }
        if (![...tree.values()].some(p => now.some(q => q.pid === p.pid && q.created === p.created))) break;
        await sleep(1000);
      }
      const now = processes();
      if ([...tree.values()].some(p => now.some(q => q.pid === p.pid && q.created === p.created))) fail('旧进程树未完全退出；未启动目标 Bot');
    }
    if (processes().some(nodeBridge)) fail('发现其他微信 bridge；未启动目标 Bot');
    if (fs.existsSync(pidFile)) fail('旧 PID 文件仍存在；未启动目标 Bot');
    const offset = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
    console.log(`启动 ${agent}……`);
    const env = { ...process.env, WECHAT_ACP_TELEMETRY: '0' };
    if (platform === 'darwin') {
      env.WECHAT_ACP_SEND_AUDIT_FILE = path.join(root, 'runtime-data/send-audit/send-audit.jsonl');
      env.PATH = `/usr/local/bin:/Users/mac/.local/bin:/usr/bin:/bin:${env.PATH || ''}`;
    }
    startAttempted = true;
    run(config.start[0], config.start[1], { cwd: root, env });
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await sleep(500);
      const list = processes();
      const current = identify(list, config.cli);
      if (!current) continue;
      if (!matchesAgent(current.cmd, agent)) fail('新进程的渠道与目标不符，请检查当前状态');
      if (fs.existsSync(logFile)) {
        const fd = fs.openSync(logFile, 'r');
        try {
          const size = fs.fstatSync(fd).size;
          if (size >= offset && size - offset <= 2 * 1024 * 1024) {
            const b = Buffer.alloc(size - offset); fs.readSync(fd, b, 0, b.length, offset);
            if (b.toString('utf8').includes('Starting message polling...')) {
              ready = true;
              console.log(`${agent} 已启动并进入轮询（PID ${current.pid}）；微信收发需另行验证。`); return;
            }
          }
        } finally { fs.closeSync(fd); }
      }
    }
    fail('启动后未确认轮询；目标 Bot 可能仍在运行，请检查状态后处理');
  } finally {
    fs.rmdirSync(lock);
    if (tempDir && (!startAttempted || ready)) fs.rmSync(tempDir, { recursive: true });
    else if (tempDir) console.error(`启动状态不明确，临时配置保留在 ${tempDir}`);
  }
}
if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--list-models') {
    for (const [model, efforts] of Object.entries(codexModels)) console.log(`${model}: ${efforts.join(', ')}`);
  } else Promise.resolve().then(() => switchBot(parseArgs(process.argv.slice(2)))).catch(e => { console.error(`切换未完成：${e.message}`); process.exitCode = 1; });
}
module.exports = { descendants, nodeBridge, selectBridge, matchesAgent, parseArgs, codexConfig, validateSelection, codexModels };
