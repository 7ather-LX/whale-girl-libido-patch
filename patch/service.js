'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cfgmod = require('./config');
const engine = require('./state');

const STATE_FILE = 'whale-libido.json';

class LibidoService {
  constructor(runtime) {
    this.runtime = runtime;
    this.root = (runtime && runtime.config && runtime.config.root) || process.cwd();
    this.logger = (runtime && runtime.logger) || console;
    this.cfgState = cfgmod.ensure(this.root);
    this.config = this.cfgState.config;
    this.stateFile = path.join(this.root, 'data', STATE_FILE);
    this.data = this.loadState();
  }

  loadState() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return engine.normalize(raw);
    } catch {
      const now = new Date().toISOString();
      const data = engine.normalize({
        baseline: this.config.baseline,
        value: 18,
        updatedAt: now,
        events: [{ at: now, delta: 0, note: '立账' }],
        samples: [],
      });
      this.saveState(data);
      return data;
    }
  }

  saveState(data) {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const tmp = this.stateFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, this.stateFile);
    } catch (err) {
      this.logger.warn?.('[libido-patch] state save failed: ' + (err && err.message || err));
    }
  }

  reloadConfig() {
    this.cfgState = cfgmod.ensure(this.root);
    this.config = this.cfgState.config;
    return this.config;
  }

  saveConfig(next) {
    this.config = cfgmod.save(this.root, next);
    return this.config;
  }

  state() {
    this.reloadConfig();
    const sampled = engine.sampleIfDue(this.data, Date.now());
    if (sampled !== this.data) { this.data = sampled; this.saveState(sampled); }
    return engine.buildState(this.data, Date.now());
  }

  status() {
    const state = this.state();
    return {
      version: require('./version').version,
      enabled: this.config.enabled,
      inject: this.config.inject,
      injectGroups: this.config.injectGroups,
      adult: this.config.adult,
      events: this.config.events,
      baseline: this.config.baseline,
      state,
    };
  }

  event(delta, note, kind = 'event') {
    this.reloadConfig();
    if (!this.config.enabled) throw new Error('生理状态补丁已关闭');
    this.data = engine.applyEvent(this.data, delta, note, Date.now(), kind);
    this.saveState(this.data);
    return this.state();
  }

  sleep(note) { return this.event(0, note || '睡醒，砍一半', 'sleep'); }
  done(note) { return this.event(0, note || '解决一次，归 10', 'done'); }

  checkIn(patch) {
    this.reloadConfig();
    this.data.checkIn = {
      mood: String(patch && patch.mood || '').slice(0, 40),
      company: String(patch && patch.company || '').slice(0, 40),
      note: String(patch && patch.note || '').slice(0, 200),
      at: new Date().toISOString(),
    };
    this.saveState(this.data);
    return this.state();
  }

  prompt(opts = {}) {
    this.reloadConfig();
    if (!this.config.enabled || !this.config.inject || !this.config.adult) return '';
    if (opts.isGroup && !this.config.injectGroups) return '';
    return engine.promptBlock(this.state());
  }
}

module.exports = { LibidoService, STATE_FILE };
