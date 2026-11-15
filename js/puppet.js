/* puppet.js — رسم عروسک (اسکلت دو‌بندی، پلک، ابرو، ویزم) و گیاه (باد، رشد، پژمردگی)
   مدل‌ها: بازوی دو‌مفصلی (FK)، تنفس، پلک‌زدن، حرکت لب از ویزم، تکان گیاه با ترکیب نوسان‌های باد. */
(function () {
  'use strict';
  const BZ = window.BZ, clamp = BZ.clamp;

  // ---------- رنگ ----------
  const hex = (c) => { c = String(c || '#888').replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return [parseInt(c.slice(0, 2), 16) || 0, parseInt(c.slice(2, 4), 16) || 0, parseInt(c.slice(4, 6), 16) || 0]; };
  const rgb = (a) => 'rgb(' + a.map((v) => Math.round(clamp(v, 0, 255))).join(',') + ')';
  const shade = (c, k) => { const a = hex(c); return rgb(k >= 0 ? a.map((v) => v + (255 - v) * k) : a.map((v) => v * (1 + k))); };
  const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return rgb(a.map((v, i) => v + (b[i] - v) * t)); };
  BZ.color = { shade, mix };

  const EMO = {
    neutral: { bA: 0, bY: 0, sm: 0.2, eo: 1 }, happy: { bA: -0.1, bY: -2, sm: 1, eo: 0.85 }, sad: { bA: -0.45, bY: 1, sm: -0.7, eo: 0.8 },
    angry: { bA: 0.5, bY: 2, sm: -0.5, eo: 0.75 }, surprised: { bA: 0, bY: -7, sm: 0, eo: 1.3 }, thinking: { bA: -0.2, bY: -3, sm: 0, eo: 0.9, asym: 1 },
  };
  BZ.EMOTIONS = { neutral: 'عادی', happy: 'شاد', sad: 'غمگین', angry: 'عصبانی', surprised: 'متعجب', thinking: 'متفکر' };

  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); }

  // ---------- چهره ----------
  function face(g, c, hx, hy, hr, P) {
    const E = EMO[P.emo] || EMO.neutral, V = BZ.speech.VOW[P.vis] || BZ.speech.VOW.e, t = P.t || 0, seed = c.seed || 0;
    const gap = hr * (0.34 + 0.2 * (c.eyeGap == null ? 0.5 : c.eyeGap)), er = hr * (0.14 + 0.16 * (c.eyes == null ? 0.5 : c.eyes)), ey = hy - hr * 0.12;
    const ph = (t * 0.55 + seed * 0.37) % 3.6, blink = ph < 0.13 ? Math.sin((ph / 0.13) * Math.PI) : 0;
    const eo = E.eo * (1 - 0.95 * blink) * (P.sleep ? 0.05 : 1);
    [-1, 1].forEach((sgn) => {
      const ex = hx + sgn * gap;
      g.fillStyle = '#fff'; ell(g, ex, ey, er, Math.max(0.8, er * eo * 1.05)); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
      if (eo > 0.25) {
        const lx = (P.look || 0) * er * 0.35 + Math.sin(t * 0.7 + sgn) * er * 0.08;
        g.fillStyle = '#1a1a22'; ell(g, ex + lx, ey, er * 0.5, Math.min(er * 0.5, er * eo * 0.9)); g.fill();
        g.fillStyle = '#fff'; ell(g, ex + lx - er * 0.15, ey - er * 0.15, er * 0.14, er * 0.14); g.fill();
      }
      const bw = er * 1.15, by = ey - er * 1.5 + E.bY + (E.asym && sgn > 0 ? -4 : 0);
      g.strokeStyle = '#2a1a14'; g.lineWidth = Math.max(1.5, hr * 0.06); g.lineCap = 'round';
      g.beginPath(); g.moveTo(ex - sgn * bw, by + E.bA * bw); g.lineTo(ex + sgn * bw, by - E.bA * bw * 0.4); g.stroke();
    });
    if (E.sm > 0.6) { g.fillStyle = 'rgba(255,90,120,.28)'; [-1, 1].forEach((s) => { ell(g, hx + s * gap * 1.25, hy + hr * 0.28, hr * 0.14, hr * 0.09); g.fill(); }); }
    const my = hy + hr * 0.42, mw = hr * 0.34;
    if (P.open > 0.06) {
      const w = mw * (0.65 + 0.55 * V.mw), hh = Math.max(1.2, hr * 0.4 * V.mh * P.open);
      g.fillStyle = '#3a0d12'; ell(g, hx, my + hh * 0.2, w, hh); g.fill();
      g.strokeStyle = c.mouth || '#7a2030'; g.lineWidth = Math.max(1.2, hr * 0.045); g.stroke();
      if (P.vis === 'a' && P.open > 0.4) { g.fillStyle = '#c85a6a'; ell(g, hx, my + hh * 0.6, w * 0.55, hh * 0.35); g.fill(); }
    } else {
      g.strokeStyle = '#3a1a1a'; g.lineWidth = Math.max(1.5, hr * 0.05);
      g.beginPath(); g.moveTo(hx - mw, my); g.quadraticCurveTo(hx, my + E.sm * hr * 0.3, hx + mw, my); g.stroke();
    }
  }

  // ---------- بازوی دو‌مفصلی ----------
  function arm(g, sx, sy, side, a1, a2, L1, L2, w, col, hand) {
    const x1 = sx + side * Math.sin(a1) * L1, y1 = sy + Math.cos(a1) * L1, a = a1 + a2;
    const x2 = x1 + side * Math.sin(a) * L2, y2 = y1 + Math.cos(a) * L2;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.fillStyle = hand; g.beginPath(); g.arc(x2, y2, w * 0.65, 0, Math.PI * 2); g.fill();
    return [x2, y2];
  }
  function armAngles(side, act, t, wph, G) {
    let a1 = 0.28 + 0.05 * Math.sin(t * 1.3 + side), a2 = -0.15;
    if (act === 'walk') { a1 = 0.35 + 0.7 * Math.sin(wph + (side > 0 ? 0 : Math.PI)); a2 = -0.25; }
    if (side > 0) {
      if (act === 'wave') { a1 = 2.5 + 0.3 * Math.sin(t * 9); a2 = -0.4; }
      else if (act === 'eat') { a1 = 1.9 + 0.1 * Math.sin(t * 6); a2 = -1.2; }
      else if (act === 'water') { a1 = 1.5; a2 = 0; }
      else if (act === 'think') { a1 = 2.0; a2 = -1.6; }
      else if (G > 0) { a1 += G * (0.6 + 0.8 * Math.max(0, Math.sin(t * 5.3))); a2 = -0.5 * G; }
    }
    if (act === 'dance') { a1 = 2.2 + 0.5 * Math.sin(t * 5 + side); a2 = -0.3; }
    return [a1, a2];
  }

  function ears(g, c, hx, hy, hr, col, acc, t) {
    g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
    const sw = Math.sin(t * 2) * 2;
    if (c.ears === 'cat') [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(hx + s * hr * 0.9, hy - hr * 0.4); g.lineTo(hx + s * hr * 0.75, hy - hr * 1.45); g.lineTo(hx + s * hr * 0.2, hy - hr * 0.95); g.closePath(); g.fill(); g.stroke(); g.fillStyle = acc; g.beginPath(); g.moveTo(hx + s * hr * 0.75, hy - hr * 0.75); g.lineTo(hx + s * hr * 0.72, hy - hr * 1.2); g.lineTo(hx + s * hr * 0.4, hy - hr * 0.9); g.fill(); g.fillStyle = col; });
    else if (c.ears === 'bunny') [-1, 1].forEach((s) => { ell(g, hx + s * hr * 0.45 + sw * s, hy - hr * 1.5, hr * 0.22, hr * 0.7, s * 0.15); g.fill(); g.stroke(); g.fillStyle = acc; ell(g, hx + s * hr * 0.45 + sw * s, hy - hr * 1.5, hr * 0.1, hr * 0.5, s * 0.15); g.fill(); g.fillStyle = col; });
    else if (c.ears === 'antenna') { g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy - hr * 1.0); g.lineTo(hx + sw, hy - hr * 1.6); g.stroke(); g.fillStyle = acc; g.beginPath(); g.arc(hx + sw, hy - hr * 1.65, hr * 0.14, 0, 7); g.fill(); }
    else if (c.ears === 'tuft') { g.strokeStyle = acc; g.lineWidth = 3; g.lineCap = 'round'; [-0.4, 0, 0.4].forEach((a) => { g.beginPath(); g.moveTo(hx + a * hr * 0.6, hy - hr * 0.95); g.lineTo(hx + a * hr * 1.3 + sw * a, hy - hr * 1.45); g.stroke(); }); }
  }

  // ---------- عروسک ----------
  function puppet(g, c, P) {
    const col = c.color || '#e8903a', acc = c.accent || '#7a3b1a', t = P.t || 0, seed = c.seed || 0;
    const sc = (P.s || 1) * (c.size || 1), dir = P.dir || 1, act = P.act || 'idle', wph = P.ph || 0;
    const walking = act === 'walk';
    const bob = walking ? Math.abs(Math.sin(wph)) * 5 : 0;
    const jump = act === 'dance' ? Math.abs(Math.sin(t * 5)) * 12 : act === 'jump' ? Math.abs(Math.sin(t * 7)) * 14 : 0;
    const breathe = 1 + 0.015 * Math.sin(t * 1.7 + seed);
    g.save(); g.translate(P.x, P.y - (bob + jump) * sc); g.rotate(P.rot || 0); g.scale(sc * dir, sc * breathe);
    const body = c.body || 'sock'; let hx = 0, hy = -68, hr = 26, sx = 26, sy = -50, ac = col;
    g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.lineJoin = 'round';
    const feet = (y, w2) => { g.fillStyle = acc; [-1, 1].forEach((s, k) => { const lift = walking ? Math.max(0, Math.sin(wph + k * Math.PI)) * 4 : 0; ell(g, s * 14, y - lift, w2, 6); g.fill(); g.stroke(); }); g.fillStyle = col; };
    if (body === 'sock') {
      g.beginPath(); g.moveTo(-27, 0); g.lineTo(-27, -70); g.quadraticCurveTo(-27, -98, 0, -98); g.quadraticCurveTo(27, -98, 27, -70); g.lineTo(27, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = acc; g.fillRect(-27, -34, 54, 9); g.fillStyle = col; hy = -68; hr = 26; sx = 27; sy = -50;
    } else if (body === 'ball') {
      feet(-3, 11); ell(g, 0, -46, 44, 44); g.fill(); g.stroke(); hy = -50; hr = 40; sx = 42; sy = -38;
    } else if (body === 'box') {
      feet(-3, 11);
      g.fillStyle = acc; g.beginPath(); g.rect(-24, -62, 48, 56); g.fill(); g.stroke();
      g.fillStyle = col; g.beginPath(); g.rect(-30, -120, 60, 56); g.fill(); g.stroke();
      g.fillStyle = shade(acc, 0.3); g.fillRect(-10, -50, 20, 14); hy = -93; hr = 26; sx = 24; sy = -54; ac = acc;
    } else {
      g.beginPath(); g.ellipse(0, -24, 38, 24, 0, 0, 7); g.fill(); g.stroke(); ell(g, 0, -70, 34, 34); g.fill(); g.stroke(); hy = -68; hr = 30; sx = 30; sy = -42;
    }
    const G = P.gest || 0;
    [-1, 1].forEach((side) => { const [a1, a2] = armAngles(side, act, t, wph, G); arm(g, side * sx, sy, side, a1, a2, 22, 20, 8, ac, shade(col, 0.15)); });
    if (c.ears && c.ears !== 'none') ears(g, c, hx, hy, hr, col, acc, t);
    face(g, c, hx, hy, hr, P);
    g.restore();
  }

  // ---------- گیاه ----------
  function pot(g, col) {
    g.fillStyle = col; g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.lineTo(30, -34); g.lineTo(-30, -34); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = shade(col, -0.15); g.fillRect(-33, -40, 66, 9); g.strokeRect(-33, -40, 66, 9);
    g.fillStyle = '#3b2615'; ell(g, 0, -40, 29, 4); g.fill();
  }
  const qb = (p0, c, p1, u) => (1 - u) * (1 - u) * p0 + 2 * (1 - u) * u * c + u * u * p1;

  function plant(g, c, P) {
    const sp = c.species || 'flower', t = P.t || 0, seed = c.seed || 0, grow = clamp(P.grow == null ? 1 : P.grow, 0.1, 1), wilt = clamp(P.wilt || 0, 0, 1);
    const sc = (P.s || 1) * (c.size || 1), pcol = c.accent || '#c9673a';
    const wind = (Math.sin(t * 0.9 + seed) * 0.5 + Math.sin(t * 2.3 + seed * 2) * 0.25 + Math.sin(t * 0.37) * 0.25) * (P.wind == null ? 1 : P.wind);
    const wig = P.act === 'dance' ? Math.sin(t * 6) * 0.8 : P.act === 'jump' ? Math.sin(t * 7) * 0.5 : 0;
    const green = mix(sp === 'flower' ? '#3f9b55' : (c.color || '#3f9b55'), '#8a7a3a', wilt * 0.8);
    g.save(); g.translate(P.x, P.y); g.scale(sc, sc); g.lineCap = 'round'; g.lineJoin = 'round';
    pot(g, pcol);
    const w = wind + wig + (P.open || 0) * 0.15 * Math.sin(t * 18);
    if (sp === 'flower') {
      const H = 40 + 80 * grow, bend = w * 10 * grow + wilt * 40;
      const x1 = bend, y1 = -40 - H + wilt * 25, cx = bend * 0.2;
      g.strokeStyle = green; g.lineWidth = 5; g.beginPath(); g.moveTo(0, -40); g.quadraticCurveTo(cx, -40 - H * 0.5, x1, y1); g.stroke();
      [0.35, 0.6].forEach((u, k) => { const lx = qb(0, cx, x1, u), ly = qb(-40, -40 - H * 0.5, y1, u), s = k ? 1 : -1; g.fillStyle = green; ell(g, lx + s * 10 * grow, ly, 12 * grow + 3, 5 * grow + 2, s * (0.6 + wilt * 0.8)); g.fill(); });
      const R = 14 + 14 * grow, pc = mix(c.color || '#ff5d8f', '#7a6a3a', wilt * 0.7);
      g.save(); g.translate(x1, y1); g.rotate(wilt * 0.6);
      for (let k = 0; k < 9; k++) { const a = (k * Math.PI * 2) / 9; g.save(); g.rotate(a); g.fillStyle = pc; ell(g, R * 0.75, 0, R * 0.5 * (1 - wilt * 0.3), R * 0.28); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.stroke(); g.restore(); }
      g.fillStyle = mix('#ffd23f', '#8a7a3a', wilt * 0.6); g.beginPath(); g.arc(0, 0, R * 0.62, 0, 7); g.fill();
      face(g, c, 0, 0, R * 0.62, P); g.restore();
    } else if (sp === 'cactus') {
      const bh = 34 + 66 * grow, bw = 20 + 7 * grow, sk = (w * 0.05) * grow + wilt * 0.12;
      g.save(); g.translate(0, -40); g.transform(1, 0, sk, 1, 0, 0);
      g.fillStyle = green; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-bw, 0); g.lineTo(-bw, -bh + bw); g.arc(0, -bh + bw, bw, Math.PI, 0); g.lineTo(bw, 0); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = shade(green, 0.25); g.lineWidth = 2; [-0.5, 0.5].forEach((k) => { g.beginPath(); g.moveTo(k * bw, -4); g.lineTo(k * bw, -bh + bw * 0.6); g.stroke(); });
      if (grow > 0.5) { g.strokeStyle = green; g.lineWidth = 11; g.beginPath(); g.moveTo(bw * 0.8, -bh * 0.4); g.lineTo(bw + 14, -bh * 0.4); g.lineTo(bw + 14, -bh * 0.7); g.stroke(); }
      if (grow > 0.88) { g.fillStyle = mix('#ff6fa5', '#8a7a3a', wilt); [0, 1, 2, 3, 4].forEach((k) => { g.save(); g.translate(0, -bh - 3); g.rotate(k * 1.256); ell(g, 0, -6, 4, 6); g.fill(); g.restore(); }); }
      face(g, c, 0, -bh * 0.55, bw * 0.78, P);
      g.restore();
    } else if (sp === 'fern') {
      const n = 7 + Math.floor(5 * grow), L = 26 + 52 * grow;
      for (let i = 0; i < n; i++) {
        const ang = (i / (n - 1) - 0.5) * 2.5 + w * 0.08 * (i % 2 ? 1 : -0.6), ex = Math.sin(ang) * L * 0.95, ey = -40 - Math.cos(ang) * L * 0.75 + wilt * 30, cx = Math.sin(ang) * L * 0.5, cy = -40 - Math.cos(ang) * L * 0.7;
        g.strokeStyle = green; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -40); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
        g.lineWidth = 2; for (let u = 0.25; u < 0.98; u += 0.15) { const px = qb(0, cx, ex, u), py = qb(-40, cy, ey, u), l = 8 * (1 - u * 0.5); g.beginPath(); g.moveTo(px - l, py + l * 0.3); g.lineTo(px, py); g.lineTo(px + l, py + l * 0.3); g.stroke(); }
      }
      face(g, c, 0, -17, 14, P);
    } else { // tree
      const H = 30 + 40 * grow, R = 16 + 14 * grow, bx = w * 5 * grow;
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, -40); g.quadraticCurveTo(bx * 0.4, -40 - H * 0.5, bx, -40 - H); g.stroke();
      const cc = mix(c.color || '#4f9a3f', '#9a8a3a', wilt * 0.8), cy = -40 - H - R * 0.4;
      g.fillStyle = cc; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5;
      [[-R * 0.7, 0, 0.8], [R * 0.7, 0, 0.8], [0, -R * 0.4, 1], [0, R * 0.3, 0.85]].forEach(([dx, dy, k]) => { g.beginPath(); g.arc(bx + dx, cy + dy, R * k, 0, 7); g.fill(); g.stroke(); });
      face(g, c, bx, cy + 2, R * 0.85, P);
    }
    g.restore();
  }

  BZ.char = {
    draw(g, c, P) { if (c && c.type === 'plant') plant(g, c, P); else puppet(g, c || { body: 'ball' }, P); },
  };
})();
