/* worlds.js — «جهان‌های تو در تو»: آینه = تلویزیون
   منطق فلوچارت: ۰ ← ۱ ← ۲ ← ۸ ← ۱۶ ← ۲۶ ← ۳۸ ← ۵۲ (a(n)=n²+5n+2). هر عدد = تعداد خط‌های پویش (ردیف‌های شطرنجی) تلویزیونی که یک جهان را نشان می‌دهد.
   یک عروسک واحد (ربات) در همهٔ جهان‌هاست؛ هر جهان مدل خودش را دارد (گرانش سیاره‌ای، آسمان، نور) و تصویر عروسک را با پیکسل‌های خودش می‌سازد.
   زنجیرهٔ تصویر (علم تلویزیون):  صحنه ← نمونه‌برداری با فیلتر پیش‌پخش (میانگین‌گیری جعبه‌ای، ضد‌نام‌همپوشانی) روی شبکهٔ خط × ستون (۴:۳)
        ← نمایش روی صفحهٔ یک تلویزیون در جهان بیرونی (بزرگ‌نمایی نزدیک‌ترین‌همسایه + ماسک خط‌های پویش) ← جهان بیرونی هم دوباره نمونه‌برداری می‌شود...
   پس جزئیات هر تلویزیون درونی هرگز از شبکهٔ خارجی بهتر نمی‌شود (اثر دروست/بازخورد تصویر). پهنای باند لازم هر مرحله: B ≈ ستون×خط×fps/2.
   فیزیک: همان فرمان پرش (v₀) به همهٔ جهان‌ها می‌رسد؛ هر جهان با گرانش خودش y'' = −g را انتگرال می‌گیرد (زمان پرواز 2v₀/g).
   رادیو: صدای عروسک (TTS آفلاین) از «گیرندهٔ» جهان انتخابی می‌گذرد: باند صوتی و نویز از پهنای باند همان مرحله می‌آید. */
