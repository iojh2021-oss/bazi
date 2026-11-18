/* diag.js — «عیب‌یابی»: ثبت خودکار خطاها، توقف‌ها (هنگ)، افت فریم، زمان‌بندی صدای عصبی/شبکه/صدا و گزارش قابل‌کپی.
   باید زودتر از بقیه بارگذاری شود تا خطاهای راه‌اندازی هم ثبت شوند. هیچ داده‌ای به بیرون نمی‌رود. */
(function () {
  'use strict';
  const BZ = window.BZ = window.BZ || {};
  const T0 = performance.now(), MAX = 700, KEY = 'bz_diag_v1', FLAG = 'bz_diag_clean';
  const log = [], series = [];   // series: نمونه‌های حافظه
  let dirty = false, prev = null, sid = Date.now().toString(36);
  const stat = { err: 0, stall: 0, stallMs: 0, stallMax: 0, jank: 0, jankMax: 0, longtask: 0, ltMax: 0 };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* پر یا بسته */ } } };

  // ----- جلسهٔ قبل -----
  try { const p = JSON.parse(ls.get(KEY) || 'null'); if (p && p.log) prev = p; } catch (e) { prev = null; }
  const wasClean = ls.get(FLAG) !== '0';
  ls.set(FLAG, '0');

  const D = (BZ.diag = {
    ctx() {
      const c = { view: '', tv: '', radio: '', vcr: '', hifi: '', audio: '', ntts: '', net: '', mem: '' };
      try { c.view = BZ.store && BZ.store.get('view', ''); } catch (e) { /* */ }
      try { if (BZ.tv) c.tv = BZ.tv.on ? (BZ.tv.input === 'AV' ? 'AV' : 'CH' + BZ.tv.channel) : 'off'; if (BZ.radio) c.radio = BZ.radio.on ? 'on' : 'off'; if (BZ.vcr) c.vcr = BZ.vcr.on ? 'on' : 'off'; if (BZ.hifi) c.hifi = BZ.hifi.on ? 'on' : 'off'; } catch (e) { /* */ }
      try { c.audio = BZ.audio && BZ.audio.ctx ? BZ.audio.ctx.state : 'none'; } catch (e) { /* */ }
      try { if (BZ.ntts && BZ.ntts.diagState) c.ntts = BZ.ntts.diagState(); } catch (e) { /* */ }
      try { if (BZ.net) c.net = (BZ.net.mode || '') + (BZ.net.streams ? ' streams=' + BZ.net.streams.size : ''); } catch (e) { /* */ }
      try { if (performance.memory) c.mem = Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB'; } catch (e) { /* */ }
      return c;
    },
    add(cat, lvl, msg, ms, extra) {
      const e = { t: Math.round(performance.now() - T0), cat, lvl, msg: String(msg).slice(0, 300), ms: ms == null ? null : Math.round(ms * 10) / 10 };
      if (extra) e.x = extra;
      log.push(e); if (log.length > MAX) log.splice(0, log.length - MAX);
      dirty = true; return e;
    },
    mark(cat, msg, ms, extra) { return D.add(cat, 'i', msg, ms, extra); },
    warn(cat, msg, ms, extra) { return D.add(cat, 'w', msg, ms, extra); },
    // اندازه‌گیری یک کار هم‌زمان؛ اگر از آستانه بیشتر شد ثبت می‌شود
    time(cat, msg, fn, thr) { const t = performance.now(); try { return fn(); } finally { const d = performance.now() - t; if (d >= (thr == null ? 12 : thr)) D.add(cat, d > 60 ? 'w' : 'i', msg, d); } },
    get stat() { return stat; }, get log() { return log; }, get prev() { return prev; }, get wasClean() { return wasClean; }, get series() { return series; },
    clear() { log.length = 0; Object.keys(stat).forEach((k) => { stat[k] = 0; }); series.length = 0; dirty = true; },
  });

  D.add('sys', 'i', 'شروع جلسه ' + sid + (wasClean ? '' : ' — جلسهٔ قبل ناگهانی بسته شد (کرش/بستن اجباری/کمبود حافظه؟)'));
  if (!wasClean) { D.add('sys', 'e', 'پایان ناگهانی جلسهٔ قبل'); stat.err++; }
  try { D.add('sys', 'i', 'دستگاه: ' + (navigator.hardwareConcurrency || '?') + ' هسته، حافظه ' + (navigator.deviceMemory || '?') + 'GB، DPR ' + (window.devicePixelRatio || 1) + '، ' + innerWidth + '×' + innerHeight + '، ' + navigator.userAgent); } catch (e) { /* */ }

  // ----- خطاها -----
  window.addEventListener('error', (e) => { stat.err++; D.add('err', 'e', (e.message || 'error') + (e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : ''), null, D.ctx()); });
  window.addEventListener('unhandledrejection', (e) => { stat.err++; D.add('err', 'e', 'promise: ' + String((e.reason && (e.reason.stack || e.reason.message)) || e.reason).slice(0, 260), null, D.ctx()); });
  ['error', 'warn'].forEach((k) => { const o = console[k]; console[k] = function () { try { if (k === 'error') stat.err++; D.add('console', k === 'error' ? 'e' : 'w', Array.prototype.map.call(arguments, (a) => (a && a.message) || (typeof a === 'object' ? (() => { try { return JSON.stringify(a); } catch (x) { return String(a); } })() : String(a))).join(' ')); } catch (e) { /* */ } return o.apply(console, arguments); }; });

  // ----- توقف رشتهٔ اصلی (هنگ): ضربان ۱۰۰ms؛ انحراف زیاد = رشته مشغول بوده -----
  let lastBeat = performance.now();
  setInterval(() => {
    const now = performance.now(), drift = now - lastBeat - 100; lastBeat = now;
    if (document.hidden) return;   // پس‌زمینه عمداً کند می‌شود
    if (drift > 200) { stat.stall++; stat.stallMs += drift; stat.stallMax = Math.max(stat.stallMax, drift); D.add('stall', drift > 800 ? 'e' : 'w', 'رشتهٔ اصلی ' + Math.round(drift) + 'ms مشغول بود', drift, D.ctx()); }
  }, 100);
  try { new PerformanceObserver((li) => li.getEntries().forEach((e) => { stat.longtask++; stat.ltMax = Math.max(stat.ltMax, e.duration); if (e.duration > 120) D.add('longtask', e.duration > 400 ? 'w' : 'i', 'long task ' + Math.round(e.duration) + 'ms', e.duration); })).observe({ entryTypes: ['longtask'] }); } catch (e) { /* پشتیبانی نشده */ }
  // ----- افت فریم -----
  let lf = 0;
  (function raf(n) { if (lf && !document.hidden) { const g = n - lf; if (g > 120 && g < 5000) { stat.jank++; stat.jankMax = Math.max(stat.jankMax, g); D.add('jank', g > 300 ? 'w' : 'i', 'فاصلهٔ فریم ' + Math.round(g) + 'ms', g, D.ctx()); } } lf = document.hidden ? 0 : n; requestAnimationFrame(raf); })(performance.now());
  // ----- حافظه -----
  setInterval(() => { try { if (performance.memory) { series.push([Math.round((performance.now() - T0) / 1000), Math.round(performance.memory.usedJSHeapSize / 1048576)]); if (series.length > 80) series.shift(); } } catch (e) { /* */ } }, 5000);
  // ----- ذخیره برای جلسهٔ بعد -----
  const persist = () => { if (!dirty) return; dirty = false; ls.set(KEY, JSON.stringify({ sid, at: Date.now(), log: log.slice(-160), stat })); };
  setInterval(persist, 3000);
  const clean = () => { persist(); ls.set(FLAG, '1'); };
  window.addEventListener('pagehide', clean); document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  // ================= تحلیل و گزارش =================
  const near = (e) => log.filter((x) => x !== e && x.cat !== 'stall' && x.cat !== 'jank' && x.cat !== 'longtask' && x.t <= e.t + 50 && x.t >= e.t - (e.ms || 0) - 600);
  D.analyze = function () {
    const out = [], stalls = log.filter((e) => e.cat === 'stall');
    const nt = stalls.filter((e) => e.x && e.x.ntts && /load:|busy|q=[1-9]/.test(e.x.ntts)).length;
    const byView = {}; stalls.forEach((e) => { const k = (e.x && e.x.view) || '?'; byView[k] = (byView[k] || 0) + 1; });
    out.push('توقف‌های بالای ۲۰۰ms: ' + stalls.length + ' (جمع ' + Math.round(stat.stallMs) + 'ms، بیشینه ' + Math.round(stat.stallMax) + 'ms)');
    if (stalls.length) out.push('بیشترین توقف‌ها در تب: ' + Object.entries(byView).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join('، '));
    if (stalls.length && nt / stalls.length > 0.4) out.push('⚠️ ' + Math.round(100 * nt / stalls.length) + '٪ توقف‌ها هم‌زمان با کار صدای عصبی بود ← مشکوک به بارگذاری/ساخت صدا.');
    const nm = log.filter((e) => e.cat === 'ntts' && /^(load|synth|worker|fallback)/.test(e.msg));
    const loads = nm.filter((e) => e.msg.startsWith('load') && e.ms), syn = nm.filter((e) => e.msg.startsWith('synth') && e.ms);
    if (loads.length) out.push('بارگذاری مدل صدا: ' + loads.map((e) => Math.round(e.ms / 100) / 10 + 's').join('، '));
    if (syn.length) { const a = syn.reduce((s, e) => s + e.ms, 0) / syn.length; out.push('ساخت جمله با صدای عصبی: میانگین ' + (a / 1000).toFixed(1) + 's از ' + syn.length + ' جمله' + (a > 4000 ? ' ← کند؛ روی این گوشی بهتر است صدا از قبل ساخته یا کوتاه‌تر شود' : '')); }
    if (log.some((e) => e.msg.startsWith('fallback'))) out.push('⚠️ worker کار نکرد و صدای عصبی روی رشتهٔ اصلی اجرا شد ← علت هنگ‌های بزرگ این است. (متن خطا در ثبت‌ها)');
    else if (log.some((e) => e.msg.startsWith('worker ok'))) out.push('✅ صدای عصبی در worker (خارج از رشتهٔ رابط) اجرا می‌شود.');
    const fb = log.filter((e) => e.cat === 'audio' && /sync-buffer/.test(e.msg));
    if (fb.length) out.push('ساخت هم‌زمان موج گفتار هنگام پخش ' + fb.length + ' بار (هر کدام تا ' + Math.round(Math.max.apply(null, fb.map((e) => e.ms))) + 'ms) ← می‌تواند لرزش صدا/تصویر بدهد.');
    if (series.length > 3) { const a = series[0][1], b = series[series.length - 1][1]; out.push('حافظهٔ JS: ' + a + 'MB → ' + b + 'MB' + (b - a > 60 ? ' ← رشد زیاد (نشت یا کش بزرگ)' : '')); }
    out.push('افت فریم (>۱۲۰ms): ' + stat.jank + '، بیشینه ' + Math.round(stat.jankMax) + 'ms | خطاها: ' + stat.err);
    if (!wasClean) out.push('⚠️ جلسهٔ قبلی ناگهانی بسته شد؛ ثبت‌های آن زیر «جلسهٔ قبل» هست.');
    return out;
  };
  D.report = function () {
    const f = (e) => '[' + String((e.t / 1000).toFixed(1)).padStart(6) + 's] ' + e.cat.padEnd(7) + (e.lvl === 'e' ? 'ERR ' : e.lvl === 'w' ? 'WRN ' : '    ') + e.msg + (e.ms != null ? ' (' + e.ms + 'ms)' : '') + (e.x ? '  ' + JSON.stringify(e.x) : '');
    const L = ['=== گزارش عیب‌یابی Bazi Lab ===', 'زمان: ' + new Date().toISOString(), 'نمای فعلی: ' + JSON.stringify(D.ctx()), '', '--- تحلیل خودکار ---'].concat(D.analyze().map((x) => '• ' + x));
    const worst = log.filter((e) => e.cat === 'stall').sort((a, b) => b.ms - a.ms).slice(0, 8);
    if (worst.length) { L.push('', '--- بدترین توقف‌ها و کارهای هم‌زمان ---'); worst.forEach((e) => { L.push(f(e)); near(e).slice(-6).forEach((n) => L.push('      ↳ ' + f(n))); }); }
    L.push('', '--- ثبت‌ها (' + log.length + ') ---'); log.slice(-260).forEach((e) => L.push(f(e)));
    if (prev && prev.log) { L.push('', '--- جلسهٔ قبل (' + prev.sid + ') آخرین ثبت‌ها ---'); prev.log.slice(-60).forEach((e) => L.push(f(e))); }
    return L.join('\n');
  };

  // ================= رابط =================
  BZ.diagPanel = function () {
    const h = BZ.h, box = h('div', { class: 'panel' }), list = h('div', { class: 'diag-list' }), sum = h('div', { class: 'note', style: { whiteSpace: 'pre-wrap', lineHeight: '1.9' } });
    let filter = 'all';
    const col = (e) => (e.lvl === 'e' ? '#ff8a8a' : e.lvl === 'w' ? '#ffd27a' : '#9fb4c8');
    function draw() {
      sum.textContent = D.analyze().map((x) => '• ' + x).join('\n');
      list.innerHTML = '';
      const rows = log.filter((e) => filter === 'all' || (filter === 'bad' ? e.lvl !== 'i' : e.cat === filter)).slice(-140).reverse();
      rows.forEach((e) => list.append(h('div', { style: { fontFamily: 'monospace', fontSize: '11px', color: col(e), padding: '2px 0', borderBottom: '1px solid #1f2933', direction: 'ltr', textAlign: 'left', wordBreak: 'break-word' } }, (e.t / 1000).toFixed(1) + 's ' + e.cat + ' ' + e.msg + (e.ms != null ? ' (' + e.ms + 'ms)' : '') + (e.x && e.x.view ? ' [' + e.x.view + (e.x.tv ? ' tv:' + e.x.tv : '') + (e.x.ntts ? ' n:' + e.x.ntts : '') + ']' : ''))));
      if (!rows.length) list.append(h('p', { class: 'note' }, 'ثبتی برای این فیلتر نیست.'));
    }
    const copy = () => { const t = D.report(); const done = () => BZ.toast('گزارش کپی شد؛ در چت بچسبانید'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done)); else fallbackCopy(t, done); };
    function fallbackCopy(t, done) { const ta = h('textarea', { style: { position: 'fixed', left: '-999px' } }, t); document.body.append(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { BZ.toast('کپی نشد؛ از «ذخیره فایل» استفاده کنید'); } ta.remove(); }
    const save = () => { const a = h('a', { href: URL.createObjectURL(new Blob([D.report()], { type: 'text/plain;charset=utf-8' })), download: 'bazi-diag-' + Date.now() + '.txt' }); document.body.append(a); a.click(); a.remove(); };
    const share = () => { const t = D.report(); if (navigator.share) navigator.share({ title: 'گزارش عیب‌یابی Bazi Lab', text: t }).catch(() => {}); else copy(); };
    // آزمون سریع: بار رشتهٔ اصلی در شرایط کنترل‌شده
    const bench = BZ.btn('⏱ آزمون سریع', () => {
      D.mark('sys', 'آزمون سریع شروع شد');
      try {
        BZ.audio.init(); const c = BZ.audio.ctx; const say = { t: 'سلام به همهٔ دوستان، این یک آزمون سرعت است ' + Math.random().toFixed(4), sp: 1, f0: 170, vt: 1, em: 'neutral' };
        let t = performance.now(); BZ.speech.samples(say); D.mark('perf', 'آزمون: ساخت موج گفتار فرمانتی', performance.now() - t);
        const cv = BZ.cv(560, 900), g = cv.getContext('2d'); t = performance.now(); for (let i = 0; i < 20; i++) { g.fillStyle = '#' + (i * 1234567 % 0xffffff).toString(16).padStart(6, '0'); g.fillRect(0, i * 40, 560, 40); g.beginPath(); g.arc(280, 450, 200, 0, 7); g.fill(); } D.mark('perf', 'آزمون: ۲۰ رسم بوم بزرگ', performance.now() - t);
        t = performance.now(); let s = 0; for (let i = 0; i < 3e6; i++) s += Math.sqrt(i); D.mark('perf', 'آزمون: ۳ میلیون محاسبه', performance.now() - t);
        if (BZ.ntts) D.mark('ntts', 'وضعیت صدای عصبی: ' + BZ.ntts.diagState());
        if (c) D.mark('sys', 'AudioContext: ' + c.state + ' ' + c.sampleRate + 'Hz');
      } catch (e) { D.add('err', 'e', 'آزمون سریع: ' + e.message); }
      draw();
    });
    const seg = ['all', 'bad', 'stall', 'ntts', 'audio', 'net', 'err', 'perf'].map((k) => BZ.btn({ all: 'همه', bad: 'هشدار/خطا', stall: 'توقف', ntts: 'صدای عصبی', audio: 'صدا', net: 'سرور', err: 'خطا', perf: 'آزمون' }[k], () => { filter = k; draw(); }, 'sm'));
    box.append(h('h3', null, '🩺 عیب‌یابی و گزارش'), BZ.note('همهٔ هنگ‌ها، خطاها و زمان‌بندی‌ها خودکار ثبت می‌شوند. پس از دیدن مشکل (مثلاً هنگ هنگام صدای عصبی)، به این تب بیایید، «کپی گزارش» را بزنید و متن را برای تحلیل بفرستید.'),
      h('div', { class: 'r-ctrl' }, BZ.btn('📋 کپی گزارش', copy, 'go'), BZ.btn('📤 اشتراک', share), BZ.btn('💾 ذخیره فایل', save), bench, BZ.btn('🗑 پاک‌کردن', () => { D.clear(); draw(); }, 'sm'), BZ.btn('↻ تازه', draw, 'sm')),
      h('h3', null, 'تحلیل خودکار'), sum, h('div', { class: 'r-ctrl' }, seg), list);
    draw();
    const el = box; el.paint = (() => { let n = 0; return () => { if (++n % 60 === 0) draw(); }; })();
    return el;
  };
})();
