'use strict';

const Store = {
  ENTRIES: 'charles.training.entries',
  PROFILE: 'charles.training.profile',
  TOKEN: 'charles.training.token',

  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  },

  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  },

  loadEntries() {
    const list = this._read(this.ENTRIES, []);
    return Array.isArray(list) ? list : [];
  },
  saveEntries(list) { return this._write(this.ENTRIES, list); },

  loadProfile() { return this._read(this.PROFILE, { name: '', weight: null, height: null }); },
  saveProfile(p) { return this._write(this.PROFILE, p); },

  loadToken() {
    try { return localStorage.getItem(this.TOKEN) || ''; } catch (_) { return ''; }
  },
  saveToken(t) {
    try { localStorage.setItem(this.TOKEN, t); return true; } catch (_) { return false; }
  },

  // Validerar en importerad fil. Returnerar { entries, profile } eller kastar Error.
  parseBackup(text) {
    let d;
    try { d = JSON.parse(text); } catch (_) { throw new Error('Filen är inte giltig JSON.'); }
    if (!d || d.app !== 'charles-training' || !Array.isArray(d.entries)) {
      throw new Error('Filen är inte en träningssäkerhetskopia.');
    }
    const TYPES = ['promenad', 'löpning', 'gym', 'cykling', 'simning'];
    const num = v => typeof v === 'number' && Number.isFinite(v);
    const entries = d.entries.map((e, i) => {
      const ok = e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && TYPES.includes(e.type) &&
        num(e.minutes) && e.minutes > 0 && num(e.kcal) && e.kcal >= 0 && num(e.id);
      if (!ok) throw new Error(`Ogiltigt pass på rad ${i + 1}.`);
      return {
        id: e.id, date: e.date, type: e.type, minutes: e.minutes,
        km: num(e.km) ? e.km : null, hr: num(e.hr) ? e.hr : null,
        comment: typeof e.comment === 'string' ? e.comment.slice(0, 300) : '',
        kcal: Math.round(e.kcal), source: e.source === 'formel' ? 'formel' : 'ai',
        note: typeof e.note === 'string' ? e.note.slice(0, 300) : '',
      };
    });
    let profile = null;
    if (d.profile && typeof d.profile === 'object') {
      const p = d.profile;
      profile = {
        name: typeof p.name === 'string' ? p.name.slice(0, 80) : '',
        weight: num(p.weight) && p.weight > 0 ? p.weight : null,
        height: num(p.height) && p.height > 0 ? p.height : null,
      };
    }
    return { entries, profile };
  },
};
