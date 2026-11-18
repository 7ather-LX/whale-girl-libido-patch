'use strict';

/**
 * 生理状态引擎（独立实现，不复制上游代码；灵感来自 amtoki520/dsh-libido-panel）。
 * 0–100 的性欲值，随时间/睡眠/事件变化；每月 18–20 日发情期。
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LOCAL_OFFSET = 8 * HOUR;
const TIERS = ['平静', '有点想', '难耐', '快撑不住', '发情'];
const NORMAL_LIMITS = [20, 45, 70, 89, 100];
const SEASON_LIMITS = [5, 30, 55, 74, 100];
const SAMPLE_EVERY = 30 * 60 * 1000;
const SAMPLE_KEEP = 300;
const EVENT_KEEP = 200;

function clamp(n) {
  return Math.max(0, Math.min(100, Number(n) || 0));
}

function localDay(ms) {
  return Math.floor((ms + LOCAL_OFFSET) / DAY) * DAY;
}

function seasonBounds(ms) {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  return {
    start: Date.UTC(year, month, 18) - LOCAL_OFFSET,
    end: Date.UTC(year, month, 21) - 1 - LOCAL_OFFSET,
    nextStart: Date.UTC(year, month + 1, 18) - LOCAL_OFFSET,
  };
}

function seasonAt(now) {
  const b = seasonBounds(now);
  if (now >= b.start && now <= b.end) {
    return { active: true, day: Math.floor((now - b.start) / DAY) + 1 };
  }
  const next = now < b.start ? b.start : b.nextStart;
  return { active: false, daysUntil: Math.max(0, Math.ceil((next - now) / DAY)) };
}

function isSeasonDay(dayStart) {
  const s = seasonAt(dayStart + 12 * HOUR);
  return s.active;
}

/** 从上次更新到现在，按“醒着每 2 小时 +1，跨夜睡一觉砍半”计算。 */
function valueAt(value, from, to) {
  if (!Number.isFinite(value) || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return clamp(value);
  const start = from + LOCAL_OFFSET;
  const end = to + LOCAL_OFFSET;
  const firstMidnight = Math.ceil(start / DAY) * DAY;
  if (end >= firstMidnight + 8 * HOUR) return Math.max(10, Math.ceil(value / 2));

  let weighted = 0;
  for (let day = Math.floor(start / DAY) * DAY; day < end; day += DAY) {
    const awakeStart = Math.max(start, day + 8 * HOUR);
    const awakeEnd = Math.min(end, day + DAY);
    const speed = isSeasonDay(day) ? 2 : 1;
    weighted += Math.max(0, awakeEnd - awakeStart) * speed;
  }
  return clamp(value + Math.floor(weighted / (2 * HOUR)));
}

function tierFor(value, season) {
  const limits = season.active ? SEASON_LIMITS : NORMAL_LIMITS;
  const index = limits.findIndex((limit) => value <= limit);
  return TIERS[index < 0 ? TIERS.length - 1 : index];
}

function historyPoints(current, data, now) {
  const anchors = [{ time: Date.parse(data.updatedAt), value: Number(data.value) }];
  for (const sample of data.samples || []) {
    const time = Date.parse(sample && sample.at);
    const value = Number(sample && sample.value);
    if (Number.isFinite(time) && Number.isFinite(value)) anchors.push({ time, value });
  }
  anchors.sort((a, b) => a.time - b.time);
  return Array.from({ length: 73 }, (_, index) => {
    const time = now - (72 - index) * HOUR;
    if (time >= now) return { at: new Date(time).toISOString(), value: current };
    let anchor = null;
    for (const entry of anchors) {
      if (entry.time <= time) anchor = entry;
      else break;
    }
    const value = anchor ? valueAt(anchor.value, anchor.time, time) : null;
    return { at: new Date(time).toISOString(), value };
  });
}

function normalize(raw, now = Date.now()) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const baseline = clamp(src.baseline == null ? 12 : src.baseline);
  const value = clamp(src.value == null ? 18 : src.value);
  const updatedAt = Number.isFinite(Date.parse(src.updatedAt)) ? src.updatedAt : new Date(now).toISOString();
  const events = Array.isArray(src.events)
    ? src.events.filter((e) => e && Number.isFinite(Number(e.delta))).slice(0, EVENT_KEEP)
    : [];
  const samples = Array.isArray(src.samples)
    ? src.samples.filter((s) => Number.isFinite(Date.parse(s && s.at)) && Number.isFinite(Number(s && s.value))).slice(-SAMPLE_KEEP)
    : [];
  return {
    version: 1,
    baseline,
    value,
    updatedAt,
    events,
    samples,
    checkIn: src.checkIn && typeof src.checkIn === 'object' ? src.checkIn : null,
  };
}

