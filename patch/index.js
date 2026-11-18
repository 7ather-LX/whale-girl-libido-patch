'use strict';

/**
 * 鲸鲸生理状态补丁：把 0–100 的性欲/状态值注入人设提示词，并带一个本地面板。
 * 独立实现；灵感来自 amtoki520/dsh-libido-panel（原项目面向 DSH，不是鲸鲸插件）。
 */

const path = require('node:path');
const versionInfo = require('./version');
const configModule = require('./config');
const { LibidoService } = require('./service');

const KEY = '__WHALE_LIBIDO_PATCH__';
let installed = false;
let runtimeRef = null;
let serviceRef = null;
let rootRef = '';

function log(level, text) {
  try {
    const logger = runtimeRef && runtimeRef.logger;
    if (logger && typeof logger[level] === 'function') logger[level](text);
    else if (level === 'error' || level === 'warn') console.error(text);
    else console.log(text);
  } catch { /* ignore */ }
}

function patchStore(root) {
  const { Store } = require('../src/memory/store');
  if (Store.prototype.__whaleLibidoWrapped) return;
  const original = Store.prototype.buildContext;
  Store.prototype.buildContext = function buildContextWithLibido(opts = {}) {
    const mem = original.call(this, opts);
    try {
      if (!mem || typeof mem !== 'object') return mem;
      if (!serviceRef) return mem;
      const block = serviceRef.prompt({ isGroup: opts.isGroup === true });
      if (!block) return mem;
      mem.block = [String(mem.block || ''), block].filter(Boolean).join('\n\n');
      mem.libido = { current: serviceRef.state().current };
    } catch (err) {
      log('warn', '生理状态注入失败（本轮照常聊天）：' + ((err && err.message) || err));
    }
    return mem;
  };
  Store.prototype.__whaleLibidoWrapped = true;
}

function registerRoutes(root) {
  const routes = require('../src/http/routes');
  if (routes.__whaleLibidoWrapped) return;
  const original = routes.createRouter;
  routes.createRouter = function createRouterWithLibido(runtime) {
    const router = original(runtime);
    try { require('./routes').register(router, runtime, { root }); }
    catch (err) { log('warn', '生理状态接口注册失败：' + ((err && err.message) || err)); }
    return router;
  };
  routes.__whaleLibidoWrapped = true;
}

function patchRuntime(root) {
  const app = require('../src/app');
  if (app.__whaleLibidoWrapped) return;
  const original = app.createRuntime;
  app.createRuntime = function createRuntimeWithLibido(opts = {}) {
    const runtime = original(opts);
    runtimeRef = runtime;
    if (!rootRef) rootRef = root || path.resolve(__dirname, '..');
    try {
      serviceRef = new LibidoService(runtime);
      runtime.libido = serviceRef;
      const cfg = configModule.load(rootRef).config;
      log('info', `🌡️ 生理状态补丁 ${versionInfo.version} 已加载：${cfg.enabled ? '开' : '关'} · 注入${cfg.inject ? '开' : '关'}`);
    } catch (err) {
      log('warn', '生理状态初始化失败：' + ((err && err.message) || err));
    }
    return runtime;
  };
  app.__whaleLibidoWrapped = true;
}

function install(opts = {}) {
  if (installed || global[KEY]) return global[KEY] || null;
  const root = path.resolve(opts.root || path.resolve(__dirname, '..'));
  rootRef = root;
  try { configModule.ensure(root); } catch { /* ignore */ }
  try {
    patchStore(root);
    registerRoutes(root);
    patchRuntime(root);
  } catch (err) {
    log('warn', '生理状态补丁安装失败：' + ((err && err.message) || err));
  }
  installed = true;
  global[KEY] = { installed: true, version: versionInfo.version, root };
  return global[KEY];
}

function getService() { return serviceRef; }

module.exports = { install, getService, versionInfo, config: configModule, STATE_KEY: KEY };
