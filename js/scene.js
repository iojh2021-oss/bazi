/* scene.js — رندر صحنه‌هایی که از سرور می‌رسند (کلاینت): دکورها، خانهٔ «زندگی»، زیرنویس
   سرور فقط داده می‌فرستد (موقعیت، حالت، دهان)؛ کشیدن تصویر کار گیرنده است. */
(function () {
  'use strict';
  const BZ = window.BZ, clamp = BZ.clamp, lerp = BZ.lerp;
  const FA = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

  function grad(g, y0, y1, c0, c1, w) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, y0, w, y1 - y0); }

  // ---------- دکورهای نمایش ----------
  const SETS = {
    living(g, w, h) {
      const fy = h * 0.84; grad(g, 0, fy, '#e3c9a0', '#c29c6c', w);
      g.fillStyle = '#8fd0ff'; g.fillRect(w * 0.08, h * 0.12, w * 0.2, h * 0.3); g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.strokeRect(w * 0.08, h * 0.12, w * 0.2, h * 0.3);
      g.beginPath(); g.moveTo(w * 0.18, h * 0.12); g.lineTo(w * 0.18, h * 0.42); g.moveTo(w * 0.08, h * 0.27); g.lineTo(w * 0.28, h * 0.27); g.stroke();
      g.fillStyle = '#fff3d6'; g.fillRect(w * 0.68, h * 0.16, w * 0.16, h * 0.2); g.strokeRect(w * 0.68, h * 0.16, w * 0.16, h * 0.2); g.fillStyle = '#4aa36a'; g.fillRect(w * 0.7, h * 0.26, w * 0.12, h * 0.08);
      g.fillStyle = '#8a5a34'; g.fillRect(0, fy, w, h - fy); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { const y = fy + (h - fy) * i / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#a33a3a'; g.beginPath(); g.ellipse(w * 0.5, fy + (h - fy) * 0.5, w * 0.3, (h - fy) * 0.32, 0, 0, 7); g.fill();
    },
    garden(g, w, h, t) {
      const fy = h * 0.84; grad(g, 0, fy, '#7cc6ff', '#d8f1ff', w);
      g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(w * 0.82, h * 0.2, h * 0.07, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) { const x = ((t * 6 + i * w * 0.4) % (w * 1.3)) - w * 0.15, y = h * (0.15 + i * 0.1); [0, 18, 36].forEach((o, k) => { g.beginPath(); g.arc(x + o, y + (k % 2) * 5, 14 - k * 2, 0, 7); g.fill(); }); }
      g.fillStyle = '#4da35a'; g.beginPath(); g.moveTo(0, fy); g.quadraticCurveTo(w * 0.25, fy - h * 0.18, w * 0.5, fy - h * 0.04); g.quadraticCurveTo(w * 0.8, fy - h * 0.2, w, fy - h * 0.05); g.lineTo(w, fy); g.fill();
      g.fillStyle = '#3d8c4a'; g.fillRect(0, fy, w, h - fy);
      g.fillStyle = '#e8d8b0'; for (let i = 0; i < 9; i++) g.fillRect(w * (0.02 + i * 0.12), fy - h * 0.1, w * 0.03, h * 0.12);
      g.fillRect(0, fy - h * 0.07, w, h * 0.015);
    },
    stage(g, w, h, t) {
      const fy = h * 0.84; grad(g, 0, fy, '#1a1028', '#2a1a3a', w);
      g.fillStyle = '#7a1620'; g.fillRect(0, 0, w * 0.16, h); g.fillRect(w * 0.84, 0, w * 0.16, h);
      g.fillStyle = '#a5232f'; for (let i = 0; i < 5; i++) { g.fillRect(i * w * 0.032, 0, w * 0.012, h); g.fillRect(w - (i + 1) * w * 0.032, 0, w * 0.012, h); }
      g.fillStyle = '#6a4424'; g.fillRect(0, fy, w, h - fy);
      [0.3, 0.5, 0.7].forEach((x, k) => { const gr = g.createRadialGradient(w * x, 0, 4, w * x, fy, h * 0.5); gr.addColorStop(0, 'rgba(255,240,200,' + (0.35 + 0.1 * Math.sin(t + k)) + ')'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(w * x - 6, 0); g.lineTo(w * x + 6, 0); g.lineTo(w * x + w * 0.16, fy); g.lineTo(w * x - w * 0.16, fy); g.fill(); });
    },
    studio(g, w, h, t) {
      const fy = h * 0.84; grad(g, 0, fy, '#0b2a55', '#1d5fc4', w);
      g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, h * 0.1 * i); g.lineTo(w, h * 0.1 * i + 24); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(w * 0.5, h * 0.3, h * 0.2 + Math.sin(t) * 2, 0, 7); g.fill();
      g.fillStyle = '#e9eef9'; g.font = 'bold ' + Math.round(h * 0.08) + 'px ' + BZ.FONT; g.textAlign = 'center'; g.fillText('BAZI NEWS', w * 0.5, h * 0.33);
      g.fillStyle = '#25324a'; g.fillRect(0, fy, w, h - fy); g.fillStyle = '#3b4d70'; g.fillRect(w * 0.05, fy - h * 0.02, w * 0.9, h * 0.05);
    },
  };
  BZ.SET_NAMES = { living: 'اتاق نشیمن', garden: 'باغ', stage: 'صحنهٔ نمایش', studio: 'استودیوی خبر' };

  // ---------- متن‌های روی تصویر ----------
  function fit(g, text, maxW, px, bold) { let s = px; g.font = (bold ? 'bold ' : '') + s + 'px ' + BZ.FONT; while (g.measureText(text).width > maxW && s > 8) { s -= 1; g.font = (bold ? 'bold ' : '') + s + 'px ' + BZ.FONT; } return s; }
  function subtitle(g, w, h, sub) {
    if (!sub) return;
    const txt = sub.text; fit(g, txt, w * 0.92, Math.round(h * 0.062), false);
    const tw = g.measureText(txt).width, y = h * 0.955;
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(w / 2 - tw / 2 - 10, y - h * 0.065, tw + 20, h * 0.085);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(txt, w / 2, y - h * 0.02);
    g.font = 'bold ' + Math.round(h * 0.04) + 'px ' + BZ.FONT; g.fillStyle = '#ffd23f'; g.textAlign = 'right'; g.fillText(sub.who, w - 10, y - h * 0.095);
    g.textBaseline = 'alphabetic';
  }
  function title(g, w, h, txt) {
    if (!txt) return;
    fit(g, txt, w * 0.6, Math.round(h * 0.07), true);
    const tw = g.measureText(txt).width;
    g.fillStyle = 'rgba(160,30,30,.9)'; g.fillRect(8, h * 0.05, tw + 24, h * 0.1);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, 20, h * 0.1); g.textBaseline = 'alphabetic';
  }
  function buffering(g, w, h, t, why) {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#37c27a'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2 - 8, h * 0.07, t * 4, t * 4 + 4.4); g.stroke();
    g.fillStyle = '#9ab'; g.font = Math.round(h * 0.05) + 'px ' + BZ.FONT; g.textAlign = 'center'; g.fillText(why || 'در حال دریافت از سرور…', w / 2, h / 2 + h * 0.14);
  }

  // ---------- نمایش‌نامه ----------
  function drawScript(g, w, h, sc) {
    const fy = h * 0.84, s = h / 300, cam = sc.cam || { z: 1, x: 0.5, y: 0.5 };
    const z = Math.max(1, cam.z), cx = clamp(cam.x, 0.5 / z, 1 - 0.5 / z), cy = clamp(cam.y, 0.5 / z, 1 - 0.5 / z);
    g.save(); g.translate(w / 2, h / 2); g.scale(z, z); g.translate(-cx * w, -cy * h);
    (SETS[sc.set] || SETS.living)(g, w, h, sc.t);
    sc.actors.forEach((a) => BZ.char.draw(g, BZ.lib.char(a.cid), { x: a.x * w, y: fy, s, dir: a.dir, emo: a.emo, open: a.open, vis: a.vis, t: sc.t, act: a.act, gest: a.gest, look: a.look }));
    g.restore();
    title(g, w, h, sc.title); subtitle(g, w, h, sc.sub);
  }

  // ---------- خانهٔ «زندگی» ----------
  function drawLife(g, w, h, sc) {
    const fy = h * 0.82, s = h / 330, t = sc.t, hour = sc.hud.hour;
    const a = Math.sin(Math.PI * (hour - 6) / 12), dl = hour >= 5.5 && hour < 18.5 ? clamp(a * 2.2 + 0.1, 0, 1) : 0;
    const mixc = (c0, c1, k) => BZ.color.mix(c0, c1, k);
    grad(g, 0, fy, mixc('#070b24', '#6fc3ff', dl), mixc('#1a1f45', '#d8f1ff', dl), w);
    if (dl < 0.5) { g.fillStyle = 'rgba(255,255,255,' + (0.9 - dl * 1.6) + ')'; for (let i = 0; i < 30; i++) { const r = BZ.rng(i + 7); g.fillRect(r() * w, r() * fy * 0.7, 1.5, 1.5); } }
    const fr = hour >= 6 && hour < 18 ? (hour - 6) / 12 : ((hour + 6) % 24) / 12;
    const sx = w * (0.08 + 0.84 * fr), sy = h * (0.42 - 0.34 * Math.sin(Math.PI * clamp(fr, 0, 1)));
    g.fillStyle = hour >= 6 && hour < 18 ? '#fff2a0' : '#eef2ff'; g.beginPath(); g.arc(sx, sy, h * 0.045, 0, 7); g.fill();
    g.fillStyle = mixc('#14301c', '#3d8c4a', dl); g.fillRect(w * 0.7, fy, w * 0.3, h - fy);
    g.fillStyle = mixc('#2b2f3a', '#e8d8b0', dl); for (let i = 0; i < 4; i++) g.fillRect(w * (0.72 + i * 0.07), fy - h * 0.09, w * 0.02, h * 0.1); g.fillRect(w * 0.7, fy - h * 0.06, w * 0.3, h * 0.012);
    // خانه
    const top = h * 0.12;
    const rooms = [[0, 0.24, '#c9b0d8', 'اتاق خواب'], [0.24, 0.47, '#f0d9a8', 'آشپزخانه'], [0.47, 0.7, '#cfe3c8', 'نشیمن']];
    rooms.forEach(([x0, x1, c]) => { g.fillStyle = c; g.fillRect(w * x0, top, w * (x1 - x0), fy - top); g.strokeStyle = '#5a4630'; g.lineWidth = 3; g.strokeRect(w * x0, top, w * (x1 - x0), fy - top); });
    g.fillStyle = '#7a3b2a'; g.beginPath(); g.moveTo(-4, top); g.lineTo(w * 0.35, h * 0.02); g.lineTo(w * 0.74, top); g.closePath(); g.fill();
    g.fillStyle = '#7a5230'; g.fillRect(0, fy, w * 0.7, h - fy);
    // پنجره‌ها
    [[0.28, 0.3], [0.5, 0.3]].forEach(([x]) => { g.fillStyle = mixc('#0c1030', '#9bd6ff', dl); g.fillRect(w * x, top + h * 0.1, w * 0.1, h * 0.2); g.strokeStyle = '#5a4630'; g.lineWidth = 3; g.strokeRect(w * x, top + h * 0.1, w * 0.1, h * 0.2); });
    // تخت دو‌طبقه
    g.fillStyle = '#6a4a8a'; g.fillRect(w * 0.01, fy - 30 * s, w * 0.22, 9 * s); g.fillRect(w * 0.01, fy - 64 * s, w * 0.22, 9 * s); g.fillStyle = '#4a3466'; g.fillRect(w * 0.01, fy - 64 * s, 5, 64 * s); g.fillRect(w * 0.23, fy - 64 * s, 5, 64 * s);
    // آشپزخانه: کانتر، یخچال، میز
    g.fillStyle = '#8a8f99'; g.fillRect(w * 0.255, fy - 70 * s, w * 0.07, 70 * s); g.fillStyle = '#6a4a2a'; g.fillRect(w * 0.33, fy - 34 * s, w * 0.12, 5 * s); g.fillRect(w * 0.345, fy - 29 * s, 4, 29 * s); g.fillRect(w * 0.425, fy - 29 * s, 4, 29 * s);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w * 0.385, fy - 36 * s, w * 0.025, 3 * s, 0, 0, 7); g.fill();
    // تلویزیون کوچک
    const tvx = w * 0.62, tvy = fy - 60 * s; g.fillStyle = '#2a1c12'; g.fillRect(tvx, tvy, w * 0.07, 40 * s);
    const k = Math.floor(t * 3) % 3; g.fillStyle = ['#5ec8ff', '#ffd23f', '#ff7b9c'][k]; g.fillRect(tvx + 3, tvy + 3, w * 0.07 - 6, 40 * s - 6);
    // گیاهان باغ
    const plants = sc.actors.filter((q) => q.k === 'p'), agents = sc.actors.filter((q) => q.k === 'a');
    plants.forEach((p) => BZ.char.draw(g, BZ.lib.char(p.cid), { x: p.x * w, y: fy + 6 * s, s: s * 0.95, dir: 1, emo: p.emo, open: p.open, vis: p.vis, t, grow: p.grow, wilt: p.wilt, wind: 1 }));
    // عامل‌ها
    const front = [];
    agents.forEach((a) => {
      let P = { x: a.x * w, y: fy, s, dir: a.dir, emo: a.emo, open: a.open, vis: a.vis, t, act: a.act, ph: a.ph, gest: a.gest };
      if (a.act === 'sleep') { const lvl = a.idx % 2; P = Object.assign(P, { x: w * (0.215 - 0.03 * (a.idx >= 2 ? 1 : 0)), y: fy - (lvl ? 68 : 34) * s, s: s * 0.72, rot: -1.5, dir: 1, sleep: true, open: 0, act: 'idle' }); front.push(() => { g.fillStyle = 'rgba(80,120,200,.75)'; g.fillRect(w * 0.06, P.y - 2, w * 0.16, 20 * s * 0.8); g.fillStyle = '#9ab'; g.font = 'bold ' + Math.round(h * 0.05) + 'px sans-serif'; g.textAlign = 'left'; g.fillText('z', w * 0.05 + 8 * Math.sin(t * 2), P.y - 14 - ((t * 10) % 18)); }); }
      else if (a.act === 'eat') { P.act = 'eat'; if (!a.open) P.open = 0.35 * Math.abs(Math.sin(t * 5)); }
      else if (a.act === 'watch') { P.y = fy - 6 * s; P.s = s * 0.92; P.dir = 1; P.act = 'idle'; front.push(() => { g.fillStyle = '#b5523a'; g.fillRect(w * 0.48, fy - 28 * s, w * 0.13, 28 * s); }); }
      else if (a.act === 'water') { P.act = 'water'; front.push(() => { const hx = P.x + 24 * s, hy = fy - 50 * s; g.fillStyle = '#4a90d8'; g.fillRect(hx, hy, 14 * s, 10 * s); g.fillRect(hx + 12 * s, hy + 2 * s, 10 * s, 3 * s); g.fillStyle = 'rgba(120,190,255,.9)'; for (let i = 0; i < 5; i++) { const u = ((t * 1.6 + i / 5) % 1); g.beginPath(); g.arc(hx + 24 * s + u * 4, hy + 5 * s + u * 40 * s, 1.8, 0, 7); g.fill(); } }); }
      else if (a.act === 'talk') { P.act = 'idle'; }
      BZ.char.draw(g, BZ.lib.char(a.cid), P);
    });
    front.forEach((f) => f());
    if (agents.some((q) => q.act === 'eat')) { g.fillStyle = '#e8903a'; g.beginPath(); g.ellipse(w * 0.385, fy - 39 * s, 8 * s, 3 * s, 0, 0, 7); g.fill(); }
    // نور شب
    if (dl < 1) {
      g.fillStyle = 'rgba(6,10,40,' + (0.5 * (1 - dl)) + ')'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      [[0.12, 0.5], [0.36, 0.45], [0.58, 0.45]].forEach(([x, y]) => { const gr = g.createRadialGradient(w * x, h * y, 3, w * x, h * y, h * 0.4); gr.addColorStop(0, 'rgba(255,190,90,' + (0.4 * (1 - dl)) + ')'); gr.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w * 0.72, fy); });
      g.globalCompositeOperation = 'source-over';
    }
    // ساعت و روز
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(w - w * 0.3, 6, w * 0.29, h * 0.09);
    g.fillStyle = '#7dff9d'; g.font = 'bold ' + Math.round(h * 0.055) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(FA(BZ.pad2(hh) + ':' + BZ.pad2(mm)) + '  روز ' + FA(sc.hud.day + 1), w - w * 0.155, 6 + h * 0.045); g.textBaseline = 'alphabetic';
    title(g, w, h, sc.title); subtitle(g, w, h, sc.sub);
  }

  BZ.scene = {
    draw(g, w, h, sc) { if (!sc) { buffering(g, w, h, performance.now() / 1000); return; } if (sc.k === 'l') drawLife(g, w, h, sc); else drawScript(g, w, h, sc); },
  };
  // صحنهٔ «production» در بوم تلویزیون؛ stream جریان سرور است
  BZ.video.scenes.production = function (g, w, h, t, p, stream) {
    if (!stream) { buffering(g, w, h, t, 'سیگنال به سرور نرسید'); return; }
    const sc = stream.sceneAt(t);
    if (!sc) { buffering(g, w, h, t, 'بافر… ' + Math.round(stream.link().latency) + ' ms'); return; }
    BZ.scene.draw(g, w, h, sc);
  };
})();
