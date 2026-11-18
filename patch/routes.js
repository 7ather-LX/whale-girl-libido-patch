'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { json, readBody } = require('../src/http/util');
const { isLoopbackRequest } = require('../src/http/security');

const STATIC = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
};

function localOnly(req, res) {
  if (isLoopbackRequest(req)) return false;
  json(res, 403, { ok: false, error: '只允许本机访问' });
  return true;
}

function register(router, runtime, ctx) {
  const root = (ctx && ctx.root) || runtime.config.root || path.resolve(__dirname, '..');
  const svc = () => runtime.libido || require('./index').getService();

  router.get('/libido-patch', (rt, req, res) => {
    res.writeHead(302, { Location: '/libido-patch/' });
    res.end();
  });

  router.get('/libido-patch/', (rt, req, res) => {
    if (localOnly(req, res)) return;
    try {
      res.writeHead(200, { 'Content-Type': STATIC['index.html'], 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(path.join(__dirname, 'web', 'index.html')));
    } catch {
      json(res, 500, { ok: false, error: '面板文件缺失' });
    }
  });

  for (const name of ['app.js', 'style.css']) {
    router.get(`/libido-patch/${name}`, (rt, req, res) => {
      if (localOnly(req, res)) return;
      try {
        res.writeHead(200, { 'Content-Type': STATIC[name], 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(path.join(__dirname, 'web', name)));
      } catch {
        json(res, 404, { ok: false, error: 'not found' });
      }
    });
  }

  router.get('/api/libido/state', (rt, req, res) => {
    if (localOnly(req, res)) return;
    try { return json(res, 200, { ok: true, ...svc().status() }); }
    catch (err) { return json(res, 500, { ok: false, error: String(err && err.message || err) }); }
  });

  router.post('/api/libido/event', async (rt, req, res) => {
    if (localOnly(req, res)) return;
    const body = await readBody(req);
    try {
      const delta = Number(body && body.delta);
      if (!Number.isFinite(delta)) return json(res, 400, { ok: false, error: 'delta 必须是数字' });
      const state = svc().event(delta, String(body && body.note || '').slice(0, 80));
      return json(res, 200, { ok: true, state });
    } catch (err) { return json(res, 400, { ok: false, error: String(err && err.message || err) }); }
  });

  router.post('/api/libido/sleep', async (rt, req, res) => {
    if (localOnly(req, res)) return;
    const body = await readBody(req);
    try { return json(res, 200, { ok: true, state: svc().sleep(body && body.note) }); }
    catch (err) { return json(res, 400, { ok: false, error: String(err && err.message || err) }); }
  });

  router.post('/api/libido/done', async (rt, req, res) => {
    if (localOnly(req, res)) return;
    const body = await readBody(req);
    try { return json(res, 200, { ok: true, state: svc().done(body && body.note) }); }
    catch (err) { return json(res, 400, { ok: false, error: String(err && err.message || err) }); }
  });

  router.post('/api/libido/check-in', async (rt, req, res) => {
    if (localOnly(req, res)) return;
    const body = await readBody(req);
    try { return json(res, 200, { ok: true, state: svc().checkIn(body || {}) }); }
    catch (err) { return json(res, 400, { ok: false, error: String(err && err.message || err) }); }
  });

  router.post('/api/libido/config', async (rt, req, res) => {
    if (localOnly(req, res)) return;
    const body = await readBody(req);
    try {
      const cfg = svc().saveConfig(body || {});
      return json(res, 200, { ok: true, config: cfg });
    } catch (err) { return json(res, 400, { ok: false, error: String(err && err.message || err) }); }
  });

  router.post('/api/libido/reset', async (rt, req, res) => {
    if (localOnly(req, res)) return;
    try {
      const svcRef = svc();
      svcRef.data = require('./state').normalize({
        baseline: svcRef.config.baseline,
        value: 18,
        updatedAt: new Date().toISOString(),
        events: [{ at: new Date().toISOString(), delta: 0, note: '重新立账' }],
        samples: [],
      });
      svcRef.saveState(svcRef.data);
      return json(res, 200, { ok: true, state: svcRef.state() });
    } catch (err) { return json(res, 400, { ok: false, error: String(err && err.message || err) }); }
  });
}

module.exports = { register };
