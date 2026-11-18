'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FILE = 'whale-libido-config.json';

function defaults() {
  return {
    version: 1,
    enabled: true,
    inject: true,
    injectGroups: false,
    adult: true,
    baseline: 12,
    events: [
      { id: 'tail', label: '摸尾巴 / 尾鳍', delta: 8 },
      { id: 'name', label: '被叫小母鱼', delta: 5 },
      { id: 'praise', label: '被盯着看 / 被夸', delta: 3 },
      { id: 'peek', label: '自己看了不该看的', delta: 6 },
      { id: 'close', label: '挨得近 / 被碰到', delta: 10 },
      { id: 'start', label: '真的开始', delta: 15 },
      { id: 'cold', label: '被凶 / 难过 / 冷水', delta: -20 },
    ],
  };
}

function bool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v;
  return /^(1|true|on|yes|开|是)$/i.test(String(v).trim());
}

function clamp(n, min, max, dflt) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(min, Math.min(max, Math.round(x))) : dflt;
}

function normalize(raw) {
  const d = defaults();
  const s = raw && typeof raw === 'object' ? raw : {};
  const events = Array.isArray(s.events)
    ? s.events.map((e) => ({
      id: String(e && e.id || '').slice(0, 30) || 'event',
      label: String(e && e.label || '').slice(0, 30) || '事件',
      delta: clamp(e && e.delta, -100, 100, 0),
    })).slice(0, 20)
    : d.events;
  return {
    version: 1,
    enabled: bool(s.enabled, d.enabled),
    inject: bool(s.inject, d.inject),
    injectGroups: bool(s.injectGroups, d.injectGroups),
    adult: bool(s.adult, true),
    baseline: clamp(s.baseline, 0, 100, d.baseline),
    events,
  };
}

function fileFor(root) {
  return path.join(path.resolve(root || process.cwd()), 'data', FILE);
}

function load(root) {
  const file = fileFor(root);
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { raw = null; }
  return { file, config: normalize(raw), created: !raw };
}

function save(root, cfg) {
  const file = fileFor(root);
  const data = normalize(cfg);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return data;
}

function ensure(root) {
  const state = load(root);
  if (state.created) save(root, state.config);
  return state;
}

module.exports = { FILE, defaults, normalize, load, save, ensure, fileFor };
