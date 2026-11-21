'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../patch/state');
const config = require('../patch/config');

const at = (s) => Date.parse(s);

test('初始状态 18 是平静', () => {
  const data = engine.normalize({ value: 18, updatedAt: '2026-11-17T18:00:00+08:00', events: [], samples: [] });
  const state = engine.buildState(data, at('2026-11-17T18:00:00+08:00'));
  assert.equal(state.current, 18);
  assert.equal(state.tier, '平静');
});

test('醒着每两小时 +1', () => {
  const from = at('2026-11-17T08:00:00+08:00');
  const to = at('2026-11-17T10:00:00+08:00');
  assert.equal(engine.valueAt(18, from, to), 19);
});

test('跨夜睡一觉砍半且不低于 10', () => {
  const from = at('2026-11-17T23:00:00+08:00');
  const to = at('2026-11-18T09:00:00+08:00');
  assert.equal(engine.valueAt(50, from, to), 25);
  assert.equal(engine.valueAt(16, from, to), 10);
});

test('每月 18–20 日发情期，档位门槛降低', () => {
  const d = at('2026-11-18T10:00:00+08:00');
  const season = engine.seasonAt(d);
  assert.equal(season.active, true);
  assert.equal(season.day, 1);
  assert.equal(engine.tierFor(40, season), '难耐');
  assert.equal(engine.tierFor(40, { active: false, daysUntil: 10 }), '有点想');
});

test('事件加减和解决归 10', () => {
  const now = at('2026-11-17T20:00:00+08:00');
  let data = engine.normalize({ value: 18, updatedAt: new Date(now).toISOString(), events: [], samples: [] });
  data = engine.applyEvent(data, 8, '摸尾巴', now);
  assert.equal(engine.buildState(data, now).current, 26);
  data = engine.applyEvent(data, 0, '', now, 'done');
  assert.equal(engine.buildState(data, now).current, 10);
});

test('配置只接受有限范围和事件列表', () => {
  const c = config.normalize({ enabled: 'false', baseline: 999, events: [{ id: 'x', label: '测试', delta: 999 }] });
  assert.equal(c.enabled, false);
  assert.equal(c.baseline, 100);
  assert.equal(c.events[0].delta, 100);
});

test('提示词包含状态但不要求播报数值', () => {
  const data = engine.normalize({ value: 75, updatedAt: new Date().toISOString(), events: [], samples: [] });
  const block = engine.promptBlock(engine.buildState(data));
  assert.match(block, /75\/100/);
  assert.match(block, /快撑不住/);
  assert.match(block, /成年/);
});
