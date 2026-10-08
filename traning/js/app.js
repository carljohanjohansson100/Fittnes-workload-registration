'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const WEEKDAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  const TYPE_LABEL = { promenad: 'Promenad', 'löpning': 'Löpning', gym: 'Gym', cykling: 'Cykling', simning: 'Simning' };

  let entries = Store.loadEntries();
  let profile = Store.loadProfile();

  const parseDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const weekday = iso => WEEKDAYS[parseDate(iso).getDay()];
  const todayIso = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };

  function showTab(name) {
    const ioStatus = (msg, bad) => { $('io-status').textContent = msg; $('io-status').style.color = bad ? '#ff6b6b' : '#6bdc8f'; };

  $('btn-export').addEventListener('click', () => {
    const data = { app: 'charles-training', version: 1, exported: new Date().toISOString(), profile, entries };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `traning-${todayIso()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    ioStatus(`Exporterade ${entries.length} pass.`);
  });

  $('import-file').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const { entries: incoming, profile: p } = Store.parseBackup(await file.text());
      const have = new Set(entries.map(e => e.id));
      const fresh = incoming.filter(e => !have.has(e.id));
      entries = entries.concat(fresh);
      if (p) {
        profile = p;
        Store.saveProfile(profile);
        $('p-name').value = profile.name || '';
        $('p-weight').value = profile.weight ?? '';
        $('p-height').value = profile.height ?? '';
      }
      if (!Store.saveEntries(entries)) throw new Error('Kunde inte spara i webbläsaren.');
      ioStatus(`Importerade ${fresh.length} nya pass (${incoming.length - fresh.length} fanns redan).`);
      render();
    } catch (err) {
      ioStatus(err.message, true);
    }
  });

  $('btn-token').addEventListener('click', () => {
    ioStatus(Store.saveToken($('p-token').value.trim()) ? 'Token sparad.' : 'Kunde inte spara token.', false);
  });

  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $('tab-log').classList.toggle('hidden', name !== 'log');
    $('tab-profile').classList.toggle('hidden', name !== 'profile');
    if (name === 'log') renderChart();
  }

  function renderWeekday() {
    const v = $('f-date').value;
    $('f-weekday').textContent = v ? weekday(v) : '';
  }

  function renderTable() {
    const tbody = $('log-table').querySelector('tbody');
    tbody.textContent = '';
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    for (const e of sorted) {
      const tr = document.createElement('tr');
      const cells = [
        e.date, weekday(e.date), TYPE_LABEL[e.type] || e.type, e.minutes,
        e.km ?? '', e.hr ?? '', e.kcal, e.comment || '',
      ];
      cells.forEach((v, i) => {
        const td = document.createElement('td');
        td.textContent = v; // textContent: kommentaren kan inte injicera HTML
        if (i === 7) td.className = 'comment';
        if (i === 6) {
          td.title = e.note || '';
          if (e.source === 'formel') td.textContent = v + ' *';
        }
        tr.appendChild(td);
      });
      const td = document.createElement('td');
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.title = 'Ta bort'; del.textContent = '×';
      del.addEventListener('click', () => {
        if (!confirm('Ta bort passet?')) return;
        entries = entries.filter(x => x.id !== e.id);
        Store.saveEntries(entries);
        render();
      });
      td.appendChild(del); tr.appendChild(td);
      tbody.appendChild(tr);
    }
    $('empty').classList.toggle('hidden', entries.length > 0);
    $('log-table').classList.toggle('hidden', entries.length === 0);
  }

  function renderChart() {
    const byDay = new Map();
    for (const e of entries) {
      const d = byDay.get(e.date) || { date: e.date, kcal: 0, minutes: 0 };
      d.kcal += e.kcal; d.minutes += e.minutes;
      byDay.set(e.date, d);
    }
    const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    Chart.draw($('chart'), days);
  }

  function render() {
    $('profile-warning').classList.toggle('hidden', !!profile.weight);
    renderTable();
    renderChart();
  }

  $('f-comment').addEventListener('input', () => {
    $('f-count').textContent = `${$('f-comment').value.length}/300`;
  });
  $('f-date').addEventListener('input', renderWeekday);

  async function estimateKcal(type, minutes, hr, weight) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = Store.loadToken();
      if (token) headers['X-API-Token'] = token;
      const r = await fetch('/api/calories', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, minutes, weight_kg: weight, end_hr: hr }),
      });
      if (r.status === 401) {
        return { kcal: Calories.kcal(type, minutes, null, hr, weight), source: 'formel', note: 'Reservberäkning: token saknas eller är fel (se Profil).' };
      }
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      return { kcal: d.kcal, source: 'ai', note: d.rationale };
    } catch (_) {
      // Reserv: lokal MET-formel när AI-tjänsten inte svarar.
      return { kcal: Calories.kcal(type, minutes, null, hr, weight), source: 'formel', note: 'Reservberäkning (formel), AI-tjänsten svarade inte.' };
    }
  }

  $('entry-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = $('f-error'); err.textContent = '';
    if (!profile.weight) { err.textContent = 'Ange vikt under fliken Profil först.'; return; }

    const num = id => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
    const date = $('f-date').value;
    const type = $('f-type').value;
    const minutes = num('f-minutes');
    const km = num('f-km');
    const hr = num('f-hr');
    const comment = $('f-comment').value.slice(0, 300);

    if (!date || !(minutes > 0)) { err.textContent = 'Datum och tid (minuter) krävs.'; return; }
    if (km !== null && km < 0) { err.textContent = 'Distans kan inte vara negativ.'; return; }

    const btn = $('entry-form').querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Beräknar…';
    const est = await estimateKcal(type, minutes, hr, profile.weight);
    btn.disabled = false; btn.textContent = 'Spara pass';

    entries.push({
      id: Date.now(), date, type, minutes, km, hr, comment,
      kcal: est.kcal, source: est.source, note: est.note,
    });
    if (!Store.saveEntries(entries)) err.textContent = 'Kunde inte spara i webbläsaren.';
    $('f-minutes').value = ''; $('f-km').value = ''; $('f-hr').value = ''; $('f-comment').value = '';
    $('f-count').textContent = '0/300';
    render();
  });

  $('profile-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const w = Number($('p-weight').value);
    const h = $('p-height').value.trim();
    profile = { name: $('p-name').value.trim(), weight: w > 0 ? w : null, height: h === '' ? null : Number(h) };
    $('p-status').textContent = Store.saveProfile(profile) ? 'Sparat' : 'Kunde inte spara';
    setTimeout(() => { $('p-status').textContent = ''; }, 2500);
    render();
  });

  const ioStatus = (msg, bad) => { $('io-status').textContent = msg; $('io-status').style.color = bad ? '#ff6b6b' : '#6bdc8f'; };

  $('btn-export').addEventListener('click', () => {
    const data = { app: 'charles-training', version: 1, exported: new Date().toISOString(), profile, entries };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `traning-${todayIso()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    ioStatus(`Exporterade ${entries.length} pass.`);
  });

  $('import-file').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const { entries: incoming, profile: p } = Store.parseBackup(await file.text());
      const have = new Set(entries.map(e => e.id));
      const fresh = incoming.filter(e => !have.has(e.id));
      entries = entries.concat(fresh);
      if (p) {
        profile = p;
        Store.saveProfile(profile);
        $('p-name').value = profile.name || '';
        $('p-weight').value = profile.weight ?? '';
        $('p-height').value = profile.height ?? '';
      }
      if (!Store.saveEntries(entries)) throw new Error('Kunde inte spara i webbläsaren.');
      ioStatus(`Importerade ${fresh.length} nya pass (${incoming.length - fresh.length} fanns redan).`);
      render();
    } catch (err) {
      ioStatus(err.message, true);
    }
  });

  $('btn-token').addEventListener('click', () => {
    ioStatus(Store.saveToken($('p-token').value.trim()) ? 'Token sparad.' : 'Kunde inte spara token.', false);
  });

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  window.addEventListener('resize', renderChart);

  $('f-date').value = todayIso();
  $('p-name').value = profile.name || '';
  $('p-weight').value = profile.weight ?? '';
  $('p-height').value = profile.height ?? '';
  $('p-token').value = Store.loadToken();
  renderWeekday();
  render();
})();
