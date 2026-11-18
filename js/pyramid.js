/* pyramid.js — «منطق هرم ۵۳»: آینه، نور، حرکت شتاب‌دار یکنواخت و ربات سخنگو
   الگو (از تصویر): آینه = ۱ ؛ زنجیره ۲ ← ۸ ← ۱۶ ← ۲۶ ← ۳۸ ← ۵۲ با افزایش‌های +۶، +۸، +۱۰، +۱۲، +۱۴ (هر مرحله ۲ واحد بیشتر)
   فرمول بسته: a(n) = n² + 5n + 2   (n = ۰،۱،۲،…)
   تعبیر فیزیکی: حرکت یک‌بعدی با شتاب ثابت  x(t) = x₀ + v₀t + ½at²  با x₀=۲، v₀=۵، a=۲ (واحد/گام²)
     ← جابه‌جایی در گام n برابر میانگین سرعت بازه است: Δ_n = v₀ + a(n − ½) = ۲n + ۴  ✓ (۶، ۸، ۱۰، …)
   ورود: نور از «۰» به آینهٔ تخت (۱) می‌تابد؛ قانون بازتاب (زاویهٔ تابش = زاویهٔ بازتاب) با بردار بازتاب r = d − 2(d·n)n محاسبه می‌شود
   و پرتو بازتابیده نخستین مکعب (۲) را روشن می‌کند؛ از آنجا جرم آزمون با شتاب ثابت جلو می‌رود و هر بار از مقدار یک مکعب عبور کند، ربات می‌پرد.
   همهٔ اجزا آفلاین‌اند؛ صدا از موتور TTS داخلی می‌آید. */
