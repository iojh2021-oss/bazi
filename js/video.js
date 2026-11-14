/* video.js — صحنه‌های تصویری روی بوم و جلوه‌های سیگنال (برف، ارواح، نوار VHS) */
(function () {
  'use strict';
  const BZ = window.BZ;
  const F = (px, b) => (b ? 'bold ' : '') + px + 'px ' + BZ.FONT;
  const SC = {};

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  SC.testcard = function (g, w, h, t, p) {
    const bars = ['#c8c8c8', '#c8c800', '#00c8c8', '#00c800', '#c800c8', '#c80000', '#0000c8'];
    const bw = w / 7;
    bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, 0, bw + 1, h * 0.58); });
    g.fillStyle = '#101010'; g.fillRect(0, h * 0.58, w, h * 0.42);
    for (let i = 0; i < 8; i++) { const v = Math.round((i / 7) * 255); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect((i * w) / 8, h * 0.8, w / 8 + 1, h * 0.14); }
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(w / 2, h * 0.36, h * 0.24, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(w / 2, h * 0.1); g.lineTo(w / 2, h * 0.62); g.moveTo(w * 0.3, h * 0.36); g.lineTo(w * 0.7, h * 0.36); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.75)'; rr(g, w * 0.36, h * 0.3, w * 0.28, h * 0.13, 6); g.fill();
    g.fillStyle = '#fff'; g.font = F(h * 0.075, true); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.video.title || 'تصویر آزمون', w / 2, h * 0.365);
    g.fillStyle = '#ff0'; g.fillRect((t * 40) % w, h * 0.62, 6, h * 0.14);
    g.fillStyle = '#9f9'; g.font = F(h * 0.05); g.fillText('1 kHz  •  625/525', w / 2, h * 0.975);
  };

  SC.news = function (g, w, h, t, p) {
    const pal = p.video.pal;
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, pal[0]); bg.addColorStop(1, pal[1]);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, h * 0.1 * i); g.lineTo(w, h * 0.1 * i + 30); g.stroke(); }
    // مجری
    g.fillStyle = '#2b2f3a'; g.beginPath(); g.moveTo(w * 0.3, h * 0.78); g.quadraticCurveTo(w * 0.5, h * 0.45, w * 0.7, h * 0.78); g.closePath(); g.fill();
    g.fillStyle = '#e8b98f'; g.beginPath(); g.arc(w * 0.5, h * 0.36, h * 0.11, 0, 7); g.fill();
    g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(w * 0.5, h * 0.32, h * 0.115, Math.PI, 0); g.fill();
    g.fillStyle = '#222'; g.fillRect(w * 0.47, h * 0.355, 6, 6); g.fillRect(w * 0.53 - 6, h * 0.355, 6, 6);
    const mo = 2 + 6 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.1));
    g.fillStyle = '#7a2a2a'; g.fillRect(w * 0.5 - 8, h * 0.42, 16, mo);
    g.fillStyle = '#d7dbe6'; g.fillRect(w * 0.2, h * 0.76, w * 0.6, h * 0.06);
    // نوار پایین
    g.fillStyle = pal[2]; g.fillRect(0, h * 0.86, w, h * 0.14);
    g.fillStyle = pal[0]; g.font = F(h * 0.06, true); g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText(p.video.title || p.name, w - 12, h * 0.89);
    g.font = F(h * 0.042); const tk = p.video.ticker || p.name; const tw = g.measureText(tk).width + w;
    g.save(); g.beginPath(); g.rect(0, h * 0.925, w, h * 0.075); g.clip();
    g.fillStyle = pal[0]; g.textAlign = 'left'; g.fillText(tk, w - ((t * 55) % tw), h * 0.962); g.restore();
    g.fillStyle = '#fff'; g.font = F(h * 0.05, true); g.textAlign = 'left'; g.fillText(BZ.clockHM(t), 10, h * 0.07);
    if (Math.floor(t * 1.5) % 2 === 0) { g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(w - 18, h * 0.07, 6, 0, 7); g.fill(); }
  };

  SC.nature = function (g, w, h, t, p) {
    const pal = p.video.pal, cyc = (Math.sin(t * 0.05) + 1) / 2;
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7); sky.addColorStop(0, pal[0]); sky.addColorStop(1, cyc > 0.5 ? '#f7a46a' : pal[1]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = pal[2]; g.beginPath(); g.arc(w * (0.15 + 0.7 * ((t * 0.01) % 1)), h * (0.4 - 0.25 * Math.sin(((t * 0.01) % 1) * Math.PI)), h * 0.07, 0, 7); g.fill();
    [['#1d3b4a', 0.52, 0.22, 0.01], ['#16503f', 0.62, 0.16, 0.02], ['#0e3b2c', 0.72, 0.12, 0.035]].forEach(([c, y0, amp, sp]) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h * y0 + Math.sin(x * 0.02 + t * sp * 10 + y0 * 9) * h * amp * 0.5 + Math.sin(x * 0.007 + y0 * 4) * h * amp);
      g.lineTo(w, h); g.closePath(); g.fill();
    });
    g.fillStyle = 'rgba(30,110,160,.8)'; g.fillRect(0, h * 0.86, w, h * 0.14);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); for (let x = 0; x <= w; x += 10) g.lineTo(x, h * (0.87 + i * 0.025) + Math.sin(x * 0.05 + t * 2 + i) * 2); g.stroke(); }
    g.strokeStyle = '#111'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const bx = (t * 30 + i * 90) % (w + 40) - 20, by = h * 0.2 + i * 14 + Math.sin(t * 2 + i) * 6; g.beginPath(); g.moveTo(bx - 8, by); g.quadraticCurveTo(bx - 3, by - 6 * Math.sin(t * 8 + i), bx, by); g.quadraticCurveTo(bx + 3, by - 6 * Math.sin(t * 8 + i), bx + 8, by); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h * 0.04, w * 0.55, h * 0.09);
    g.fillStyle = '#fff'; g.font = F(h * 0.06, true); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(p.video.title || p.name, 10, h * 0.085);
  };

  SC.sport = function (g, w, h, t, p) {
    g.fillStyle = p.video.pal[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? p.video.pal[1] : p.video.pal[0]; g.fillRect((i * w) / 8, h * 0.12, w / 8 + 1, h * 0.76); }
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(w * 0.06, h * 0.16, w * 0.88, h * 0.68);
    g.beginPath(); g.moveTo(w / 2, h * 0.16); g.lineTo(w / 2, h * 0.84); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, h * 0.12, 0, 7); g.stroke();
    for (let i = 0; i < 10; i++) {
      const x = w * (0.5 + 0.38 * Math.sin(t * 0.5 + i * 1.7) * Math.cos(i)), y = h * (0.5 + 0.28 * Math.cos(t * 0.6 + i * 2.3));
      g.fillStyle = i < 5 ? '#ff4040' : '#4080ff'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    }
    const bx = w * (0.5 + 0.4 * Math.sin(t * 0.9)), by = h * (0.5 + 0.3 * Math.sin(t * 1.4));
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 4, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.7)'; rr(g, w * 0.34, 6, w * 0.32, h * 0.1, 6); g.fill();
    g.fillStyle = '#fff'; g.font = F(h * 0.07, true); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(Math.floor(t / 47) % 5 + ' - ' + (Math.floor(t / 71) % 4), w / 2, h * 0.057);
    g.font = F(h * 0.045); g.fillText(BZ.fmtTime(t % 5400).slice(3), w * 0.5, h * 0.93);
  };

  SC.cartoon = function (g, w, h, t, p) {
    const pal = p.video.pal;
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? pal[0] : '#3d7bff'; g.fillRect(0, (i * h) / 10, w, h / 10 + 1); }
    g.fillStyle = '#4ccf6a'; g.fillRect(0, h * 0.8, w, h * 0.2);
    for (let i = 0; i < 6; i++) { g.save(); g.translate(w * (0.1 + 0.16 * i), h * 0.15 + (i % 3) * 20); g.rotate(t * 0.8 + i); g.fillStyle = pal[1]; g.fillRect(-7, -7, 14, 14); g.rotate(0.78); g.fillRect(-7, -7, 14, 14); g.restore(); }
    const cols = [pal[2], pal[1], '#ff8bd0'];
    for (let i = 0; i < 3; i++) {
      const x = w * (0.2 + 0.3 * i), bounce = Math.abs(Math.sin(t * 2.2 + i * 1.3)), y = h * 0.78 - bounce * h * 0.4, sq = 1 - bounce * 0.2;
      g.fillStyle = cols[i]; g.beginPath(); g.ellipse(x, y, h * 0.1 * (2 - sq), h * 0.1 * sq, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 9, y - 5, 7, 0, 7); g.arc(x + 9, y - 5, 7, 0, 7); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(x - 9 + Math.sin(t * 3), y - 5, 3, 0, 7); g.arc(x + 9 + Math.sin(t * 3), y - 5, 3, 0, 7); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(x, y + 4, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
    g.fillStyle = '#fff'; g.font = F(h * 0.075, true); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.video.title || p.name, w / 2, h * 0.07);
  };

  SC.weather = function (g, w, h, t, p) {
    const pal = p.video.pal;
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b5e45'; g.strokeStyle = '#7fd0a8'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w * 0.18, h * 0.3); g.lineTo(w * 0.45, h * 0.16); g.lineTo(w * 0.78, h * 0.28); g.lineTo(w * 0.86, h * 0.55); g.lineTo(w * 0.62, h * 0.82); g.lineTo(w * 0.3, h * 0.74); g.lineTo(w * 0.14, h * 0.52); g.closePath(); g.fill(); g.stroke();
    for (let i = 0; i < 7; i++) { const x = ((t * 14 + i * 70) % (w + 120)) - 60, y = h * (0.2 + 0.1 * i % 0.6); g.fillStyle = 'rgba(255,255,255,.65)'; [0, 16, 32].forEach((o, k) => { g.beginPath(); g.arc(x + o, y + (k % 2) * 6, 14 - k * 2, 0, 7); g.fill(); }); }
    const cities = [['تهران', 0.5, 0.35], ['تبریز', 0.3, 0.26], ['شیراز', 0.45, 0.68], ['مشهد', 0.76, 0.34]];
    g.font = F(h * 0.05, true); g.textAlign = 'center';
    cities.forEach(([n, x, y], i) => { g.fillStyle = '#ffd23f'; g.fillText(n + ' ' + Math.round(14 + 10 * Math.sin(t * 0.02 + i * 2)) + '°', w * x, h * y); });
    g.fillStyle = pal[2]; g.textAlign = 'right'; g.fillText(p.video.title || p.name, w - 10, h * 0.07);
  };

  SC.cinema = function (g, w, h, t, p) {
    const pal = p.video.pal, bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, pal[0]); bg.addColorStop(1, pal[1]); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const lx = w * (0.5 + 0.3 * Math.sin(t * 0.15)), glow = g.createRadialGradient(lx, h * 0.3, 4, lx, h * 0.3, h * 0.5);
    glow.addColorStop(0, 'rgba(255,230,160,.55)'); glow.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = '#05050a';
    g.beginPath(); g.moveTo(w * 0.1, h); g.lineTo(w * 0.1, h * 0.7); g.lineTo(w * 0.25, h * 0.62); g.lineTo(w * 0.4, h * 0.72); g.lineTo(w * 0.4, h); g.fill();
    const px = w * (0.45 + 0.35 * ((t * 0.02) % 1)), sw = Math.sin(t * 5) * 4;
    g.fillRect(px - 10, h * 0.55, 20, h * 0.3); g.beginPath(); g.arc(px, h * 0.5, 12, 0, 7); g.fill();
    g.fillRect(px - 10 + sw, h * 0.82, 8, h * 0.18); g.fillRect(px + 2 - sw, h * 0.82, 8, h * 0.18);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h * 0.11); g.fillRect(0, h * 0.89, w, h * 0.11);
    const subs = ['این شهر شب‌ها نفس می‌کشد…', 'هیچ‌کس نمی‌داند ماه کجا می‌رود.', 'صدای امواج را می‌شنوی؟', 'بگذار قصه از سر گرفته شود.'];
    g.fillStyle = pal[2]; g.font = F(h * 0.05); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(subs[Math.floor(t / 5) % 4], w / 2, h * 0.835);
    g.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  };

  SC.music = function (g, w, h, t, p) {
    const pal = p.video.pal, bpm = (p.audio && p.audio.bpm) || 100, beat = (t * bpm) / 60, ph = beat % 1;
    const bg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); bg.addColorStop(0, pal[1] + '66'); bg.addColorStop(1, pal[0]);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const N = 24, bw = w / N;
    for (let i = 0; i < N; i++) {
      const v = 0.25 + 0.65 * Math.abs(Math.sin(t * 2.1 + i * 0.7) * Math.cos(t * 0.9 + i * 0.31)) * (1 - ph * 0.4);
      g.fillStyle = i % 2 ? pal[1] : pal[2]; g.fillRect(i * bw + 2, h - v * h * 0.55, bw - 4, v * h * 0.55);
    }
    g.strokeStyle = pal[2]; g.lineWidth = 3; g.globalAlpha = 1 - ph;
    g.beginPath(); g.arc(w / 2, h * 0.38, h * (0.12 + 0.25 * ph), 0, 7); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = pal[2]; g.beginPath(); g.arc(w / 2, h * 0.38, h * 0.08 * (1 + 0.15 * (1 - ph)), 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = F(h * 0.07, true); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.video.title || p.name, w / 2, h * 0.08);
  };

  SC.blue = function (g, w, h, t) {
    g.fillStyle = '#0a2a9a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = F(h * 0.07, true); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('نوار تصویری ندارد / بدون سیگنال', w / 2, h / 2);
  };

  BZ.video = {
    scenes: SC,
    // برنامه‌ای مجازی را در لحظهٔ محتوای t روی بوم می‌کشد
    draw(g, w, h, prog, t) {
      const fn = SC[prog.video.scene] || SC.testcard;
      g.save(); g.globalAlpha = 1; fn(g, w, h, t, prog); g.restore();
    },
    // جلوه‌های پیکسلی: اشباع، روشنایی، تضاد، فام، برف و نوار VHS
    fx(img, o) {
      const d = img.data, W = img.width, H = img.height, n = d.length;
      const sat = o.sat, br = o.bright, ct = o.contrast, tint = o.tint || 0, snow = o.snow || 0;
      const t = o.vhs, bandY0 = t ? Math.floor(((o.time * 0.17) % 1) * H) : -1, bandH = t ? Math.floor(H * 0.12 * t.track) : 0;
      for (let i = 0; i < n; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        r = y + (r - y) * sat; g = y + (g - y) * sat; b = y + (b - y) * sat;
        if (tint) { r += tint * 40; b -= tint * 40; }
        r = (r - 128) * ct + 128 + br; g = (g - 128) * ct + 128 + br; b = (b - 128) * ct + 128 + br;
        let nz = snow ? (Math.random() - 0.5) * 255 * snow * 1.7 : 0;
        if (t) {
          const row = ((i >> 2) / W) | 0;
          if (bandH && row >= bandY0 && row < bandY0 + bandH) nz += (Math.random() - 0.35) * 255 * 1.1;
          if (row > H - 5) nz += (Math.random() - 0.5) * 255 * 0.8; // کلید سر
          if (t.wear > 0 && Math.random() < t.wear * 0.0004) nz += 255;
        }
        d[i] = r + nz; d[i + 1] = g + nz; d[i + 2] = b + nz;
      }
    },
  };
})();