(function () {
  'use strict';
  const BZ = window.BZ, h = BZ.h;
  const LINES = [1, 2, 8, 16, 26, 38, 52];                     // = [آینه] + a(0..5)
  const V0 = 1.9, FPS = 25, DT = 1 / 120, CMD_EVERY = 3.4;
  // جهان‌ها: گرانش واقعی سطح (m/s²) و مدل ظاهری
  const WORLDS = [
    { id: 1, name: 'فوتوسل (یک نقطه)', g: 9.81, sky: ['#bfe3ff', '#e9f6ff'], ground: '#6a8f5a', sun: '#fff2a0', refl: 0.02 },
    { id: 2, name: 'پلوتو', g: 0.62, sky: ['#05060d', '#141a30'], ground: '#cfd9e6', sun: '#fff', stars: 1, refl: 0.0, big: '#b99' },
    { id: 3, name: 'ماه', g: 1.62, sky: ['#000', '#0a0a12'], ground: '#8d8d92', sun: '#fff', stars: 1, refl: 0.0, big: '#4a82d8' },
    { id: 4, name: 'مریخ', g: 3.71, sky: ['#c9835a', '#efc8a0'], ground: '#a2492c', sun: '#ffe8c0', refl: 0.0 },
    { id: 5, name: 'تیتان', g: 1.35, sky: ['#b0701c', '#e6b44e'], ground: '#4a3a24', sun: '#ffcf7a', refl: 0.35, lake: 1 },
    { id: 6, name: 'ونوس', g: 8.87, sky: ['#d8a53a', '#f2d276'], ground: '#5a4128', sun: '#fff0b0', refl: 0.05 },
    { id: 7, name: 'زمین', g: 9.81, sky: ['#58b0ee', '#dff3ff'], ground: '#3f9a52', sun: '#fff6b0', refl: 0.12, lake: 1 },
  ];
  const REAL = { id: 0, name: 'جهان واقعی (ورود ۰)', g: 9.81 };
  const faNum = (n) => (BZ.pyr ? BZ.pyr.faNum(n) : String(n)), enNum = (n) => (BZ.pyr ? BZ.pyr.enNum(n) : String(n));
  const colsOf = (L) => Math.max(1, Math.round(L * 4 / 3));
  const bandwidth = (L) => colsOf(L) * L * FPS / 2;               // هرتز: بیشینهٔ بسامد فضایی-زمانی = نصف نرخ پیکسل

  // ---------- فیزیک مشترک: یک فرمان، چند گرانش ----------
  function Body(g) { return { g, y: 0, vy: 0, air: false, flights: [], t0: 0 }; }
  function bodyStep(b, dt, t) {
    if (!b.air) return;
    b.vy -= b.g * dt; b.y += b.vy * dt;                           // y'' = −g
    if (b.y <= 0) { b.y = 0; b.vy = 0; b.air = false; b.flights.push(t - b.t0); if (b.flights.length > 6) b.flights.shift(); }
  }
  function bodyJump(b, v0, t) { if (!b.air) { b.air = true; b.vy = v0; b.y = 1e-6; b.t0 = t; } }
  // شبیه‌سازی بدون رابط برای آزمون: زمان پرواز اندازه‌گیری‌شده در هر جهان
  function flightTimes() {
    return WORLDS.map((w) => { const b = Body(w.g); bodyJump(b, V0, 0); let t = 0; while (b.air && t < 60) { t += 1 / 960; bodyStep(b, 1 / 960, t); } return { id: w.id, g: w.g, meas: t, theory: 2 * V0 / w.g }; });
  }

  // ---------- رسم صحنهٔ هر جهان ----------
  function sky(g, w, h, W, t) {
    const q = g.createLinearGradient(0, 0, 0, h * 0.8); q.addColorStop(0, W.sky[0]); q.addColorStop(1, W.sky[1]); g.fillStyle = q; g.fillRect(0, 0, w, h);
    if (W.stars) { const r = BZ.rng(W.id * 77); g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h * 0.7, 1, 1); }
    g.fillStyle = W.sun; g.beginPath(); g.arc(w * 0.18, h * 0.16, h * (W.id === 2 ? 0.015 : 0.05), 0, 7); g.fill();
    if (W.big) { g.fillStyle = W.big; g.beginPath(); g.arc(w * 0.3, h * 0.3, h * 0.07, 0, 7); g.fill(); }
    if (W.id === 7) { g.fillStyle = 'rgba(255,255,255,.8)'; [[0.3, 0.25], [0.6, 0.15]].forEach(([x, y]) => { g.beginPath(); g.ellipse(w * x + Math.sin(t * 0.2) * 6, h * y, h * 0.1, h * 0.035, 0, 0, 7); g.fill(); }); }
  }
  function ground(g, w, h, W) {
    const gy = h * 0.8; g.fillStyle = W.ground; g.fillRect(0, gy, w, h - gy);
    if (W.lake) { const q = g.createLinearGradient(0, gy, 0, h); q.addColorStop(0, 'rgba(60,110,170,.55)'); q.addColorStop(1, 'rgba(30,60,110,.85)'); g.fillStyle = q; g.fillRect(0, gy, w, h - gy); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, gy, w, 1);
  }
  function tvObject(g, x, y, w, hgt, child, t, puppetRefl) {
    g.fillStyle = '#241c14'; g.fillRect(x - 4, y - 4, w + 8, hgt + 8);
    g.fillStyle = '#000'; g.fillRect(x, y, w, hgt);
    if (child) { g.imageSmoothingEnabled = false; g.drawImage(child, x, y, w, hgt); g.imageSmoothingEnabled = true; }
    // ماسک خط‌های پویش (ردیف‌های تاریک بین خط‌ها)
    if (child) { const ln = child.height, step = hgt / ln; if (step >= 2) { g.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < ln; i++) g.fillRect(x, y + i * step + step * 0.72, w, step * 0.28); } }
    // بازتاب شیشه (تقریباً ۴٪ بازتاب فرنل در راستای عمود)
    const gl = g.createLinearGradient(x, y, x + w, y + hgt); gl.addColorStop(0, 'rgba(255,255,255,.12)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.04)'); g.fillStyle = gl; g.fillRect(x, y, w, hgt);
    if (puppetRefl) puppetRefl(g, x, y, w, hgt);
  }
  // رسم یک جهان (۱..۷) روی بوم داخلی با پیکسل خودش
  function drawWorld(g, w, h, W, body, P, child, t) {
    sky(g, w, h, W, t); ground(g, w, h, W);
    // تلویزیون درونی (آینه): کوچک‌تر و بالا-راست؛ جهان قبلی را نشان می‌دهد
    if (child) tvObject(g, w * 0.4, h * 0.06, w * 0.56, h * 0.5, child, t);
    // عروسک: x مشترک ← ستون جهان؛ ارتفاع از فیزیک جهان
    const ppm = h / 4, gy = h * 0.8, x = w * (0.1 + 0.34 * P.x), y = gy - body.y * ppm, s = (ppm * 1.0) / 125 * 1.0;
    // سایه و بازتاب: ذره‌ای نرم؛ بازتاب فرنل (R₀ به مادهٔ سطح بستگی دارد)
    const sh = Math.max(0.35, 1 - body.y * 0.25);
    g.fillStyle = 'rgba(0,0,0,' + (0.3 * sh) + ')'; g.beginPath(); g.ellipse(x - (W.id === 2 ? 5 : 0) + 6, gy + 2, ppm * 0.32 * sh, ppm * 0.07, 0, 0, 7); g.fill();
    BZ.char.draw(g, BZ.lib.char('c_robot'), { x, y, s, dir: P.dir, emo: P.emo, open: P.mouth.open, vis: P.mouth.v, t, act: body.air ? 'jump' : '', look: 0.2, grow: 1 });
    if (W.refl > 0) {
      g.save(); g.globalAlpha = W.refl; g.beginPath(); g.rect(0, gy, w, h - gy); g.clip(); g.translate(0, 2 * gy); g.scale(1, -1);
      BZ.char.draw(g, BZ.lib.char('c_robot'), { x, y, s, dir: P.dir, emo: P.emo, open: P.mouth.open, vis: P.mouth.v, t, act: '', look: 0.2, grow: 1 }); g.restore();
    }
  }

  // ================= رابط =================
  BZ.worldsPanel = function () {
    const CW = 560, CH = 960, SW = 192, SH = 144;
    const cv = BZ.cv(CW, CH, 'scope'), g = cv.getContext('2d');
    const scn = [], ras = [], mids = [];
    for (let i = 0; i < 7; i++) { scn.push(BZ.cv(SW, SH)); const L = LINES[i]; ras.push(BZ.cv(colsOf(L), L)); }
    const bodies = [Body(REAL.g)].concat(WORLDS.map((w) => Body(w.g)));
    const P = { x: 0.2, dir: 1, emo: 'neutral', mouth: { open: 0, v: 'e' } };
    let lang = 'fa', listen = 7, talk = true, speed = 1, tt = 0, lastCmd = 0, last = 0, acc = 0, auto = true;
    const spk = { q: [], plan: null, start: 0 };

    function ctxOk() { return BZ.audio.init() && BZ.audio.ctx; }
    // رادیو: باند صوتی و نویز از پهنای باند تصویر همان مرحله
    function speak(text, em) {
      if (!ctxOk()) return;
      const ctx = BZ.audio.ctx, L = listen === 0 ? 52 : LINES[listen - 1], frac = Math.min(1, L / 52);
      const say = { t: text, sp: 1, f0: 120, vt: 1.08, em: em || 'neutral', rob: true }, plan = BZ.speech.plan(text, 1), buf = BZ.speech.buffer(ctx, say);
      const at = Math.max(ctx.currentTime + 0.03, spk.plan ? spk.start + spk.plan.dur + 0.15 : ctx.currentTime);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180 + (1 - frac) * 220;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + frac * 7300; lp.Q.value = 0.7;
      const gn = ctx.createGain(); gn.gain.value = 0.9; src.connect(hp); hp.connect(lp); lp.connect(gn); gn.connect(BZ.audio.master); src.start(at);
      // نویز گیرنده: هرچه خط‌های کمتر ← SNR کمتر
      const nlen = Math.ceil((plan.dur + 0.3) * ctx.sampleRate), nb = ctx.createBuffer(1, nlen, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
      const ns = ctx.createBufferSource(); ns.buffer = nb; const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 700 + frac * 7300; const ng = ctx.createGain(); ng.gain.value = (1 - frac) * 0.05; ns.connect(nf); nf.connect(ng); ng.connect(BZ.audio.master); ns.start(at);
      spk.q.push({ at, plan, srcs: [src, ns] }); spk.plan = plan; spk.start = at;
    }
    function stopSpeech() { spk.q.forEach((s) => s.srcs.forEach((x) => { try { x.stop(); } catch (e) { /* ok */ } })); spk.q = []; spk.plan = null; }
    function mouth() {
      if (!BZ.audio.ctx) return { open: 0, v: 'e' };
      const now = BZ.audio.ctx.currentTime; spk.q = spk.q.filter((s) => now < s.at + s.plan.dur + 0.4);
      for (const s of spk.q) if (now >= s.at && now < s.at + s.plan.dur) return BZ.speech.mouthAt(s.plan.syl, now - s.at);
      return { open: 0, v: 'e' };
    }
    const TXT = {
      fa: {
        hello: 'سلام! من یک عروسک هستم. سایه من روی آینهٔ تلویزیون می‌افتد و در هر تلویزیون یک جهان تازه ساخته می‌شود.',
        rule: 'هر جهان تصویر مرا با پیکسل‌های خودش می‌سازد: یک، دو، هشت، شانزده، بیست و شش، سی و هشت و پنجاه و دو خط.',
        world: (i) => 'جهان شمارهٔ ' + faNum(i) + '. ' + WORLDS[i - 1].name + '. تصویر ' + faNum(LINES[i - 1]) + ' خط.',
      },
      en: {
        hello: 'Hello! I am a puppet. My shadow falls on the television mirror, and every television builds a new world.',
        rule: 'Each world draws me with its own pixels: one, two, eight, sixteen, twenty six, thirty eight and fifty two lines.',
        world: (i) => 'World number ' + enNum(i) + '. ' + ['photocell', 'Pluto', 'the Moon', 'Mars', 'Titan', 'Venus', 'Earth'][i - 1] + '. The picture has ' + enNum(LINES[i - 1]) + ' lines.',
      },
    };

    // ----- حلقهٔ فیزیک و رسم -----
    function step(dt) {
      dt = Math.min(dt, 0.05) * speed; acc += dt;
      while (acc >= DT) {
        acc -= DT; tt += DT;
        // فرمان مشترک: راه رفتن رفت‌وبرگشتی + پرش هر CMD_EVERY ثانیه
        P.x += P.dir * 0.12 * DT; if (P.x > 1) { P.x = 1; P.dir = -1; } if (P.x < 0) { P.x = 0; P.dir = 1; }
        if (auto && tt - lastCmd >= CMD_EVERY) { lastCmd = tt; bodies.forEach((b) => bodyJump(b, V0, tt)); }
        bodies.forEach((b) => bodyStep(b, DT, tt));
      }
      P.mouth = mouth(); P.emo = P.mouth.open > 0.05 ? 'happy' : 'neutral';
    }
    function render(t) {
      // از ۱ تا ۷: هر جهان صحنهٔ خودش را با تلویزیون جهان قبلی می‌سازد، سپس نمونه‌برداری می‌شود
      for (let i = 0; i < 7; i++) {
        const sg = scn[i].getContext('2d'); drawWorld(sg, SW, SH, WORLDS[i], bodies[i + 1], P, i > 0 ? ras[i - 1] : null, t);
        const rg = ras[i].getContext('2d'); rg.imageSmoothingEnabled = true; rg.imageSmoothingQuality = 'high';
        // فیلتر پیش‌نمونه‌برداری: کوچک‌سازی چندمرحله‌ای (میانگین‌گیری) برای جلوگیری از نام‌همپوشانی
        let src = scn[i], w = SW, hh = SH; const tw = ras[i].width, th = ras[i].height;
        if (w / tw > 2.2) { const mid = mids[i] || (mids[i] = BZ.cv(Math.max(tw, Math.round(w / 2)), Math.max(th, Math.round(hh / 2)))); const mg = mid.getContext('2d'); mg.clearRect(0, 0, mid.width, mid.height); mg.imageSmoothingQuality = 'high'; mg.drawImage(src, 0, 0, mid.width, mid.height); src = mid; }
        rg.drawImage(src, 0, 0, tw, th);
      }
      // ---- جهان واقعی (۰): اتاق، تلویزیون بزرگ با خروجی جهان ۷ ----
      const RH = 430; g.fillStyle = '#12100e'; g.fillRect(0, 0, CW, CH);
      const wq = g.createLinearGradient(0, 0, 0, RH); wq.addColorStop(0, '#2a2118'); wq.addColorStop(1, '#3a2c1e'); g.fillStyle = wq; g.fillRect(0, 0, CW, RH);
      g.fillStyle = '#1b1510'; g.fillRect(0, RH * 0.82, CW, RH * 0.18);
      g.fillStyle = '#e9c97a'; g.font = 'bold 15px ' + BZ.FONT; g.textAlign = 'center'; g.fillText('جهان ۰ — ورود (واقعی)  •  آینه = تلویزیون', CW / 2, 22);
      const tx = 120, ty = 44, tw = 320, th = 240;
      tvObject(g, tx, ty, tw, th, ras[6], t, (gx, x, y, w, hh) => {
        // بازتاب ضعیف عروسک واقعی روی شیشه (≈۴٪)
        gx.save(); gx.beginPath(); gx.rect(x, y, w, hh); gx.clip(); gx.globalAlpha = 0.07;
        const ppm0 = 150, bx = CW * (0.12 + 0.76 * P.x), by = RH * 0.82 - bodies[0].y * ppm0;
        BZ.char.draw(gx, BZ.lib.char('c_robot'), { x: x + w * (0.2 + 0.6 * P.x), y: y + hh * 0.95, s: 1.4, dir: -P.dir, emo: P.emo, open: P.mouth.open, vis: P.mouth.v, t, grow: 1 }); gx.restore();
      });
      // پایهٔ تلویزیون
      g.fillStyle = '#2b2118'; g.fillRect(tx + 40, ty + th + 4, tw - 80, 10);
      const ppm0 = 150, gy0 = RH * 0.82, bx = CW * (0.12 + 0.76 * P.x), by = gy0 - bodies[0].y * ppm0, sh0 = Math.max(0.35, 1 - bodies[0].y * 0.25);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(bx + 14, gy0 + 4, 40 * sh0, 8 * sh0, 0, 0, 7); g.fill();
      BZ.char.draw(g, BZ.lib.char('c_robot'), { x: bx, y: by, s: ppm0 / 125, dir: P.dir, emo: P.emo, open: P.mouth.open, vis: P.mouth.v, t, act: bodies[0].air ? 'jump' : '', look: 0.2, grow: 1 });
      g.save(); g.globalAlpha = 0.15; g.beginPath(); g.rect(0, gy0, CW, RH - gy0); g.clip(); g.translate(0, 2 * gy0); g.scale(1, -1);
      BZ.char.draw(g, BZ.lib.char('c_robot'), { x: bx, y: by, s: ppm0 / 125, dir: P.dir, emo: P.emo, open: P.mouth.open, vis: P.mouth.v, t, grow: 1 }); g.restore();
      // ---- پشتهٔ هرمی (فلوچارت): ۱ / ۲ / ۸ ۱۶ / ۲۶ ۳۸ ۵۲ ----
      g.fillStyle = '#0b1a3e'; g.fillRect(0, RH, CW, CH - RH);
      g.fillStyle = '#e6b84a'; g.font = 'bold 16px ' + BZ.FONT; g.fillText('پشتهٔ هرمی: هر تلویزیون یک جهان با پیکسل خودش (عروسک یکی است)', CW / 2, RH + 24);
      const rows = [[0], [1], [2, 3], [4, 5, 6]], tvw = 124, tvh = 93; let ry = RH + 44;
      const centers = [];
      rows.forEach((row, r) => { row.forEach((k, c) => { const x = CW / 2 + (c - (row.length - 1) / 2) * (tvw + 36), y = ry; centers[k] = { x, y: y + tvh / 2 }; miniTV(x - tvw / 2, y, tvw, tvh, k); }); ry += tvh + 26; });
      // پیکان‌های +Δ بین مرحله‌ها
      const inc = [null, 1, 6, 8, 10, 12, 14];
      g.strokeStyle = 'rgba(255,226,138,.75)'; g.fillStyle = '#ffe28a'; g.lineWidth = 2; g.font = 'bold 12px ' + BZ.FONT;
      for (let k = 1; k < 7; k++) { const a = centers[k - 1], b = centers[k]; g.beginPath(); g.moveTo(a.x, a.y + tvh / 2 + 2); g.lineTo(b.x, b.y - tvh / 2 - 2); g.stroke(); g.fillText('+' + inc[k], (a.x + b.x) / 2 + 16, (a.y + b.y) / 2 + 4); }
    }
    function miniTV(x, y, w, hh, k) {
      const sel = listen === k + 1, L = LINES[k];
      g.fillStyle = sel ? '#ffd36a' : '#3a2c1e'; g.fillRect(x - 5, y - 5, w + 10, hh + 10);
      g.fillStyle = '#000'; g.fillRect(x, y, w, hh);
      g.imageSmoothingEnabled = false; g.drawImage(ras[k], x, y, w, hh); g.imageSmoothingEnabled = true;
      g.fillStyle = 'rgba(0,0,0,.2)'; const stp = hh / L; if (stp >= 3) for (let i = 0; i < L; i++) g.fillRect(x, y + i * stp + stp * 0.75, w, stp * 0.25);
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x, y + hh - 18, w, 18);
      g.fillStyle = '#ffe28a'; g.font = 'bold 12px ' + BZ.FONT; g.textAlign = 'center'; g.fillText(L + ' خط • ' + WORLDS[k].name, x + w / 2, y + hh - 5);
    }

    // ----- جدول علمی -----
    const tbl = h('div', { class: 'etable' });
    function drawTbl() {
      tbl.innerHTML = '';
      tbl.append(h('div', { class: 'erow' }, h('b', null, 'جهان'), h('b', null, 'خط×ستون'), h('b', null, 'پیکسل'), h('b', null, 'B (kHz)'), h('b', null, 'g'), h('b', null, 'پرواز (s)')));
      const ft = flightTimes();
      WORLDS.forEach((w, i) => { const L = LINES[i], b = bodies[i + 1], m = b.flights.length ? b.flights[b.flights.length - 1] : null; tbl.append(h('div', { class: 'erow' }, h('span', null, (i + 1) + ' ' + w.name), h('span', null, L + '×' + colsOf(L)), h('span', null, colsOf(L) * L), h('span', null, (bandwidth(L) / 1000).toFixed(2)), h('span', null, w.g), h('span', null, (m == null ? '—' : m.toFixed(2)) + ' / ' + ft[i].theory.toFixed(2)))); });
    }

    // ----- کنترل‌ها -----
    const worldOpts = [{ v: '7', t: 'گیرنده: جهان ۷ (۵۲ خط)' }].concat(WORLDS.slice(0, 6).map((w, i) => ({ v: String(i + 1), t: 'گیرنده: جهان ' + (i + 1) + ' (' + LINES[i] + ' خط)' })));
    const selW = BZ.select(worldOpts.slice().sort((a, b) => +a.v - +b.v), '7', (v) => { listen = +v; });
    const controls = h('div', null,
      h('div', { class: 'r-ctrl' }, BZ.btn('🗣 معرفی', () => { stopSpeech(); const T = TXT[lang]; speak(T.hello, 'happy'); speak(T.rule); for (let i = 1; i <= 7; i++) speak(T.world(i)); }, 'go'), BZ.btn('■', stopSpeech, 'sm'),
        BZ.toggle('پرش خودکار', true, (v) => { auto = v; }), BZ.seg([{ v: 'fa', t: 'فارسی' }, { v: 'en', t: 'English' }], lang, (v) => { lang = v; })),
      h('div', { class: 'r-ctrl' }, selW, BZ.btn('پرش!', () => { bodies.forEach((b) => bodyJump(b, V0, tt)); }, 'sm')),
      BZ.slider({ label: 'سرعت زمان', min: 0.25, max: 2, step: 0.25, value: 1, fmt: (v) => v + '×', onInput: (v) => { speed = v; } }));
    let txt = 'سایهٔ من در هر تلویزیون یک جهان می‌سازد. My shadow builds a world in every television.';
    const ti = h('input', { type: 'text', class: 'inp', value: txt, style: { flex: '1', minWidth: '200px' } }), phon = h('div', { class: 'note' }, '');
    const upd = () => { txt = ti.value; phon.textContent = 'آوانویسی: ' + BZ.speech.transcribe(txt); }; ti.addEventListener('input', upd); upd();
    const tts = h('section', { class: 'exp' }, h('h3', null, 'نوشتار به گفتار از گیرندهٔ جهان انتخابی'), h('p', { class: 'note' }, 'صدا از فیلتر باند و نویز گیرندهٔ همان مرحله می‌گذرد؛ هرچه خط‌ها کمتر، پهنای باند و SNR کمتر و صدا تلفنی‌تر.'), h('div', { class: 'r-ctrl' }, ti, BZ.btn('🗣 بگو', () => { stopSpeech(); speak(txt); }, 'go')), phon);
    const sci = h('section', { class: 'exp' }, h('h3', null, 'منطق و علم'),
      h('p', { class: 'note' }, 'آینه همان تلویزیون است: نور صحنه با یک پیش‌فیلتر (میانگین‌گیری) روی شبکهٔ خط×ستون نمونه‌برداری می‌شود و روی صفحهٔ تلویزیونِ جهان بیرونی نمایش داده می‌شود؛ آن جهان هم دوباره نمونه‌برداری می‌شود (اثر دروست). پس تلویزیون درونی هیچ‌وقت جزئیاتی بیشتر از شبکهٔ بیرونی ندارد. شمارهٔ هر جهان طبق فلوچارت ۱، ۲، ۸، ۱۶، ۲۶، ۳۸، ۵۲ خط است و ورود از ۰ (جهان واقعی) است. عروسک یکی است و فرمان پرش یکی؛ ولی هر جهان با گرانش خودش (y″=−g) آن را اجرا می‌کند: زمان پرواز 2v₀/g، پس در پلوتو بلند و آرام و در زمین کوتاه و تند. پهنای باند هر مرحله B≈ستون×خط×fps/2 است (در PAL واقعی حدود ۵ مگاهرتز).'), tbl);
    const root = h('div', { class: 'lab' }, h('section', { class: 'exp' }, h('h3', null, 'جهان‌های تو در تو: عروسک در تلویزیون'), cv, controls), sci, tts);
    let lastTbl = 0;
    root.paint = (now) => { const t = now / 1000, dt = last ? (now - last) / 1000 : 0; last = now; step(dt); render(t); if (now - lastTbl > 700) { lastTbl = now; drawTbl(); } };
    drawTbl();
    return root;
  };
  BZ.worlds = { LINES, WORLDS, colsOf, bandwidth, flightTimes, Body, bodyJump, bodyStep, V0 };
  BZ.extraTests = (BZ.extraTests || []).concat([
    ['جهان‌ها: خط‌ها = [۱] + a(0..5) فلوچارت', () => { const v = [1].concat([0, 1, 2, 3, 4, 5].map(BZ.pyr.val)); return [v.join() === LINES.join(), v.join(',')]; }],
    ['جهان‌ها: زمان پرواز هر جهان = 2v₀/g', () => { const f = flightTimes(); let e = 0; f.forEach((x) => { e = Math.max(e, Math.abs(x.meas - x.theory) / x.theory); }); return [e < 0.01, 'خطای نسبی ' + (e * 100).toFixed(2) + '٪']; }],
    ['جهان‌ها: پهنای باند با پیکسل افزایش می‌یابد', () => { let ok2 = true; for (let i = 1; i < LINES.length; i++) if (!(bandwidth(LINES[i]) > bandwidth(LINES[i - 1]))) ok2 = false; return [ok2, (bandwidth(52) / 1000).toFixed(1) + ' kHz برای ۵۲ خط']; }],
  ]);
})();
