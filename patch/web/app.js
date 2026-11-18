'use strict';

const $ = (sel) => document.querySelector(sel);
let status = null;

function toast(text, bad) {
  const el = $('#saveInfo');
  el.textContent = text;
  el.style.color = bad ? '#ff9d9d' : '#8be3b0';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.textContent = ''; }, 4000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function seasonText(s) {
  if (!s) return '—';
  return s.active ? `发情期第 ${s.day} 天` : `距下次发情期 ${s.daysUntil} 天`;
}

function drawChart(points) {
  const canvas = $('#chart');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(600, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(240 * dpr);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 14 + (h - 28) * i / 4;
    ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(w - 12, y); ctx.stroke();
  }
  const values = points.map((p) => (p.value == null ? null : Number(p.value)));
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return;
  const min = 0;
  const max = 100;
  const x = (i) => 12 + (w - 24) * (i / Math.max(1, points.length - 1));
  const y = (v) => 14 + (h - 28) * (1 - (v - min) / (max - min));
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,122,168,.35)');
  grad.addColorStop(1, 'rgba(255,122,168,0)');
  ctx.beginPath();
  let started = false;
  points.forEach((p, i) => {
    if (p.value == null) return;
    const px = x(i), py = y(Number(p.value));
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  });
  ctx.lineTo(x(points.length - 1), h - 14);
  ctx.lineTo(x(0), h - 14);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  started = false;
  points.forEach((p, i) => {
    if (p.value == null) return;
    const px = x(i), py = y(Number(p.value));
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = '#ff7aa8';
  ctx.lineWidth = 2.2 * dpr;
  ctx.stroke();
  ctx.fillStyle = 'rgba(143,152,171,.8)';
  ctx.font = `${11 * dpr}px Segoe UI, Microsoft YaHei`;
  ctx.fillText('0', 12, h - 2);
  ctx.fillText('100', 12, 14 * dpr);
}

function render() {
  if (!status) return;
  const s = status.state;
  $('#value').textContent = s.current;
  $('#tier').textContent = s.tier;
  $('#barFill').style.width = Math.max(1, s.current) + '%';
  $('#season').textContent = seasonText(s.season);
  $('#updated').textContent = '更新于 ' + fmtTime(s.asOf);
  $('#enabled').checked = status.enabled !== false;
  $('#inject').checked = status.inject !== false;
  $('#injectGroups').checked = status.injectGroups === true;
  drawChart(s.history || []);
  const wrap = $('#eventButtons');
  wrap.textContent = '';
  for (const ev of status.events || []) {
    const btn = document.createElement('button');
    btn.className = 'chip ' + (ev.delta >= 0 ? 'plus' : 'minus');
    btn.textContent = `${ev.label} ${ev.delta >= 0 ? '+' : ''}${ev.delta}`;
    btn.addEventListener('click', () => sendEvent(ev.delta, ev.label));
    wrap.append(btn);
  }
  const list = $('#events');
  list.textContent = '';
  for (const ev of s.events || []) {
    const row = document.createElement('div');
    const left = document.createElement('span');
    left.textContent = fmtTime(ev.at) + '  ' + (ev.note || '');
    const right = document.createElement('b');
    right.className = ev.delta >= 0 ? 'plus' : 'minus';
    right.textContent = (ev.delta >= 0 ? '+' : '') + ev.delta;
    row.append(left, right);
    list.append(row);
  }
  const ci = s.checkIn;
  $('#checkInText').textContent = ci ? `近况：${ci.mood || ''} ${ci.company || ''}` : '';
  if (ci) {
    $('#mood').value = ci.mood || '';
    $('#company').value = ci.company || '';
    $('#checkNote').value = ci.note || '';
  }
}

async function refresh() {
  const data = await api('/api/libido/state');
  status = data;
  render();
}

async function sendEvent(delta, note) {
  try {
    const data = await api('/api/libido/event', {
      method: 'POST',
      body: JSON.stringify({ delta, note: note || $('#note').value.trim() || '手动调整' }),
    });
    status.state = data.state;
    render();
    toast(`${delta >= 0 ? '+' : ''}${delta} 已记录`);
  } catch (err) { toast(err.message, true); }
}

async function post(path, body, label) {
  try {
    const data = await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
    status.state = data.state || status.state;
    if (data.config) status = { ...status, ...data.config };
    render();
    toast(label + ' 完成');
  } catch (err) { toast(err.message, true); }
}

function bind() {
  $('#addEvent').addEventListener('click', () => {
    const n = Number(prompt('增减多少？（例如 8 或 -20）', '8'));
    if (!Number.isFinite(n)) return;
    sendEvent(n, $('#note').value.trim());
  });
  $('#sleep').addEventListener('click', () => post('/api/libido/sleep', {}, '睡醒'));
  $('#done').addEventListener('click', () => post('/api/libido/done', {}, '解决'));
  $('#reset').addEventListener('click', () => {
    if (!confirm('回到 18，并清空曲线和事件？')) return;
    post('/api/libido/reset', {}, '重新立账');
  });
  $('#checkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    post('/api/libido/check-in', {
      mood: $('#mood').value.trim(),
      company: $('#company').value.trim(),
      note: $('#checkNote').value.trim(),
    }, '近况');
  });
  $('#saveConfig').addEventListener('click', async () => {
    try {
      const data = await api('/api/libido/config', {
        method: 'POST',
        body: JSON.stringify({ enabled: $('#enabled').checked, inject: $('#inject').checked, injectGroups: $('#injectGroups').checked }),
      });
      status.enabled = data.config.enabled;
      status.inject = data.config.inject;
      status.injectGroups = data.config.injectGroups;
      toast('设置已保存');
    } catch (err) { toast(err.message, true); }
  });
  window.addEventListener('resize', () => render());
}

refresh().then(bind).catch((err) => toast(err.message, true));