function buildState(data, now = Date.now()) {
  const d = normalize(data, now);
  const from = Date.parse(d.updatedAt);
  const current = valueAt(d.value, from, now);
  const season = seasonAt(now);
  return {
    current,
    tier: tierFor(current, season),
    season,
    activeNote: season.active && current >= 90 ? '会主动开口' : '',
    asOf: new Date(now).toISOString(),
    baseline: d.baseline,
    history: historyPoints(current, d, now),
    events: (d.events || []).slice(0, 8).map((e) => ({ at: e.at, delta: Number(e.delta), note: String(e.note || '') })),
    checkIn: d.checkIn,
  };
}

function sampleIfDue(data, now = Date.now()) {
  const d = normalize(data, now);
  const latest = (d.samples || []).reduce((max, s) => Math.max(max, Date.parse(s.at) || 0), 0);
  if (now - latest < SAMPLE_EVERY) return data;
  const state = buildState(d, now);
  d.samples.push({ at: new Date(now).toISOString(), value: Math.round(state.current) });
  d.samples = d.samples.filter((s) => Date.parse(s.at) >= now - 72 * HOUR).slice(-SAMPLE_KEEP);
  return d;
}

function applyEvent(data, delta, note, now = Date.now(), kind = 'event') {
  const d = normalize(data, now);
  const state = buildState(d, now);
  const before = state.current;
  let after;
  if (kind === 'sleep') after = Math.max(10, Math.ceil(before / 2));
  else if (kind === 'done') after = 10;
  else after = clamp(before + (Number(delta) || 0));
  after = Math.round(after);
  d.value = after;
  d.updatedAt = new Date(now).toISOString();
  d.events.unshift({ at: d.updatedAt, delta: after - Math.round(before), note: String(note || '').slice(0, 80) });
  d.events = d.events.slice(0, EVENT_KEEP);
  d.samples.push({ at: d.updatedAt, value: after });
  d.samples = d.samples.slice(-SAMPLE_KEEP);
  return d;
}

function promptBlock(state, options = {}) {
  if (!state) return '';
  const s = state.season || seasonAt(Date.now());
  const when = s.active ? `发情期第 ${s.day} 天` : `距下次发情期 ${s.daysUntil} 天`;
  const behavior = {
    平静: '语气正常，不主动提这件事；被问到可以轻轻带过。',
    有点想: '会偶尔走神、黏人，但不主动挑明。',
    难耐: '明显更容易被撩动，嘴上可能不承认，行动上会靠近。',
    快撑不住: '克制感很强，容易害羞或嘴硬，注意力被这件事占用。',
    发情: '状态很高；如果场合合适，会主动开口或靠近，但不粗俗。',
  }[state.tier] || '';
  const activeLine = s.active && state.current >= 90 ? '发情期且数值 90+：会自己开口，不等对方问。' : '';
  return [
    '【角色的生理状态（仅用于语气与主动性，不要向对方播报数值）】',
    `性欲值：${state.current}/100（${state.tier}）；${when}。`,
    behavior,
    activeLine,
    '这是成年角色之间的私密设定；不涉及未成年、非自愿、暴力或违法内容。',
    '不要直接说“我的性欲值是 X”；用角色自己的语气体现状态。',
    options.extra || '',
  ].filter(Boolean).join('\n');
}

module.exports = {
  HOUR, DAY, TIERS, NORMAL_LIMITS, SEASON_LIMITS, SAMPLE_EVERY, SAMPLE_KEEP, EVENT_KEEP,
  clamp, seasonAt, valueAt, tierFor, historyPoints, normalize, buildState, sampleIfDue, applyEvent, promptBlock,
};
