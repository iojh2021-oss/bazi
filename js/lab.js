/* lab.js — آزمایشگاه: محیط اتر، مدولاسیون، سوپرهترودین، اسکن تلویزیون، هد دوار ویدئو، آمپلی‌فایر؛ دفتر آزمایش */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  BZ.notebook = {
    list: BZ.store.get('nb', []),
    add(title, data) { this.list.unshift({ at: new Date().toISOString(), world: BZ.clockHM(BZ.world.time), title, data }); this.list = this.list.slice(0, 200); BZ.store.set('nb', this.list); BZ.toast('در دفتر آزمایش ثبت شد'); BZ.bus.emit('nb'); },
    clear() { this.list = []; BZ.store.set('nb', []); BZ.bus.emit('nb'); },
  };

  const card = (title, concept, ...kids) => h('section', { class: 'exp' }, h('h3', null, title), h('p', { class: 'note' }, concept), ...kids);
  const ctx2 = (c) => c.getContext('2d');
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const BCOL = { AM: '#e8b130', FM: '#37c27a', SW: '#a77bff', TV: '#ff5d8f' };

  // ================= ۱) محیط اتر =================
  function etherExp() {
    const cv = BZ.cv(520, 520, 'map'), g = ctx2(cv), W = BZ.world;
    let filter = 'FM', dragging = false, cache = '', ranges = {};
    const table = h('div', { class: 'etable' });
    const clockEl = h('div', { class: 'e-clock' });
    const toMap = (e) => { const r = cv.getBoundingClientRect(); return { x: BZ.clamp(((e.clientX - r.left) / r.width) * 100, 0, 100), y: BZ.clamp(((e.clientY - r.top) / r.height) * 100, 0, 100) }; };
    cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); W.env.rx = toMap(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging) W.env.rx = toMap(e); });
    cv.addEventListener('pointerup', () => { dragging = false; W.save(); });
    const srcs = () => (filter === 'TV' ? W.channels.map((c) => Object.assign({ freq: c.number }, c, { band: 'TV' })) : W.stations.filter((s) => s.band === filter));
    function rangeOf(s) { // شعاعی که قدرت سیگنال هنوز ≥ ۰٫۲۵ است
      const fl = BZ.rf.noiseFloor(s.band, W.env), night = W.isNight(); let r = 0;
      for (let d = 1; d <= 140; d++) { if ((BZ.rf.txdB(s) - BZ.rf.pathLoss(s, d, night) - fl) / 30 >= 0.25) r = d; else if (d > r + 3) break; }
      return r;
    }
    const filt = BZ.seg([{ v: 'AM', t: 'AM' }, { v: 'FM', t: 'FM' }, { v: 'SW', t: 'SW' }, { v: 'TV', t: 'تلویزیون' }], filter, (v) => { filter = v; cache = ''; });
    const daySeg = BZ.seg([{ v: 'auto', t: 'خودکار' }, { v: 'day', t: 'روز' }, { v: 'night', t: 'شب' }], W.env.dayMode, (v) => { W.env.dayMode = v; W.save(); });
    const spd = BZ.seg([{ v: 1, t: '1×' }, { v: 5, t: '5×' }, { v: 30, t: '30×' }, { v: 120, t: '120×' }], W.speed, (v) => { W.speed = v; W.save(); });
    const mk = (label, key) => BZ.slider({ label, min: 0, max: 1, step: 0.01, value: W.env[key], fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => { W.env[key] = v; cache = ''; W.save(); } });
    const tSl = BZ.slider({ label: 'ساعت جهان', min: 0, max: 24, step: 0.25, value: W.hour(), fmt: (v) => BZ.clockHM(v * 3600), onInput: (v) => { W.time = Math.floor(W.time / 86400) * 86400 + v * 3600; cache = ''; } });
    const stdSeg = BZ.seg([{ v: 'PAL', t: 'PAL' }, { v: 'NTSC', t: 'NTSC' }], W.env.standard, (v) => { W.env.standard = v; W.save(); });
    const log = BZ.btn('ثبت در دفتر', () => {
      const night = W.isNight(), rows = srcs().map((s) => ({ n: s.name, s: +BZ.rf.strength(s, W.env, night).toFixed(2) })).sort((a, b) => b.s - a.s).slice(0, 6);
      BZ.notebook.add('محیط اتر — ' + filter, { rx: W.env.rx, night, noise: W.env.noise, top: rows });
    });
    const el = card('محیط اتر (جهان مجازی)', 'گیرنده را روی نقشه بکشید. فاصله، توان فرستنده، نویز جوی، روز/شب و تداخل، قدرت همهٔ سیگنال‌ها را عوض می‌کند — همین مدل، رادیو، تلویزیون و ویدئو را تغذیه می‌کند. شب، موج AM و SW دورتر می‌رسد.',
      h('div', { class: 'r-ctrl' }, filt, daySeg, spd), cv, clockEl,
      h('div', { class: 'sl-grid' }, mk('نویز جوی', 'noise'), mk('تداخل صنعتی', 'interference'), mk('چندمسیری (ارواح تلویزیون)', 'multipath'), tSl),
      h('div', { class: 'r-ctrl' }, h('span', { class: 'lbl' }, 'استاندارد تلویزیون:'), stdSeg, log), table);
    return {
      el, paint() {
        const night = W.isNight(), key = filter + night + JSON.stringify(W.env) + W.custom.stations.length;
        if (key !== cache) { cache = key; ranges = {}; srcs().forEach((s) => { ranges[s.id] = rangeOf(s); }); }
        g.fillStyle = '#0b1218'; g.fillRect(0, 0, 520, 520); g.strokeStyle = '#16232d'; g.lineWidth = 1;
        for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(i * 52, 0); g.lineTo(i * 52, 520); g.moveTo(0, i * 52); g.lineTo(520, i * 52); g.stroke(); }
        g.fillStyle = '#5a7080'; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText('۱۰۰ km', 4, 12);
        srcs().forEach((s) => {
          const x = s.x * 5.2, y = s.y * 5.2, c = BCOL[filter];
          g.strokeStyle = c; g.globalAlpha = 0.25; g.beginPath(); g.arc(x, y, ranges[s.id] * 5.2, 0, 7); g.stroke(); g.globalAlpha = 1;
          g.fillStyle = c; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x - 5, y + 4); g.lineTo(x + 5, y + 4); g.fill();
          g.font = '10px ' + BZ.FONT; g.textAlign = 'center'; g.fillStyle = '#cfe'; g.fillText(s.name, x, y + 16);
        });
        const rx = W.env.rx; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(rx.x * 5.2, rx.y * 5.2, 9, 0, 7); g.moveTo(rx.x * 5.2, rx.y * 5.2 - 9); g.lineTo(rx.x * 5.2, rx.y * 5.2 - 20); g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 10px ' + BZ.FONT; g.fillText('گیرنده', rx.x * 5.2, rx.y * 5.2 + 24);
        clockEl.textContent = 'ساعت جهان ' + BZ.clockHM(W.time) + ' — ' + (night ? '🌙 شب (موج آسمانی فعال)' : '☀ روز');
        const rows = srcs().map((s) => ({ s, v: BZ.rf.strength(s, W.env, night) })).sort((a, b) => b.v - a.v);
        const sig = rows.map((r) => r.s.id + ':' + Math.round(r.v * 20)).join();
        if (table._k !== sig) { table._k = sig; table.innerHTML = ''; rows.forEach((r) => table.append(h('div', { class: 'erow' }, h('span', null, r.s.name + (r.s.freq ? ' (' + r.s.freq + ')' : '')), h('div', { class: 'ebar' }, h('i', { style: { width: Math.round(r.v * 100) + '%', background: BCOL[filter] } })), h('b', null, Math.round(r.v * 100) + '%')))); }
      },
    };
  }

  // ================= ۲) میز مدولاسیون =================
  function modExp() {
    const cv = BZ.cv(560, 520, 'scope'), g = ctx2(cv);
    const S = { type: 'AM', m: 0.7, noise: 0.05 };
    const N = 2048, FC = 64, FM = 2;
    const info = h('div', { class: 'note strong' });
    let dirty = true;
    const boxcar = (a, w) => { const o = new Float32Array(a.length), hw = w >> 1; let s = 0, c = 0; for (let i = 0; i < a.length + hw; i++) { if (i < a.length) { s += a[i]; c++; } if (i - w >= 0) { s -= a[i - w]; c--; } if (i - hw >= 0 && i - hw < a.length) o[i - hw] = s / c; } return o; };
    function sim(fc, fm) { // سیگنال، پیام و خروجی آشکارساز (دمدولاتور هم‌فاز I/Q)
      const y = new Float32Array(N), msg = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        const t = n / N, mm = Math.cos(2 * Math.PI * fm * t); msg[n] = mm;
        y[n] = S.type === 'AM' ? (1 + S.m * mm) * Math.cos(2 * Math.PI * fc * t) : Math.cos(2 * Math.PI * fc * t + S.m * Math.sin(2 * Math.PI * fm * t));
        y[n] += gauss() * S.noise;
      }
      return { y, msg };
    }
    function demod(y, fc) {
      const I = new Float32Array(N), Q = new Float32Array(N);
      for (let n = 0; n < N; n++) { const ph = 2 * Math.PI * fc * (n / N); I[n] = y[n] * Math.cos(ph); Q[n] = -y[n] * Math.sin(ph); }
      const w = Math.round(N / fc), Il = boxcar(I, w), Ql = boxcar(Q, w), out = new Float32Array(N);
      if (S.type === 'AM') { for (let n = 0; n < N; n++) out[n] = (2 * Math.hypot(Il[n], Ql[n]) - 1) / S.m; }
      else { // FM: فاز مختلط → مشتق = فرکانس لحظه‌ای = پیام
        const ph = new Float32Array(N); let prev = Math.atan2(Ql[0], Il[0]), un = prev; ph[0] = un;
        for (let n = 1; n < N; n++) { const a = Math.atan2(Ql[n], Il[n]); let d = a - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; un += d; prev = a; ph[n] = un; }
        const sm = boxcar(ph, 48);
        for (let n = 0; n < N - 1; n++) out[n] = ((sm[n + 1] - sm[n]) * N) / (S.m * 2 * Math.PI * FM);
        out[N - 1] = out[N - 2];
      }
      return out;
    }
    function plot(arr, y0, hh, col, label, scale) {
      g.strokeStyle = '#1b2a35'; g.beginPath(); g.moveTo(0, y0 + hh / 2); g.lineTo(560, y0 + hh / 2); g.stroke();
      g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath();
      for (let x = 0; x < 560; x++) { const v = arr[Math.floor((x / 560) * N)] / (scale || 1); const yy = y0 + hh / 2 - BZ.clamp(v, -1.2, 1.2) * (hh / 2.3); if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke();
      g.fillStyle = '#8fb0c0'; g.font = '11px ' + BZ.FONT; g.textAlign = 'left'; g.fillText(label, 6, y0 + 12);
    }
    function redraw() {
      g.fillStyle = '#080d11'; g.fillRect(0, 0, 560, 520);
      const a = sim(FC, FM), d = demod(a.y, FC);
      plot(a.msg, 0, 100, '#5ec8ff', 'پیام (سیگنال صوتی)');
      plot(a.y, 100, 130, '#ffd23f', S.type === 'AM' ? 'موج AM دریافتی (دامنه تغییر می‌کند)' : 'موج FM دریافتی (فرکانس تغییر می‌کند)', S.type === 'AM' ? 1.8 : 1.1);
      plot(d, 230, 100, '#6ef2a0', 'خروجی آشکارساز (دمدولاسیون)', S.type === 'AM' ? 1 : (S.m === 0 ? 1 : 1));
      // طیف
      const sp = sim(256, 16), re = Float64Array.from(sp.y), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] *= 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      BZ.fft(re, im);
      g.fillStyle = '#0c141a'; g.fillRect(0, 340, 560, 180); g.fillStyle = '#8fb0c0'; g.fillText('طیف فرکانسی حول حامل (محور افقی: ±۸ برابر فرکانس پیام)', 6, 354);
      const lo = 256 - 8 * 16, hi = 256 + 8 * 16; let mx = 1e-6; const mags = [];
      for (let k = lo; k <= hi; k++) { const m = Math.hypot(re[k], im[k]); mags.push(m); mx = Math.max(mx, m); }
      const wbar = 560 / mags.length; mags.forEach((m, i) => { const v = Math.max(0, 1 + Math.log10(m / mx + 1e-4) / 4); g.fillStyle = i === 128 ? '#ffd23f' : '#37c27a'; g.fillRect(i * wbar, 510 - v * 140, Math.max(1, wbar - 0.5), v * 140); });
      const fmH = 1, dF = S.m * fmH;
      info.textContent = S.type === 'AM' ? 'AM: پهنای باند = 2 × fm؛ عمق مدولاسیون m = ' + S.m.toFixed(2) + '؛ توان در کناره‌ها = ' + Math.round((S.m * S.m / (2 + S.m * S.m)) * 100) + '٪ کل (بقیه در حامل هدر می‌رود).' : 'FM: اندیس β = ' + S.m.toFixed(1) + '؛ پهنای باند (قاعدهٔ کارسون) = 2 × (Δf + fm) = ' + (2 * (dF + fmH)).toFixed(1) + ' × fm. با افزایش β، نویز کمتر شنیده می‌شود ولی پهنای باند بیشتر می‌شود.';
    }
    const typ = BZ.seg([{ v: 'AM', t: 'AM — دامنه' }, { v: 'FM', t: 'FM — فرکانس' }], S.type, (v) => { S.type = v; S.m = v === 'AM' ? 0.7 : 3; const inp = mS.querySelector('input'); inp.min = v === 'AM' ? 0.05 : 0.2; inp.max = v === 'AM' ? 1 : 8; mS.set(S.m); dirty = true; });
    const mS = BZ.slider({ label: 'عمق / اندیس مدولاسیون', min: 0.05, max: 1, step: 0.05, value: S.m, fmt: (v) => v.toFixed(2), onInput: (v) => { S.m = v; dirty = true; } });
    const nS = BZ.slider({ label: 'نویز کانال', min: 0, max: 1, step: 0.01, value: S.noise, fmt: (v) => v.toFixed(2), onInput: (v) => { S.noise = v; dirty = true; } });
    const listen = BZ.btn('🔊 شنیدن نتیجه', () => {
      if (!BZ.audio.init()) return;
      const c = BZ.audio.ctx, T = c.currentTime, o = c.createOscillator(), og = c.createGain(), nz = c.createBufferSource(), ng = c.createGain();
      o.frequency.value = 440; og.gain.value = 0.25; o.connect(og); og.connect(BZ.audio.master); o.start(T); o.stop(T + 2);
      nz.buffer = BZ.audio.nbuf; ng.gain.value = S.noise * (S.type === 'AM' ? 0.5 : 0.5 / (1 + S.m * 1.2)); nz.connect(ng); ng.connect(BZ.audio.master); nz.start(T, 0, 2);
    });
    const log = BZ.btn('ثبت در دفتر', () => BZ.notebook.add('مدولاسیون ' + S.type, { m: S.m, noise: S.noise }));
    const el = card('میز مدولاسیون AM / FM', 'همان پیام با دو روش روی حامل سوار می‌شود. نویز را بالا ببرید و ببینید کدام روش در برابر نویز مقاوم‌تر است (FM با اندیس بالا).',
      h('div', { class: 'r-ctrl' }, typ, listen, log), h('div', { class: 'sl-grid' }, mS, nS), cv, info);
    let last = 0;
    return { el, paint(now) { if (dirty || (S.noise > 0.01 && now - last > 150)) { dirty = false; last = now; redraw(); } } };
  }

  // ================= ۳) سوپرهترودین =================
  function superExp() {
    const cv = BZ.cv(560, 300, 'scope'), g = ctx2(cv), W = BZ.world;
    const S = { fs: 1008, IF: 455, Q: 25, high: true, fake: false };
    const out = h('div', { class: 'note strong' });
    const am = () => W.stations.filter((s) => s.band === 'AM');
    const arf = (f) => 1 / Math.sqrt(1 + Math.pow(S.Q * (f / S.fs - S.fs / f), 2));
    const fx = (f) => 10 + (f / 1800) * 540;
    function calc() {
      const lo = S.high ? S.fs + S.IF : S.fs - S.IF, img = S.high ? S.fs + 2 * S.IF : S.fs - 2 * S.IF;
      const list = am().map((s) => ({ f: s.freq, n: s.name, st: BZ.rf.strength(s, W.env, W.isNight()) }));
      if (S.fake) list.push({ f: img, n: 'مزاحم در فرکانس تصویر', st: 0.9 });
      const heard = list.map((s) => { const d = Math.abs(Math.abs(s.f - lo) - S.IF); return { n: s.n, f: s.f, d, a: s.st * arf(s.f), pass: d <= 5 }; }).filter((r) => r.pass && r.a > 0.01);
      return { lo, img, heard, rej: -20 * Math.log10(arf(img)) };
    }
    function paint() {
      const c = calc();
      g.fillStyle = '#080d11'; g.fillRect(0, 0, 560, 300);
      g.strokeStyle = '#1b2a35'; g.fillStyle = '#6f8ea0'; g.font = '10px sans-serif'; g.textAlign = 'center';
      for (let f = 0; f <= 1800; f += 200) { g.beginPath(); g.moveTo(fx(f), 20); g.lineTo(fx(f), 250); g.stroke(); g.fillText(f + '', fx(f), 264); }
      g.fillText('kHz', 540, 278);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.beginPath(); for (let f = 100; f <= 1800; f += 4) { const y = 250 - arf(f) * 210; if (f === 100) g.moveTo(fx(f), y); else g.lineTo(fx(f), y); } g.stroke();
      g.fillStyle = '#ffd23f'; g.textAlign = 'left'; g.fillText('پاسخ فیلتر RF (Q=' + S.Q + ')', 14, 18);
      const stems = am().map((s) => ({ f: s.freq, st: BZ.rf.strength(s, W.env, W.isNight()), n: s.name }));
      if (S.fake) stems.push({ f: c.img, st: 0.9, n: 'مزاحم' });
      stems.forEach((s) => { const heard = c.heard.some((r) => r.f === s.f); g.strokeStyle = heard ? '#37c27a' : '#4a7080'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx(s.f), 250); g.lineTo(fx(s.f), 250 - s.st * 130); g.stroke(); });
      const mark = (f, col, lab, dy) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(fx(f), 30); g.lineTo(fx(f), 250); g.stroke(); g.setLineDash([]); g.textAlign = 'center'; g.fillText(lab, fx(f), 40 + dy); };
      mark(S.fs, '#5ec8ff', 'fs', 0); mark(c.lo, '#ff9f5e', 'LO', 12); mark(c.img, '#ff5d8f', 'تصویر', 24);
      out.textContent = 'LO = ' + c.lo + ' kHz ، فرکانس تصویر = ' + c.img + ' kHz ، تضعیف RF در فرکانس تصویر = ' + c.rej.toFixed(1) + ' dB.   شنیده می‌شود: ' + (c.heard.length ? c.heard.map((r) => r.n + ' (' + Math.round(r.a * 100) + '٪)').join('، ') : 'هیچ‌چیز');
    }
    const sl = (label, min, max, key, step, fmt) => BZ.slider({ label, min, max, step, value: S[key], fmt: fmt || ((v) => v + ''), onInput: (v) => { S[key] = v; } });
    const ifSel = BZ.seg([{ v: 262, t: 'IF 262' }, { v: 455, t: 'IF 455' }, { v: 470, t: 'IF 470' }], 455, (v) => { S.IF = v; });
    const inj = BZ.seg([{ v: true, t: 'تزریق بالا' }, { v: false, t: 'تزریق پایین' }], true, (v) => { S.high = v; });
    const log = BZ.btn('ثبت در دفتر', () => { const c = calc(); BZ.notebook.add('سوپرهترودین', { fs: S.fs, IF: S.IF, Q: S.Q, lo: c.lo, image: c.img, rejectionDb: +c.rej.toFixed(1), heard: c.heard.map((r) => r.n) }); });
    const el = card('گیرندهٔ سوپرهترودین و فرکانس تصویر', 'همهٔ سیگنال‌ها با نوسان‌ساز محلی (LO) ترکیب می‌شوند و فقط آنچه به فرکانس میانی IF می‌افتد از فیلتر می‌گذرد. فرکانس تصویر (fs + 2·IF) هم به IF می‌افتد؛ فقط فیلتر RF جلوی آن را می‌گیرد. Q را کم کنید و مزاحم را فعال کنید تا تداخل «ایستگاه شبح» را بشنوید.',
      h('div', { class: 'r-ctrl' }, ifSel, inj, BZ.toggle('مزاحم در فرکانس تصویر', false, (v) => { S.fake = v; }), log),
      h('div', { class: 'sl-grid' }, sl('فرکانس تنظیم fs (kHz)', 531, 1701, 'fs', 3, (v) => v + ''), sl('کیفیت فیلتر RF (Q)', 3, 100, 'Q', 1)), cv, out);
    return { el, paint };
  }

  // ================= ۴) اسکن تلویزیون =================
  function scanExp() {
    const prev = BZ.cv(256, 192, 'scope'), pg = ctx2(prev), wave = BZ.cv(560, 200, 'scope'), wg = ctx2(wave);
    const S = { line: 40, std: BZ.world.env.standard };
    const tmp = BZ.cv(256, 192), tg = ctx2(tmp), info = h('div', { class: 'etable' });
    const L = { PAL: { lines: 625, act: 576, field: 50, fl: 15625, lt: 64, burst: 4.43 }, NTSC: { lines: 525, act: 480, field: 59.94, fl: 15734.26, lt: 63.56, burst: 3.58 } };
    let t0 = 0;
    function paint(now) {
      const P = L[S.std];
      BZ.video.draw(tg, 256, 192, BZ.world.programs.test1, 0);
      pg.drawImage(tmp, 0, 0);
      // پیمایش میدان‌ها (interlace): خطوط فرد و زوج به‌نوبت
      const field = Math.floor(now / 400) % 2, y = Math.floor((S.line / P.act) * 192);
      pg.fillStyle = 'rgba(0,0,0,.35)'; for (let r = field; r < 192; r += 2) pg.fillRect(0, r, 256, 1);
      pg.fillStyle = '#ff3b3b'; pg.fillRect(0, y, 256, 2);
      pg.fillStyle = '#fff'; pg.font = '11px sans-serif'; pg.fillText('میدان ' + (field ? 'زوج' : 'فرد') + ' (نمایش آهستهٔ ۲:۱)', 6, 12);
      // موج مرکب یک خط
      const row = tg.getImageData(0, Math.min(191, y), 256, 1).data;
      wg.fillStyle = '#080d11'; wg.fillRect(0, 0, 560, 200);
      const X = (us) => 10 + (us / P.lt) * 540, Y = (ire) => 150 - ire * 1.15;
      wg.strokeStyle = '#1b2a35'; for (let ire = -40; ire <= 100; ire += 20) { wg.beginPath(); wg.moveTo(0, Y(ire)); wg.lineTo(560, Y(ire)); wg.stroke(); }
      wg.strokeStyle = '#ffd23f'; wg.lineWidth = 1.6; wg.beginPath();
      const seg = [[0, 1.5, 0], [1.5, 6.2, -40], [6.2, 12, 0]]; // پیش‌ایوان، سنک، پس‌ایوان
      for (let us = 0; us <= P.lt; us += 0.1) {
        let v;
        if (us < 1.5) v = 0; else if (us < 6.2) v = -40; else if (us < 12) { v = 0; if (us > 6.9 && us < 9.5) v = 20 * Math.sin(2 * Math.PI * P.burst * (us - 6.9)); } // بورست رنگ
        else { const i = Math.min(255, Math.floor(((us - 12) / (P.lt - 12)) * 256)), lum = (0.299 * row[i * 4] + 0.587 * row[i * 4 + 1] + 0.114 * row[i * 4 + 2]) / 255; v = 7 + lum * 93; }
        if (us === 0) wg.moveTo(X(us), Y(v)); else wg.lineTo(X(us), Y(v));
      }
      wg.stroke(); wg.fillStyle = '#8fb0c0'; wg.font = '10px ' + BZ.FONT; wg.textAlign = 'center';
      wg.fillText('پیش‌ایوان', X(0.75), 176); wg.fillText('پالس همگام‌سازی', X(3.9), 190); wg.fillText('بورست رنگ', X(8.2), 176); wg.fillText('تصویر فعال (روشنایی خط انتخاب‌شده)', X(38), 190); wg.fillText('0 µs', X(0), 12); wg.fillText(P.lt + ' µs', X(P.lt) - 20, 12);
      wg.textAlign = 'left'; wg.fillText('IRE', 2, Y(0) - 3);
      const sig = S.std + S.line; if (info._k !== sig) { info._k = sig; info.innerHTML = ''; [['خط در هر تصویر', P.lines + ' (فعال ' + P.act + ')'], ['میدان در ثانیه', P.field], ['فرکانس خط', P.fl + ' Hz'], ['زمان هر خط', P.lt + ' µs'], ['فرکانس بورست رنگ', P.burst + ' MHz']].forEach(([a, b]) => info.append(h('div', { class: 'erow' }, h('span', null, a), h('b', null, String(b))))); }
    }
    const std = BZ.seg([{ v: 'PAL', t: 'PAL / 625' }, { v: 'NTSC', t: 'NTSC / 525' }], S.std, (v) => { S.std = v; });
    const ls = BZ.slider({ label: 'شمارهٔ خط', min: 0, max: 575, step: 1, value: S.line, fmt: (v) => v + '', onInput: (v) => { S.line = v; } });
    const log = BZ.btn('ثبت در دفتر', () => BZ.notebook.add('اسکن تلویزیون', { std: S.std, line: S.line }));
    const el = card('اسکن خط‌به‌خط تلویزیون و موج مرکب', 'تصویر خط به خط (و در دو میدان تو در تو) پیمایش می‌شود. هر خط یک موج است: پالس همگام‌سازی، بورست رنگ، سپس روشنایی تصویر. یک خط را انتخاب کنید و شکل موجش را ببینید.',
      h('div', { class: 'r-ctrl' }, std, log), ls, h('div', { class: 'r-ctrl' }, prev), wave, info);
    return { el, paint };
  }

  // ================= ۵) هد دوار ویدئو =================
  function vhsExp() {
    const cv = BZ.cv(560, 300, 'scope'), g = ctx2(cv);
    const S = { std: 'PAL', mode: 1, off: 0 };
    const out = h('div', { class: 'note strong' });
    const SP = { PAL: 23.39, NTSC: 33.35 }, FR = { PAL: 50, NTSC: 59.94 }, ANG = { PAL: 5.93, NTSC: 5.95 }, RPM = { PAL: 1500, NTSC: 1798 };
    function paint(now) {
      const v = SP[S.std] / S.mode, fld = FR[S.std], pitch = (v / fld) * Math.sin((ANG[S.std] * Math.PI) / 180) * 1000;
      g.fillStyle = '#080d11'; g.fillRect(0, 0, 560, 300);
      // استوانهٔ هد دوار
      const cx = 130, cy = 150, a = (now / 1000) * 2;
      g.fillStyle = '#23272e'; g.beginPath(); g.arc(cx, cy, 80, 0, 7); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#3a3f48'; g.beginPath(); g.arc(cx, cy, 52, 0, 7); g.fill();
      [0, Math.PI].forEach((o, i) => { const x = cx + Math.cos(a + o) * 66, y = cy + Math.sin(a + o) * 66; g.fillStyle = i ? '#5ec8ff' : '#ff9f5e'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); });
      g.fillStyle = '#9ab'; g.font = '11px ' + BZ.FONT; g.textAlign = 'center'; g.fillText('دو هد (آزیموت ±۶°)', cx, cy + 4); g.fillText(RPM[S.std] + ' rpm', cx, 252);
      // نوار با شیارهای مورب
      const tx = 270, tw = 270, th = 230, ty = 30;
      g.fillStyle = '#3b2a1a'; g.fillRect(tx, ty, tw, th);
      const pp = Math.max(8, pitch * 0.55), sl = Math.tan((ANG[S.std] * Math.PI) / 180) * 5.5;
      for (let i = -2; i < Math.ceil(tw / pp) + 3; i++) {
        const x0 = tx + i * pp + ((now / 40) % pp); g.strokeStyle = i % 2 ? '#c0765a' : '#7aa0c8'; g.lineWidth = Math.max(2, pp * 0.9); g.globalAlpha = 0.85;
        g.beginPath(); g.moveTo(x0 - 28, ty + th); g.lineTo(x0 + 28 + sl * 0, ty); g.stroke();
      }
      g.globalAlpha = 1;
      const hx = tx + 20 + ((now / 7) % (tw - 40)), off = S.off * pp * 0.9; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx + off - 28, ty + th); g.lineTo(hx + off + 28, ty); g.stroke();
      const lvl = BZ.clamp(1 - Math.abs(S.off) / 0.95, 0, 1);
      g.fillStyle = '#9ab'; g.textAlign = 'left'; g.fillText('خط سفید = مسیر هد؛ نوارهای رنگی = شیارهای ضبط‌شده', tx, ty + th + 14);
      g.fillStyle = '#222'; g.fillRect(tx, ty + th + 22, tw, 10); g.fillStyle = lvl > 0.6 ? '#37c27a' : lvl > 0.3 ? '#e8b130' : '#e5533d'; g.fillRect(tx, ty + th + 22, tw * lvl, 10);
      out.textContent = 'سرعت نوار ' + v.toFixed(2) + ' mm/s ، فاصلهٔ شیار (track pitch) ≈ ' + pitch.toFixed(1) + ' µm ، ' + fld + ' میدان در ثانیه (هر دور استوانه دو شیار). سطح سیگنال با انحراف ردیابی: ' + Math.round(lvl * 100) + '٪.';
    }
    const std = BZ.seg([{ v: 'PAL', t: 'PAL' }, { v: 'NTSC', t: 'NTSC' }], 'PAL', (v) => { S.std = v; });
    const mode = BZ.seg([{ v: 1, t: 'SP' }, { v: 2, t: 'LP' }, { v: 3, t: 'EP' }], 1, (v) => { S.mode = v; });
    const off = BZ.slider({ label: 'انحراف ردیابی (tracking)', min: -1, max: 1, step: 0.02, value: 0, fmt: (v) => v.toFixed(2), onInput: (v) => { S.off = v; } });
    const log = BZ.btn('ثبت در دفتر', () => BZ.notebook.add('هد دوار ویدئو', { std: S.std, speed: S.mode, offset: S.off }));
    const el = card('اسکن مارپیچ (Helical Scan) و ردیابی', 'نوار آهسته حرکت می‌کند ولی هدهای روی استوانهٔ چرخان شیارهای مورب و باریک می‌نویسند؛ به‌همین دلیل سرعت نسبی هد و نوار بالا می‌رود. انحراف ردیابی یعنی هد از روی شیار خارج می‌شود (نوار نویز در تصویر).',
      h('div', { class: 'r-ctrl' }, std, mode, log), off, cv, out);
    return { el, paint };
  }

  // ================= ۶) میز آمپلی‌فایر و RIAA =================
  function ampExp() {
    const cv = BZ.cv(560, 330, 'scope'), g = ctx2(cv), riaa = BZ.cv(560, 150, 'scope'), rg = ctx2(riaa);
    const S = { lvl: 0.6, thr: 0.8, type: 'soft' };
    const out = h('div', { class: 'note strong' });
    const N = 1024, K = 16;
    const clip = (x) => { const a = Math.abs(x), s = Math.sign(x); if (S.type === 'hard') return s * Math.min(a, S.thr); if (S.type === 'tube') return (x > 0 ? 1 : 0.7) * S.thr * Math.tanh(x / S.thr * (x > 0 ? 1 : 1.3)); return S.thr * Math.tanh(x / S.thr); };
    const riaaH = (fr) => { const w = 2 * Math.PI * fr; return Math.sqrt(1 + Math.pow(w * 318e-6, 2)) / (Math.sqrt(1 + Math.pow(w * 3180e-6, 2)) * Math.sqrt(1 + Math.pow(w * 75e-6, 2))); };
    const riaaDb = (f) => 20 * Math.log10(riaaH(f) / riaaH(1000));
    function paint() {
      const xin = new Float32Array(N), y = new Float32Array(N);
      for (let n = 0; n < N; n++) { xin[n] = S.lvl * 2 * Math.sin((2 * Math.PI * K * n) / N); y[n] = clip(xin[n]); }
      g.fillStyle = '#080d11'; g.fillRect(0, 0, 560, 330);
      const pl = (a, col, y0, label) => { g.strokeStyle = '#1b2a35'; g.beginPath(); g.moveTo(0, y0); g.lineTo(560, y0); g.stroke(); g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x < 560; x++) { const v = a[Math.floor((x / 560) * (N / 2))]; const yy = y0 - BZ.clamp(v, -1.5, 1.5) * 38; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); g.fillStyle = '#8fb0c0'; g.font = '11px ' + BZ.FONT; g.textAlign = 'left'; g.fillText(label, 6, y0 - 50); };
      pl(xin, '#5ec8ff', 60, 'ورودی سینوسی'); pl(y, '#ffd23f', 150, 'خروجی بعد از برش');
      const re = Float64Array.from(y), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] *= 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); BZ.fft(re, im);
      const mag = (k) => Math.hypot(re[k], im[k]), f1 = mag(K); let hs = 0;
      g.fillStyle = '#0c141a'; g.fillRect(0, 200, 560, 130); g.fillStyle = '#8fb0c0'; g.fillText('هارمونیک‌ها (اعوجاج)', 6, 214);
      for (let hh = 1; hh <= 9; hh++) { const m = mag(K * hh) / (f1 || 1); if (hh > 1) hs += m * m; const v = Math.max(0, 1 + Math.log10(m + 1e-4) / 4); g.fillStyle = hh === 1 ? '#ffd23f' : '#e5533d'; g.fillRect(30 + hh * 52, 320 - v * 90, 28, v * 90); g.fillStyle = '#9ab'; g.textAlign = 'center'; g.fillText(hh === 1 ? 'f' : hh + 'f', 44 + hh * 52, 328); }
      const thd = Math.sqrt(hs) * 100;
      out.textContent = 'اعوجاج هارمونیک کل (THD) ≈ ' + thd.toFixed(2) + '٪ — ' + (thd < 0.5 ? 'تمیز (هایفای)' : thd < 5 ? 'اعوجاج گرم قابل‌شنیدن' : 'برش شدید؛ صدا خشن می‌شود') + '. برش نرم (لامپی) بیشتر هارمونیک‌های فرد و برش سخت هارمونیک‌های بیشتری تولید می‌کند.';
      // منحنی RIAA
      rg.fillStyle = '#080d11'; rg.fillRect(0, 0, 560, 150); rg.strokeStyle = '#1b2a35'; rg.fillStyle = '#6f8ea0'; rg.font = '10px sans-serif'; rg.textAlign = 'center';
      [20, 100, 1000, 10000].forEach((f) => { const x = 20 + (Math.log10(f / 20) / 3) * 520; rg.beginPath(); rg.moveTo(x, 10); rg.lineTo(x, 130); rg.stroke(); rg.fillText(f + ' Hz', x, 145); });
      rg.strokeStyle = '#6ef2a0'; rg.lineWidth = 2; rg.beginPath(); for (let i = 0; i <= 200; i++) { const f = 20 * Math.pow(1000, i / 200), x = 20 + (i / 200) * 520, yy = 70 - riaaDb(f) * 1.4; if (i) rg.lineTo(x, yy); else rg.moveTo(x, yy); } rg.stroke();
      rg.fillStyle = '#6ef2a0'; rg.textAlign = 'left'; rg.fillText('پاسخ جبران‌ساز RIAA (۰ dB در 1 kHz): بم تقویت و زیر تضعیف می‌شود', 14, 20);
    }
    const lvl = BZ.slider({ label: 'سطح ورودی', min: 0.05, max: 1, step: 0.01, value: S.lvl, fmt: (v) => v.toFixed(2), onInput: (v) => { S.lvl = v; } });
    const thr = BZ.slider({ label: 'آستانهٔ برش', min: 0.2, max: 1, step: 0.01, value: S.thr, fmt: (v) => v.toFixed(2), onInput: (v) => { S.thr = v; } });
    const typ = BZ.seg([{ v: 'soft', t: 'برش نرم' }, { v: 'hard', t: 'برش سخت' }, { v: 'tube', t: 'لامپی (نامتقارن)' }], 'soft', (v) => { S.type = v; });
    const log = BZ.btn('ثبت در دفتر', () => BZ.notebook.add('آمپلی‌فایر', { level: S.lvl, threshold: S.thr, type: S.type }));
    const el = card('میز آمپلی‌فایر: برش و اعوجاج، و منحنی RIAA', 'وقتی ولوم بالا برود، قلهٔ موج به آستانهٔ آمپلی‌فایر می‌رسد و بریده می‌شود؛ بریدگی هارمونیک‌های ناخواسته می‌سازد. در پایین، منحنی RIAA گرامافون دیده می‌شود.',
      h('div', { class: 'r-ctrl' }, typ, log), h('div', { class: 'sl-grid' }, lvl, thr), cv, out, riaa);
    return { el, paint };
  }

  BZ.labExperiments = { ether: etherExp, mod: modExp, super: superExp, scan: scanExp, vhs: vhsExp, amp: ampExp };
})();