(function () {
  'use strict';
  const BZ = window.BZ, h = BZ.h;
  const X0 = 2, V0 = 5, ACC = 2, MAXN = 14;
  const val = (n) => n * n + 5 * n + 2;          // فرمول بسته
  const inc = (n) => 2 * n + 4;                  // افزایش گام n  (a(n) − a(n−1))

  // ---------- شبیه‌ساز فیزیکی (ولوسیتی‌ورله): بدون وابستگی به رابط ----------
  // برمی‌گرداند زمان عبور از هر مکعب (بر حسب گام) با درون‌یابی خطی در زیرگام
  function simulate(N, dt) {
    dt = dt || 1 / 240; let x = X0, v = V0, t = 0; const cross = [0]; let n = 1;
    while (n <= N && t < N + 2) {
      const xp = x, tp = t;
      const a = ACC; x += v * dt + 0.5 * a * dt * dt; v += a * dt; t += dt;   // ولوسیتی‌ورله برای شتاب ثابت دقیق است
      while (n <= N && x >= val(n)) { cross.push(tp + (val(n) - xp) / (x - xp) * dt); n++; }
    }
    return cross;
  }

  // ---------- اعداد به حروف ----------
  const FA1 = ['صفر', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const FA10 = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'], FA100 = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  function faNum(n) {
    if (n < 20) return FA1[n];
    const p = [], hh = Math.floor(n / 100), r = n % 100;
    if (hh) p.push(FA100[hh]);
    if (r) { if (r < 20) p.push(FA1[r]); else { p.push(FA10[Math.floor(r / 10)]); if (r % 10) p.push(FA1[r % 10]); } }
    return p.join(' و ');
  }
  const EN1 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], EN10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function enNum(n) {
    if (n < 20) return EN1[n];
    const p = [], hh = Math.floor(n / 100), r = n % 100;
    if (hh) p.push(EN1[hh] + ' hundred');
    if (r) { if (r < 20) p.push(EN1[r]); else p.push(EN10[Math.floor(r / 10)] + (r % 10 ? ' ' + EN1[r % 10] : '')); }
    return p.join(' ');
  }
  const LINES = {
    fa: {
      hello: () => 'سلام! من ربات هرم هستم. نور از صفر وارد می‌شود، از آینه بازتاب می‌شود و به عدد دو می‌رسد.',
      rule: () => 'قانون ساده است: هر مرحله دو واحد بیشتر از مرحلهٔ قبل اضافه می‌شود.',
      node: (n) => faNum(val(n)) + '. ' + faNum(inc(n)) + ' واحد بیشتر.',
      end: (N) => 'رسیدیم به ' + faNum(val(N)) + '. مرحلهٔ بعد ' + faNum(val(N + 1)) + ' است، چون افزایش بعدی ' + faNum(inc(N + 1)) + ' می‌شود.',
    },
    en: {
      hello: () => 'Hello! I am the pyramid robot. Light enters from zero, reflects off the mirror and lands on number two.',
      rule: () => 'The rule is simple: each stage adds two more than the stage before.',
      node: (n) => enNum(val(n)) + '. Plus ' + enNum(inc(n)) + '.',
      end: (N) => 'We reached ' + enNum(val(N)) + '. The next stage is ' + enNum(val(N + 1)) + ', because the next step adds ' + enNum(inc(N + 1)) + '.',
    },
  };

  // ---------- چیدمان هرم: ردیف k دارای k مکعب؛ ترتیب زنجیره = خواندن ردیف‌به‌ردیف ----------
  function layout(N, W, H) {
    const total = N + 1, rows = []; let k = 1, left = total;
    while (left > 0) { rows.push(Math.min(k, left)); left -= k; k++; }
    const R = rows.length, top = 285, bottom = H - 200, dy = R > 1 ? Math.min(165, (bottom - top) / (R - 1)) : 0;
    const maxRow = Math.max(rows[rows.length - 1], rows.length > 1 ? rows.length : 1), cell = Math.min(150, (W - 40) / Math.max(3, rows.length));
    const sz = Math.min(1, cell / 150) * 0.95 + 0.0;
    const pos = []; let idx = 0;
    rows.forEach((cnt, r) => { for (let c = 0; c < cnt; c++) { pos.push({ n: idx++, x: W / 2 + (c - (cnt - 1) / 2) * cell * 1.05, y: top + r * dy, s: Math.max(0.55, sz) }); } });
    return { pos, rows: R, sz: Math.max(0.55, sz) };
  }

  // ---------- رسم ----------
  const TAU = Math.PI * 2;
  function gold(g, x0, y0, x1, y1) { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#fff1b8'); q.addColorStop(0.5, '#e6b84a'); q.addColorStop(1, '#8a6414'); return q; }
  function bg(g, W, H, t) {
    const q = g.createLinearGradient(0, 0, 0, H); q.addColorStop(0, '#0b1a3e'); q.addColorStop(1, '#06122b'); g.fillStyle = q; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(70,120,200,.10)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = gold(g, 0, 0, W, H); g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12); g.lineWidth = 1; g.strokeRect(12, 12, W - 24, H - 24);
  }
  function pedestal(g, x, y, s) {
    g.fillStyle = '#27303c'; g.beginPath(); g.ellipse(x, y + 62 * s, 88 * s, 26 * s, 0, 0, TAU); g.fill();
    g.fillStyle = '#3b4656'; g.beginPath(); g.ellipse(x, y + 52 * s, 78 * s, 22 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(220,180,80,.6)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y + 52 * s, 78 * s, 22 * s, 0, 0, TAU); g.stroke();
  }
  function cube(g, x, y, s, n, lit, pulse) {
    const u = 48 * s;
    const glow = lit ? 0.5 + 0.5 * pulse : 0.15;
    g.save();
    g.shadowColor = 'rgba(70,200,255,' + glow + ')'; g.shadowBlur = (lit ? 26 : 8) * s;
    const top = [[x, y - u * 1.0], [x + u * 0.95, y - u * 0.5], [x, y], [x - u * 0.95, y - u * 0.5]];
    const left = [[x - u * 0.95, y - u * 0.5], [x, y], [x, y + u * 1.0], [x - u * 0.95, y + u * 0.5]];
    const right = [[x + u * 0.95, y - u * 0.5], [x, y], [x, y + u * 1.0], [x + u * 0.95, y + u * 0.5]];
    const poly = (p, c) => { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = 'rgba(190,245,255,.9)'; g.lineWidth = 1.5; g.stroke(); };
    const a = lit ? 0.95 : 0.55;
    poly(left, 'rgba(25,120,190,' + a + ')'); poly(right, 'rgba(15,95,165,' + a + ')'); poly(top, 'rgba(120,225,255,' + a + ')');
    g.restore();
    g.fillStyle = gold(g, x - u, y - u, x + u, y + u); g.font = 'bold ' + Math.round(46 * s) + 'px ' + BZ.FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(60,35,0,.8)'; g.lineWidth = 3; g.strokeText(String(n), x, y + 2 * s); g.fillText(String(n), x, y + 2 * s);
  }
  function gem(g, x, y, s, n, t) {
    const u = 56 * s;
    g.save(); g.shadowColor = 'rgba(255,200,40,.9)'; g.shadowBlur = 40 * s;
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = (i % 2 ? 0.78 : 1) * u; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath();
    const q = g.createRadialGradient(x - u * 0.3, y - u * 0.4, 4, x, y, u * 1.1); q.addColorStop(0, '#fff6c0'); q.addColorStop(0.5, '#f0b92a'); q.addColorStop(1, '#a16a08'); g.fillStyle = q; g.fill(); g.strokeStyle = '#ffe9a0'; g.lineWidth = 2; g.stroke(); g.restore();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.4, r1 = u * 1.2, r2 = u * (1.5 + 0.2 * Math.sin(t * 3 + i)); g.strokeStyle = 'rgba(255,225,120,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); g.stroke(); }
    g.fillStyle = '#3a2400'; g.font = 'bold ' + Math.round(44 * s) + 'px ' + BZ.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, y + 2);
  }
  function arrow(g, a, b, label, s, on) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 10, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const sx = a.x + ux * 62 * s, sy = a.y + uy * 40 * s - 14, ex = b.x - ux * 62 * s, ey = b.y - uy * 40 * s - 14;
    g.strokeStyle = on ? '#ffe28a' : 'rgba(230,180,60,.45)'; g.lineWidth = on ? 5 : 3;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx + (dy > 40 ? -40 : 0), my - (dy > 40 ? 10 : 18), ex, ey); g.stroke();
    const ang = Math.atan2(ey - (my - 14), ex - (mx + (dy > 40 ? -40 : 0)));
    g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - Math.cos(ang - 0.45) * 14, ey - Math.sin(ang - 0.45) * 14); g.lineTo(ex - Math.cos(ang + 0.45) * 14, ey - Math.sin(ang + 0.45) * 14); g.closePath(); g.fill();
    g.fillStyle = '#0a0a10'; g.strokeStyle = '#e6b84a'; g.lineWidth = 1.5;
    const lw = 46; g.beginPath(); g.roundRect ? g.roundRect(mx - lw / 2, my - 13 - (dy > 40 ? 8 : 12), lw, 24, 12) : g.rect(mx - lw / 2, my - 13, lw, 24); g.fill(); g.stroke();
    g.fillStyle = '#ffe28a'; g.font = 'bold 14px ' + BZ.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, mx, my - (dy > 40 ? 8 : 12));
  }
  function mirror(g, x, y, t, robotImg, lit) {
    g.save(); g.shadowColor = 'rgba(255,215,100,' + (lit ? 0.9 : 0.4) + ')'; g.shadowBlur = lit ? 28 : 12;
    g.beginPath(); g.ellipse(x, y, 52, 68, 0, 0, TAU); g.fillStyle = gold(g, x - 52, y - 68, x + 52, y + 68); g.fill(); g.restore();
    g.save(); g.beginPath(); g.ellipse(x, y, 42, 58, 0, 0, TAU); g.clip();
    const q = g.createLinearGradient(x - 40, y - 58, x + 40, y + 58); q.addColorStop(0, '#f4f6fa'); q.addColorStop(0.5, '#a9b4c4'); q.addColorStop(1, '#e8edf5'); g.fillStyle = q; g.fillRect(x - 45, y - 60, 90, 120);
    if (robotImg) robotImg(g, x, y);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - 14, y - 22, 10, 28, -0.3, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = '#3a2a00'; g.font = 'bold 40px ' + BZ.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.85; g.fillText('1', x, y + 4); g.globalAlpha = 1;
  }

  // ================= رابط تب =================
  BZ.pyramidPanel = function () {
    const W = 560, H = 900;
    const cv = BZ.cv(W, H, 'scope'), g = cv.getContext('2d');
    let N = 5, T = 3, lang = 'fa', talkOn = true, speed = 1;
    const st = { phase: 'idle', pt: 0, t: 0, x: X0, v: V0, nodeIdx: -1, cross: [], hop: null, said: new Set(), done: false, light: 0, acc: 0 };
    const spk = { start: 0, plan: null, src: null, q: [] };

    function ctxOk() { return BZ.audio.init() && BZ.audio.ctx; }
    function speak(text, opts) {
      if (!ctxOk()) return;
      const ctx = BZ.audio.ctx, say = { t: text, sp: (opts && opts.sp) || 1, f0: 120, vt: 1.08, em: (opts && opts.em) || 'neutral', rob: true };
      const plan = BZ.speech.plan(text, say.sp), buf = BZ.speech.buffer(ctx, say), now = ctx.currentTime;
      const at = Math.max(now + 0.03, spk.plan ? spk.start + spk.plan.dur + 0.15 : now);   // صف: بعد از جملهٔ قبل
      const src = ctx.createBufferSource(), gn = ctx.createGain(); src.buffer = buf; gn.gain.value = 0.9; src.connect(gn); gn.connect(BZ.audio.master); src.start(at);
      spk.q.push({ at, plan, src, text });
      spk.plan = plan; spk.start = at;
    }
    function stopSpeech() { spk.q.forEach((s) => { try { s.src.stop(); } catch (e) { /* ok */ } }); spk.q = []; spk.plan = null; }
    function mouth() {
      if (!BZ.audio.ctx) return { open: 0, v: 'e' };
      const now = BZ.audio.ctx.currentTime; spk.q = spk.q.filter((s) => now < s.at + s.plan.dur + 0.4);
      for (const s of spk.q) if (now >= s.at && now < s.at + s.plan.dur) return BZ.speech.mouthAt(s.plan.syl, now - s.at);
      return { open: 0, v: 'e' };
    }
    const speaking = () => { if (!BZ.audio.ctx) return false; const now = BZ.audio.ctx.currentTime; return spk.q.some((s) => now >= s.at && now < s.at + s.plan.dur); };

    // ----- حالت و کنترل -----
    function reset() { stopSpeech(); Object.assign(st, { phase: 'idle', pt: 0, t: 0, x: X0, v: V0, nodeIdx: -1, cross: [0], hop: null, said: new Set(), done: false, light: 0, acc: 0 }); updTable(); }
    function play() {
      if (st.phase === 'run' || st.phase === 'light') return;
      reset(); st.phase = 'light';
      if (talkOn) { speak(LINES[lang].hello()); speak(LINES[lang].rule()); }
    }
    const nodes = () => layout(N, W, H);

    // مسیر نور: منبع «۰» ← آینه ← مکعب اول؛ قانون بازتاب با بردار
    function rays() {
      const L = nodes(), P = { x: W / 2, y: 128 }, S = { x: 48, y: 70 }, tgt = L.pos[0];
      const d = { x: P.x - S.x, y: P.y - S.y }, dl = Math.hypot(d.x, d.y); d.x /= dl; d.y /= dl;
      // عمود آینه (آینهٔ افقی رو به پایین): n = (0, 1) ؛ r = d − 2(d·n)n
      const nrm = { x: 0, y: 1 }, dn = d.x * nrm.x + d.y * nrm.y, r = { x: d.x - 2 * dn * nrm.x, y: d.y - 2 * dn * nrm.y };
      const thI = Math.acos(Math.abs(dn)) * 180 / Math.PI, thR = Math.acos(Math.abs(r.x * nrm.x + r.y * nrm.y)) * 180 / Math.PI;
      return { S, P, d, r, tgt, thI, thR };
    }

    // ----- به‌روزرسانی فیزیک (هر فریم، با زیرگام‌های ثابت) -----
    let last = 0, hopsDone = 0;
    function step(dtReal) {
      dtReal = Math.min(dtReal, 0.12) * speed;
      if (st.phase === 'light') {
        st.light += dtReal / 2.2;
        if (st.light >= 1) { st.phase = 'run'; st.t = 0; st.x = X0; st.v = V0; st.cross = [0]; st.nodeIdx = 0; st.hop = null; }
      } else if (st.phase === 'run') {
        const dt = 1 / 240; let rest = dtReal / T;           // «گام» واحد زمان مسئله است؛ هر گام = T ثانیه
        st.acc += rest;
        while (st.acc >= dt) {
          const xp = st.x, tp = st.t; st.x += st.v * dt + 0.5 * ACC * dt * dt; st.v += ACC * dt; st.t += dt; st.acc -= dt;
          let n = st.cross.length;
          while (n <= N && st.x >= val(n)) { st.cross.push(tp + (val(n) - xp) / (st.x - xp) * dt); onCross(n); n++; }
        }
        if (st.hop) { st.hop.t += dtReal; if (st.hop.t >= st.hop.T) { st.nodeIdx = st.hop.to; st.hop = null; } }
        if (st.cross.length > N && !st.hop && !st.done) { st.done = true; if (talkOn) speak(LINES[lang].end(N), { em: 'happy' }); st.phase = 'end'; updTable(); }
      }
    }
    function onCross(n) {
      const L = nodes(), a = L.pos[n - 1], b = L.pos[n];
      const Tf = 0.7;                                          // زمان پرواز (ثانیه)
      // پرتابه با گرانش ثابت: y(t) = y0 + vy t + ½ g t²  ← vy از شرط رسیدن به مقصد
      const gr = 1800, dy = b.y - a.y, vy = (dy - 0.5 * gr * Tf * Tf) / Tf, vx = (b.x - a.x) / Tf;
      st.hop = { from: n - 1, to: n, t: 0, T: Tf, vx, vy, gr, a };
      if (talkOn && !st.said.has(n)) { st.said.add(n); speak(LINES[lang].node(n), { sp: 1.05 }); }
      updTable();
    }

    // ----- رسم هر فریم -----
    function robotPose(L, t) {
      let p;
      if (st.hop) { const h2 = st.hop, k = Math.min(h2.t, h2.T); p = { x: h2.a.x + h2.vx * k, y: h2.a.y + h2.vy * k + 0.5 * h2.gr * k * k, air: true }; }
      else if (st.nodeIdx >= 0 && L.pos[st.nodeIdx]) { const q = L.pos[st.nodeIdx]; p = { x: q.x, y: q.y, air: false }; }
      else p = { x: W / 2 - 150, y: 140, air: false };
      return p;
    }
    function drawRobot(gx, x, y, s, flip, m, t, emo) {
      gx.save();
      if (flip) { gx.translate(0, 2 * y); gx.scale(1, -1); }
      BZ.char.draw(gx, BZ.lib.char('c_robot'), { x, y, s, dir: 1, emo, open: m.open, vis: m.v, t, act: st.hop ? 'jump' : '', look: Math.sin(t) * 0.3, grow: 1 });
      gx.restore();
    }
    function paint(now) {
      const t = now / 1000, dt = last ? (now - last) / 1000 : 0; last = now; step(dt);
      const L = nodes(), s = L.sz, R = rays();
      bg(g, W, H, t);
      // عنوان
      g.fillStyle = gold(g, 0, 16, 0, 60); g.font = 'bold 34px ' + BZ.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('منطق هرم ۵۳', W / 2, 36);
      // منبع نور «۰»
      g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(R.S.x, R.S.y, 11, 0, TAU); g.fill(); g.fillStyle = '#0a0a10'; g.font = 'bold 14px ' + BZ.FONT; g.fillText('0', R.S.x, R.S.y + 1);
      g.fillStyle = 'rgba(255,230,150,.8)'; g.font = '12px ' + BZ.FONT; g.fillText('ورود', R.S.x, R.S.y + 26);
      // آینه + تصویر مجازی ربات (آینهٔ تخت: تصویر هم‌فاصله و وارونه)
      const rp = robotPose(L, t), m = mouth(), emo = speaking() ? 'happy' : (st.done ? 'happy' : 'neutral');
      mirror(g, R.P.x, R.P.y + 8, t, (gx, mx, my) => { const dyv = (rp.y - (R.P.y + 8)); gx.globalAlpha = 0.55; drawRobot(gx, mx + (rp.x - W / 2) * 0.12, my + 8, 0.34, true, m, t, emo); gx.globalAlpha = 1; }, st.phase !== 'idle');
      // پرتو
      if (st.phase !== 'idle') {
        const p1 = Math.min(1, st.light * 2), p2 = Math.max(0, Math.min(1, st.light * 2 - 1)), full = st.phase !== 'light';
        g.strokeStyle = 'rgba(255,230,140,.9)'; g.lineWidth = 3; g.shadowColor = '#ffd36a'; g.shadowBlur = 14;
        const e1 = { x: R.S.x + (R.P.x - R.S.x) * (full ? 1 : p1), y: R.S.y + (R.P.y - R.S.y) * (full ? 1 : p1) };
        g.beginPath(); g.moveTo(R.S.x, R.S.y); g.lineTo(e1.x, e1.y); g.stroke();
        if (full || p1 >= 1) { const q = L.pos[0], e2 = { x: R.P.x + (q.x - R.P.x) * (full ? 1 : p2), y: R.P.y + (q.y - 62 - R.P.y) * (full ? 1 : p2) }; g.beginPath(); g.moveTo(R.P.x, R.P.y); g.lineTo(e2.x, e2.y); g.stroke(); }
        g.shadowBlur = 0;
        // نمایش زاویه‌ها
        g.fillStyle = '#ffe28a'; g.font = '12px ' + BZ.FONT; g.textAlign = 'left'; g.fillText('θ تابش = ' + R.thI.toFixed(1) + '°', 20, 118); g.fillText('θ بازتاب = ' + R.thR.toFixed(1) + '°', 20, 136);
      }
      // مکعب‌ها
      const lastIdx = N;
      L.pos.forEach((q) => { pedestal(g, q.x, q.y, L.sz); });
      for (let i = 1; i < L.pos.length; i++) arrow(g, L.pos[i - 1], L.pos[i], '+' + inc(i), L.sz, st.cross.length > i);
      L.pos.forEach((q, i) => {
        const lit = st.cross.length > i, pulse = 0.5 + 0.5 * Math.sin(t * 4 + i);
        if (i === lastIdx) gem(g, q.x, q.y - 10 * L.sz, L.sz, val(i), t); else cube(g, q.x, q.y - 8 * L.sz, L.sz, val(i), lit, pulse);
      });
      // مرحلهٔ بعدی (سایه)
      const nx = L.pos[N];
      if (nx) { g.fillStyle = 'rgba(255,225,130,.7)'; g.font = '13px ' + BZ.FONT; g.textAlign = 'center'; g.fillText('مرحلهٔ بعد: ' + val(N + 1) + '  (+' + inc(N + 1) + ')', W / 2, H - 205); }
      // ربات
      const sc = 0.5 * L.sz + (rp.air ? 0.04 : 0);
      drawRobot(g, rp.x, rp.y - (rp.air ? 0 : 58 * L.sz), sc, false, m, t, emo);
      // جعبهٔ پایین
      g.fillStyle = 'rgba(6,18,43,.85)'; g.strokeStyle = gold(g, 0, 0, W, 0); g.lineWidth = 2; g.fillRect(24, H - 180, W - 48, 150); g.strokeRect(24, H - 180, W - 48, 150);
      g.fillStyle = '#ffe9a6'; g.font = 'bold 15px ' + BZ.FONT; g.textAlign = 'center';
      g.fillText('هر مرحله ۲ واحد بیشتر از مرحلهٔ قبل اضافه می‌شود', W / 2, H - 156);
      g.font = '14px monospace'; g.fillStyle = '#b8e8ff';
      g.fillText('a(n) = n² + 5n + 2   ⇔   x(t) = x₀ + v₀t + ½at²', W / 2, H - 128);
      g.fillText('x₀ = 2 ،  v₀ = 5 ،  a = 2 (واحد/گام²)', W / 2, H - 106);
      g.fillStyle = '#ffe28a'; g.fillText('t = ' + st.t.toFixed(3) + ' گام   x = ' + st.x.toFixed(3) + '   v = ' + st.v.toFixed(3), W / 2, H - 78);
      g.fillStyle = '#9fd6b2'; g.fillText('آینه = 1   |   مکعب = عدد', W / 2, H - 52);
    }

    // ----- جدول تأیید عددی -----
    const tbl = h('div', { class: 'etable' }), verdict = h('div', { class: 'note strong' });
    function updTable() {
      tbl.innerHTML = '';
      const ref = simulate(N), head = h('div', { class: 'erow' }, h('b', null, 'n'), h('b', null, 'a(n)'), h('b', null, 'Δ'), h('b', null, 'ΔΔ'), h('b', null, 'عبور در شبیه‌ساز'), h('b', null, 'خطا'));
      tbl.append(head);
      let maxErr = 0;
      for (let n = 0; n <= N; n++) {
        const dd = n >= 2 ? inc(n) - inc(n - 1) : '—', d = n >= 1 ? '+' + inc(n) : '—', tc = ref[n];
        const err = Math.abs(tc - n); maxErr = Math.max(maxErr, err);
        tbl.append(h('div', { class: 'erow', style: { opacity: st.cross.length > n || st.phase === 'idle' ? 1 : 0.45 } }, h('span', null, n), h('b', null, val(n)), h('span', null, d), h('span', null, dd), h('span', null, tc.toFixed(4)), h('span', null, err.toExponential(1))));
      }
      verdict.textContent = 'تأیید: زمان عبور از هر مکعب با n برابر است (بیشینهٔ خطا ' + maxErr.toExponential(1) + ' گام) ← تفاضل مرتبهٔ دوم ثابت = ۲ = شتاب ← الگو دقیقاً حرکت با شتاب ثابت است.';
    }

    // ----- متن به گفتار آزاد -----
    let txt = 'سلام! من یک ربات سخنگوی آفلاین هستم. Hello, I can also speak English.';
    const ti = h('input', { type: 'text', class: 'inp', value: txt, style: { flex: '1', minWidth: '200px' } }), phon = h('div', { class: 'note' }, '');
    const upd = () => { txt = ti.value; phon.textContent = 'آوانویسی: ' + BZ.speech.transcribe(txt); }; ti.addEventListener('input', upd); upd();

    const playB = BZ.btn('▶ اجرا', play, 'go'), stopB = BZ.btn('■ توقف', () => { reset(); }, 'sm');
    const controls = h('div', null,
      h('div', { class: 'r-ctrl' }, playB, stopB, BZ.toggle('ربات صحبت کند', true, (v) => { talkOn = v; if (!v) stopSpeech(); }), BZ.seg([{ v: 'fa', t: 'فارسی' }, { v: 'en', t: 'English' }], lang, (v) => { lang = v; })),
      h('div', { class: 'sl-grid' },
        BZ.slider({ label: 'تعداد مرحله (n تا)', min: 3, max: MAXN, step: 1, value: N, fmt: (v) => v + ' → ' + val(v), onInput: (v) => { N = v; reset(); } }),
        BZ.slider({ label: 'مدت هر گام', min: 1.5, max: 6, step: 0.5, value: T, fmt: (v) => v + ' s', onInput: (v) => { T = v; } }),
        BZ.slider({ label: 'سرعت شبیه‌سازی', min: 0.5, max: 3, step: 0.25, value: speed, fmt: (v) => v + '×', onInput: (v) => { speed = v; } })));
    const tts = h('section', { class: 'exp' }, h('h3', null, 'نوشتار به گفتار (آفلاین)'), h('p', { class: 'note' }, 'هر متن فارسی یا انگلیسی بنویسید؛ ربات با موتور TTS داخلی می‌گوید و دهانش با آواها حرکت می‌کند. شماره‌ها را هم به حروف می‌خواند.'),
      h('div', { class: 'r-ctrl' }, ti, BZ.btn('🗣 بگو', () => { if (!ctxOk()) return; stopSpeech(); speak(txt); }, 'go')), phon);
    const phys = h('section', { class: 'exp' }, h('h3', null, 'منطق و فیزیک'), h('p', { class: 'note' },
      'افزایش‌ها ۶، ۸، ۱۰، ۱۲، ۱۴ هستند؛ هر مرحله ۲ بیشتر. پس تفاضل مرتبهٔ دوم ثابت و برابر ۲ است و این یعنی حرکت با شتاب ثابت: x(t) = x₀ + v₀t + ½at² با x₀=۲، v₀=۵، a=۲ که همان a(n)=n²+5n+2 را می‌دهد. جابه‌جایی در هر گام برابر میانگین سرعت آن بازه است: v₀ + a(n−½) = ۲n+۴. ورود با آینهٔ تخت: بردار بازتاب r = d − 2(d·n)n که زاویهٔ تابش و بازتاب را برابر می‌کند؛ تصویر مجازی ربات هم‌فاصله پشت آینه و وارونه دیده می‌شود. پرش ربات بین مکعب‌ها پرتابهٔ واقعی با گرانش ثابت است.'),
      tbl, verdict);
    reset(); st.phase = 'idle';
    const root = h('div', { class: 'lab' }, h('section', { class: 'exp' }, h('h3', null, 'هرم ۵۳: آینه، نور و ربات سخنگو'), cv, controls), phys, tts);
    root.paint = paint;
    return root;
  };
  BZ.pyr = { val, inc, simulate, faNum, enNum, lines: LINES };
  BZ.extraTests = (BZ.extraTests || []).concat([
    ['هرم: a(n)=n²+5n+2 و افزایش‌ها ۶،۸،۱۰،۱۲،۱۴', () => { const v = [0, 1, 2, 3, 4, 5].map(val), d = [1, 2, 3, 4, 5].map(inc); return [v.join() === '2,8,16,26,38,52' && d.join() === '6,8,10,12,14', v.join(',')]; }],
    ['هرم: شبیه‌ساز شتاب ثابت از هر مکعب در زمان n می‌گذرد', () => { const c = simulate(8); let e = 0; c.forEach((t, n) => { e = Math.max(e, Math.abs(t - n)); }); return [e < 1e-3, 'خطا ' + e.toExponential(1)]; }],
    ['هرم: بازتاب آینه زاویهٔ تابش = بازتاب', () => { const d = { x: 0.6, y: 0.8 }, nn = { x: 0, y: 1 }, dn = d.x * nn.x + d.y * nn.y, r = { x: d.x - 2 * dn * nn.x, y: d.y - 2 * dn * nn.y }; return [Math.abs(Math.hypot(r.x, r.y) - 1) < 1e-9 && Math.abs(r.y + d.y) < 1e-9 && Math.abs(r.x - d.x) < 1e-9, 'r=(' + r.x + ',' + r.y + ')']; }],
    ['هرم: اعداد به حروف فارسی', () => [faNum(52) === 'پنجاه و دو' && faNum(128) === 'صد و بیست و هشت' && faNum(16) === 'شانزده', faNum(52) + ' | ' + faNum(128)]],
  ]);
})();
