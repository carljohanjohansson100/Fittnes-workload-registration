'use strict';

// Tvåaxlig linjegraf utan externa beroenden. Vänster y: kalorier, höger y: minuter, x: datum.
const Chart = {
  draw(canvas, days) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 380;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const m = { l: 52, r: 52, t: 30, b: 50 };
    const w = cssW - m.l - m.r;
    const h = cssH - m.t - m.b;
    const C = { kcal: '#ff9f43', min: '#4cc9f0', grid: '#2a2f55', text: '#9aa3c4' };

    ctx.font = '12px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textBaseline = 'middle';

    if (!days.length) {
      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.fillText('Ingen data att visa', cssW / 2, cssH / 2);
      return;
    }

    const niceMax = v => {
      if (v <= 0) return 10;
      const p = Math.pow(10, Math.floor(Math.log10(v)));
      return Math.ceil(v / p) * p;
    };
    const maxK = niceMax(Math.max(...days.map(d => d.kcal)));
    const maxM = niceMax(Math.max(...days.map(d => d.minutes)));
    const n = days.length;
    const x = i => m.l + (n === 1 ? w / 2 : (w * i) / (n - 1));
    const yK = v => m.t + h - (v / maxK) * h;
    const yM = v => m.t + h - (v / maxM) * h;

    // Rutnät och axlar
    for (let i = 0; i <= 5; i++) {
      const y = m.t + (h * i) / 5;
      ctx.strokeStyle = C.grid;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + w, y); ctx.stroke();
      ctx.fillStyle = C.kcal; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxK - (maxK * i) / 5), m.l - 8, y);
      ctx.fillStyle = C.min; ctx.textAlign = 'left';
      ctx.fillText(Math.round(maxM - (maxM * i) / 5), m.l + w + 8, y);
    }

    // X-etiketter (glesa ut vid många dagar)
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 60))));
    ctx.fillStyle = C.text; ctx.textAlign = 'center';
    days.forEach((d, i) => {
      if (i % step === 0 || i === n - 1) ctx.fillText(d.date.slice(5), x(i), m.t + h + 16);
    });
    ctx.fillText('Datum (MM-DD)', m.l + w / 2, cssH - 10);

    // Axeltitlar
    ctx.fillStyle = C.kcal; ctx.textAlign = 'left';
    ctx.fillText('Kalorier (kcal)', 4, 12);
    ctx.fillStyle = C.min; ctx.textAlign = 'right';
    ctx.fillText('Minuter', cssW - 4, 12);

    const line = (key, yFn, color) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      days.forEach((d, i) => (i ? ctx.lineTo(x(i), yFn(d[key])) : ctx.moveTo(x(i), yFn(d[key]))));
      ctx.stroke();
      days.forEach((d, i) => { ctx.beginPath(); ctx.arc(x(i), yFn(d[key]), 3.5, 0, Math.PI * 2); ctx.fill(); });
    };
    line('kcal', yK, C.kcal);
    line('minutes', yM, C.min);
  },
};
