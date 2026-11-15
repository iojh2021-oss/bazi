/* studio.js — استودیوی ساخت برنامه (پخش در اتر)، آزمون خودکار اکوسیستم، دفتر آزمایش و قاب اصلی آزمایشگاه */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;
  const card = (title, concept, ...kids) => h('section', { class: 'exp' }, h('h3', null, title), h('p', { class: 'note' }, concept), ...kids);
  const NOTES = ['دو C', 'دو‌دیز C#', 'ر D', 'ر‌دیز D#', 'می E', 'فا F', 'فا‌دیز F#', 'سل G', 'سل‌دیز G#', 'لا A', 'لا‌دیز A#', 'سی B'];

  // ================= استودیوی برنامه‌سازی =================
  function studioExp() {
    const W = BZ.world;
    const S = { kind: 'radio', name: 'برنامهٔ من', style: 'pop', bpm: 100, root: 0, scale: 'major', density: 0.6, f0: 120, scene: 'music', pal: ['#150a2a', '#ff3d81', '#ffd23f'], title: '', ticker: 'برنامهٔ ساخته‌شده در استودیوی آزمایشگاه', band: 'FM', freq: 99.5, power: 50, x: 60, y: 55, stereo: true, chan: 15 };
    const prevCv = BZ.cv(320, 240, 'scope'), pg = prevCv.getContext('2d');
    const rangeEl = h('div', { class: 'note strong' }), list = h('div', { class: 'tlist' });
    let preview = null, prevProg = null;
    const mkProg = (id) => ({ id: id || 'preview', name: S.name, kind: S.style === 'talk' ? 'talk' : 'music', audio: { style: S.style, bpm: S.bpm, root: 48 + S.root, scale: S.scale, seed: (id || 'pv') + S.name, density: S.density, f0: S.f0 }, video: { scene: S.scene, pal: S.pal.slice(), title: S.title || S.name, ticker: S.ticker } });
    function range() {
      const src = { band: S.kind === 'tv' ? 'FM' : S.band, power: S.power, freq: S.freq }, night = W.isNight(), fl = BZ.rf.noiseFloor(src.band, W.env); let r = 0;
      for (let d = 1; d <= 160; d++) { if ((BZ.rf.txdB(src) - BZ.rf.pathLoss(src, d, night) - fl) / 30 >= 0.25) r = d; else if (d > r + 3) break; }
      const dd = Math.hypot(S.x - W.env.rx.x, S.y - W.env.rx.y), st = BZ.rf.strength({ band: src.band, power: S.power, freq: S.freq, x: S.x, y: S.y }, W.env, night);
      rangeEl.textContent = 'برد تقریبی (قدرت ≥ ۲۵٪): ' + r + ' کیلومتر • فاصله تا گیرندهٔ شما: ' + dd.toFixed(1) + ' km • قدرت در محل گیرنده: ' + Math.round(st * 100) + '٪';
    }
    const fld = (label, el) => h('label', { class: 'fld' }, h('span', null, label), el);
    const inp = (type, key, extra) => { const i = h('input', Object.assign({ type, class: 'inp', value: S[key] }, extra || {})); i.addEventListener('input', () => { S[key] = type === 'number' ? +i.value : i.value; range(); }); return i; };
    const colors = [0, 1, 2].map((i) => { const c = h('input', { type: 'color', value: S.pal[i], class: 'inp clr' }); c.addEventListener('input', () => { S.pal[i] = c.value; }); return c; });
    const kind = BZ.seg([{ v: 'radio', t: 'ایستگاه رادیو' }, { v: 'tv', t: 'شبکهٔ تلویزیون' }], 'radio', (v) => { S.kind = v; radioF.style.display = v === 'radio' ? '' : 'none'; tvF.style.display = v === 'tv' ? '' : 'none'; if (v === 'tv' && S.scene === 'blue') S.scene = 'music'; range(); });
    const style = BZ.select(Object.keys(BZ.STYLE_NAMES).map((k) => ({ v: k, t: BZ.STYLE_NAMES[k] })), S.style, (v) => { S.style = v; });
    const scale = BZ.select(Object.keys(BZ.SCALES).map((k) => ({ v: k, t: BZ.SCALE_NAMES[k] })), S.scale, (v) => { S.scale = v; });
    const root = BZ.select(NOTES.map((n, i) => ({ v: String(i), t: n })), '0', (v) => { S.root = +v; });
    const scene = BZ.select(['music', 'news', 'nature', 'sport', 'cartoon', 'weather', 'cinema', 'testcard'].map((k) => ({ v: k, t: { music: 'موزیک‌ویدئو', news: 'خبر', nature: 'طبیعت', sport: 'ورزش', cartoon: 'کارتون', weather: 'هواشناسی', cinema: 'سینما', testcard: 'تصویر آزمون' }[k] })), S.scene, (v) => { S.scene = v; });
    const band = BZ.select([{ v: 'AM', t: 'AM (kHz)' }, { v: 'FM', t: 'FM (MHz)' }, { v: 'SW', t: 'SW (MHz)' }], 'FM', (v) => { S.band = v; const B = BZ.BANDS[v]; S.freq = v === 'AM' ? 1062 : v === 'FM' ? 99.5 : 7.1; freqI.value = S.freq; stereoT.style.display = v === 'FM' ? '' : 'none'; range(); });
    const freqI = inp('number', 'freq', { step: '0.05' });
    const stereoT = BZ.toggle('استریو', true, (v) => { S.stereo = v; });
    const radioF = h('div', { class: 'fgrid' }, fld('باند', band), fld('فرکانس', freqI), stereoT);
    const tvF = h('div', { class: 'fgrid', style: { display: 'none' } }, fld('شمارهٔ کانال (1–69)', inp('number', 'chan', { min: 1, max: 69 })));
    const bpm = BZ.slider({ label: 'تمپو (BPM)', min: 50, max: 170, step: 1, value: S.bpm, fmt: (v) => v + '', onInput: (v) => { S.bpm = v; } });
    const dens = BZ.slider({ label: 'تراکم نت‌ها', min: 0.1, max: 1, step: 0.05, value: S.density, fmt: (v) => v.toFixed(2), onInput: (v) => { S.density = v; } });
    const pw = BZ.slider({ label: 'توان فرستنده (کیلووات)', min: 1, max: 500, step: 1, value: S.power, fmt: (v) => v + ' kW', onInput: (v) => { S.power = v; range(); } });
    const px = BZ.slider({ label: 'موقعیت X (km)', min: 0, max: 100, step: 1, value: S.x, fmt: (v) => v + '', onInput: (v) => { S.x = v; range(); } });
    const py = BZ.slider({ label: 'موقعیت Y (km)', min: 0, max: 100, step: 1, value: S.y, fmt: (v) => v + '', onInput: (v) => { S.y = v; range(); } });
    function stopPrev() { if (preview) { preview.stop(); preview = null; } }
    const prevBtn = BZ.btn('🔊 پیش‌شنیدن (۱۵ ثانیه)', () => {
      if (!BZ.audio.init()) return; stopPrev(); prevProg = mkProg(); preview = new BZ.ProgramPlayer(BZ.audio.ctx, prevProg, BZ.audio.master, { t0: 0 }); const me = preview; setTimeout(() => { if (preview === me) stopPrev(); }, 15000);
    });
    function refreshList() {
      list.innerHTML = '';
      const C = W.custom; const row = (txt, kind, id) => list.append(h('div', { class: 'trow' }, txt, BZ.btn('حذف', () => { W.removeCustom(kind, id); refreshList(); }, 'sm')));
      C.stations.forEach((s) => row('📻 ' + s.name + ' — ' + s.band + ' ' + s.freq, 'stations', s.id));
      C.channels.forEach((c) => row('📺 ' + c.name + ' — کانال ' + c.number, 'channels', c.id));
      if (!C.stations.length && !C.channels.length) list.append(h('div', { class: 'note' }, 'هنوز برنامه‌ای در اتر نیست.'));
    }
    const publish = BZ.btn('📡 پخش در اتر', () => {
      const name = (S.name || '').trim(); if (!name) { BZ.toast('نام برنامه را بنویسید'); return; }
      const pid = BZ.uid('p'), prog = mkProg(pid);
      if (S.kind === 'radio') {
        const B = BZ.BANDS[S.band];
        if (!(S.freq >= B.min && S.freq <= B.max)) { BZ.toast('فرکانس باید بین ' + B.min + ' و ' + B.max + ' باشد'); return; }
        const clash = W.stations.find((s) => s.band === S.band && Math.abs(s.freq - S.freq) < B.bw * 2);
        if (clash) { BZ.toast('این فرکانس به «' + clash.name + '» خیلی نزدیک است (تداخل)'); return; }
        W.addCustom('programs', prog); W.addCustom('stations', { id: BZ.uid('s'), name, band: S.band, freq: S.freq, power: S.power, x: S.x, y: S.y, program: pid, stereo: S.band === 'FM' && S.stereo, custom: true });
      } else {
        const n = Math.round(S.chan); if (!(n >= 1 && n <= 69)) { BZ.toast('شمارهٔ کانال نامعتبر'); return; }
        if (W.channelByNumber(n)) { BZ.toast('کانال ' + n + ' قبلاً استفاده شده'); return; }
        W.addCustom('programs', prog); W.addCustom('channels', { id: BZ.uid('c'), number: n, name, band: n <= 13 ? 'VHF' : 'UHF', power: S.power, x: S.x, y: S.y, program: pid, custom: true });
      }
      refreshList(); BZ.toast('برنامه در اتر پخش شد — در رادیو/تلویزیون پیدایش کنید'); BZ.bus.emit('world');
    });
    refreshList(); range();
    const el = card('استودیوی ساخت برنامه', 'برنامهٔ خودتان را بسازید (موسیقی/گفتار + تصویر)، موقعیت و توان فرستنده را بدهید و در اتر پخش کنید. بلافاصله با رادیو، تلویزیون، ویدئو (ضبط!) و هایفای قابل دریافت است.',
      h('div', { class: 'r-ctrl' }, kind), h('div', { class: 'fgrid' }, fld('نام برنامه/ایستگاه', inp('text', 'name')), fld('عنوان روی تصویر', inp('text', 'title')), fld('متن نوار خبر', inp('text', 'ticker'))),
      radioF, tvF,
      h('div', { class: 'fgrid' }, fld('سبک موسیقی', style), fld('گام', scale), fld('نت پایه', root), fld('صحنهٔ تصویر', scene), fld('رنگ‌ها', h('div', { class: 'r-ctrl' }, colors))),
      h('div', { class: 'sl-grid' }, bpm, dens, pw, px, py), rangeEl,
      h('div', { class: 'r-ctrl' }, prevBtn, BZ.btn('■ توقف', stopPrev), publish), prevCv, h('h4', null, 'برنامه‌های شما در اتر'), list);
    return { el, paint(now) { prevProg = mkProg(); BZ.video.draw(pg, 320, 240, prevProg, now / 1000); } };
  }

  // ================= آزمون خودکار =================
  function selfTestExp() {
    const res = h('div', { class: 'etable' }), sum = h('div', { class: 'note strong' });
    const W = BZ.world;
    const tests = [
      ['ایستگاه‌ها: فرکانس‌ها تداخل ندارند', () => { for (const a of W.stations) for (const b of W.stations) { if (a !== b && a.band === b.band) { const bw = BZ.BANDS[a.band].bw * 2; if (Math.abs(a.freq - b.freq) < bw) return [false, a.name + ' و ' + b.name]; } } return [true, W.stations.length + ' ایستگاه']; }],
      ['رادیو: تنظیم دقیق روی هر ایستگاه قوی، همان را انتخاب می‌کند', () => { let n = 0; for (const s of W.stations) { if (BZ.rf.strength(s, W.env, false) < 0.3) continue; const r = BZ.rf.receive(s.band, s.freq, BZ.BANDS[s.band].bw, W.env, false, W.stations); if (r[0].src.id !== s.id) return [false, s.name]; n++; } return [n > 5, n + ' ایستگاه درست تشخیص داده شد']; }],
      ['انتخاب‌پذیری: ایستگاه همسایه (۲ برابر فاصله) ≥ ۹۹٪ حذف می‌شود', () => { const a = BZ.rf.selectivity(0, 5), b = BZ.rf.selectivity(10, 5); return [a === 1 && b < 0.01, 'b=' + b.toExponential(1)]; }],
      ['انتشار: شب موج AM دور قوی‌تر می‌شود', () => { const s = W.stations.find((x) => x.id === 'am1566'), d = BZ.rf.strength(s, W.env, false), n = BZ.rf.strength(s, W.env, true); return [n > d, 'روز ' + d.toFixed(2) + ' ← شب ' + n.toFixed(2)]; }],
      ['انتشار: هر چه دورتر ضعیف‌تر (FM)', () => { const s = Object.assign({}, W.stations.find((x) => x.id === 'fm884')); const a = BZ.rf.strength(Object.assign({}, s, { x: 50, y: 52 }), W.env, false), b = BZ.rf.strength(Object.assign({}, s, { x: 50, y: 95 }), W.env, false); return [a > b, a.toFixed(2) + ' > ' + b.toFixed(2)]; }],
      ['موسیقی: خروجی قابل‌تکرار (همان seed ⇒ همان نت‌ها)', () => { for (const id in W.programs) { const p = W.programs[id]; const a = JSON.stringify(BZ.music.bar(p, 7)), b = JSON.stringify(BZ.music.bar(p, 7)); if (a !== b) return [false, id]; if (!BZ.music.bar(p, 3).length) return [false, id + ' خالی']; } return [true, Object.keys(W.programs).length + ' برنامه']; }],
      ['موسیقی: میزان‌های مختلف متفاوتند', () => { const p = W.programs.jazz1; return [JSON.stringify(BZ.music.bar(p, 1)) !== JSON.stringify(BZ.music.bar(p, 2)), '']; }],
      ['نوار: نوشتن پیوسته یک قطعه می‌سازد و زمان محتوا درست است', () => { const t = BZ.Tapes.create('x', 600, 1); for (let i = 0; i < 10; i++) BZ.Tapes.write(t, i, 1, { sid: 'a', ch: 2, prog: 'news1', pt0: 1000 + i, q: 0.9 }); const s = BZ.Tapes.segAt(t, 4); return [t.segs.length === 1 && s.d === 10 && s.pt0 + (4 - s.s) === 1004, t.segs.length + ' قطعه']; }],
      ['نوار: بازنویسی وسط، قطعه را سه‌تکه می‌کند و زمان‌ها حفظ می‌شود', () => { const t = BZ.Tapes.create('x', 600, 1); for (let i = 0; i < 10; i++) BZ.Tapes.write(t, i, 1, { sid: 'a', ch: 2, prog: 'news1', pt0: 1000 + i, q: 0.9 }); for (let i = 3; i < 5; i++) BZ.Tapes.write(t, i, 1, { sid: 'b', ch: 4, prog: 'test1', pt0: 9000 + i, q: 0.8 }); const s3 = BZ.Tapes.segAt(t, 7); return [t.segs.length === 3 && s3.pt0 + (7 - s3.s) === 1007 && BZ.Tapes.segAt(t, 3.5).prog === 'test1', t.segs.length + ' قطعه']; }],
      ['ویدئو: ضبط زمان‌بندی‌شده شروع می‌شود و روی نوار می‌نویسد', () => { const v = new BZ.VCR(); v.save = () => {}; v.on = true; v.tape = BZ.Tapes.create('t', 600, 1); const tod = v.tod(); v.timers = [{ id: 'z', ch: 2, start: tod - 1, dur: 600, day: -1 }]; v.tick(0.1); const m1 = v.mode; v.tick(1); return [m1 === 'rec' && v.tape.segs.length === 1 && v.tape.pos > 0.5, 'حالت ' + m1]; }],
      ['ویدئو: نوار قفل‌شده ضبط نمی‌پذیرد', () => { const v = new BZ.VCR(); v.save = () => {}; v.on = true; const t = BZ.Tapes.defaults()[0]; v.tape = t; const old = BZ.toast; BZ.toast = () => {}; v.press('rec'); BZ.toast = old; return [v.mode !== 'rec', '']; }],
      ['جهان: ساعت با شتاب زمان پیش می‌رود', () => { const t0 = W.time, sp = W.speed; W.speed = 5; W.tick(2); const ok = Math.abs(W.time - t0 - 10) < 1e-6; W.time = t0; W.speed = sp; return [ok, '']; }],
      ['تحلیل: FFT قلهٔ سینوس را در bin درست می‌یابد', () => { const n = 256, re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 8 * i) / n); BZ.fft(re, im); let k = 0, m = 0; for (let i = 1; i < n / 2; i++) { const v = Math.hypot(re[i], im[i]); if (v > m) { m = v; k = i; } } return [k === 8, 'bin ' + k]; }],
      ['هایفای: آلبوم‌ها و آهنگ‌ها معتبرند', () => [BZ.ALBUMS.length === 3 && BZ.ALBUMS.every((a) => a.tracks.length === 5 && a.tracks.every((t) => t.dur > 100)), '۱۵ آهنگ']],
      ['تصویر: همهٔ صحنه‌ها بدون خطا رسم می‌شوند', () => { const c = BZ.cv(192, 144), g = c.getContext('2d'); let n = 0; for (const k in BZ.video.scenes) { BZ.video.draw(g, 192, 144, Object.assign({}, W.programs.news1, { video: Object.assign({}, W.programs.news1.video, { scene: k }) }), 12.5); n++; } return [n >= 9, n + ' صحنه']; }],
      ['صدا: Web Audio در این دستگاه موجود است', () => [BZ.audio.available(), BZ.audio.ctx ? 'وضعیت: ' + BZ.audio.ctx.state : 'هنوز فعال نشده']],
    ];
    function run() {
      res.innerHTML = ''; let ok = 0;
      tests.forEach(([name, fn]) => { let r; try { r = fn(); } catch (e) { r = [false, 'خطا: ' + e.message]; } if (r[0]) ok++; res.append(h('div', { class: 'erow ' + (r[0] ? 'pass' : 'fail') }, h('span', null, (r[0] ? '✓ ' : '✗ ') + name), h('b', null, r[1] || ''))); });
      sum.textContent = ok + ' از ' + tests.length + ' آزمون موفق'; return { ok, total: tests.length };
    }
    const el = card('آزمون خودکار اکوسیستم', 'منطق اصلی (انتشار، انتخاب‌پذیری، تولید موسیقی، نوار، زمان‌بندی ویدئو، رندر تصویر) را یک‌جا بررسی می‌کند.', h('div', { class: 'r-ctrl' }, BZ.btn('▶ اجرای همهٔ آزمون‌ها', run), BZ.btn('ثبت نتیجه در دفتر', () => { const r = run(); BZ.notebook.add('آزمون خودکار', r); })), sum, res);
    return { el, paint() {}, run };
  }

  // ================= دفتر آزمایش =================
  function notebookExp() {
    const box = h('div', { class: 'nbox' });
    function draw() {
      box.innerHTML = '';
      if (!BZ.notebook.list.length) box.append(h('div', { class: 'note' }, 'دفتر خالی است؛ از هر آزمایش «ثبت در دفتر» را بزنید.'));
      BZ.notebook.list.forEach((e) => box.append(h('div', { class: 'nentry' }, h('b', null, e.title), h('span', { class: 'lbl' }, ' ساعت جهان ' + e.world + ' • ' + e.at.slice(0, 19).replace('T', ' ')), h('pre', null, JSON.stringify(e.data)))));
    }
    BZ.bus.on('nb', draw); draw();
    const dl = BZ.btn('⬇ دانلود JSON', () => { const b = new Blob([JSON.stringify(BZ.notebook.list, null, 2)], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(b), download: 'bazi-lab-notebook.json' }); document.body.append(a); a.click(); a.remove(); });
    const cp = BZ.btn('کپی', () => { try { navigator.clipboard.writeText(JSON.stringify(BZ.notebook.list, null, 2)); BZ.toast('کپی شد'); } catch (e) { BZ.toast('کپی ممکن نشد'); } });
    const el = card('دفتر آزمایش', 'همهٔ اندازه‌گیری‌هایی که ثبت می‌کنید اینجا می‌ماند (فقط روی همین دستگاه).', h('div', { class: 'r-ctrl' }, dl, cp, BZ.btn('پاک‌کردن', () => { if (confirm('همهٔ ثبت‌ها پاک شود؟')) BZ.notebook.clear(); })), box);
    return { el, paint() {} };
  }

  // ================= قاب آزمایشگاه =================
  BZ.labPanel = function () {
    const E = BZ.labExperiments;
    const tabs = [['ether', 'محیط اتر', E.ether], ['mod', 'مدولاسیون', E.mod], ['super', 'سوپرهترودین', E.super], ['scan', 'اسکن تلویزیون', E.scan], ['vhs', 'هد دوار ویدئو', E.vhs], ['amp', 'آمپلی‌فایر', E.amp], ['studio', 'استودیوی برنامه', studioExp], ['test', 'آزمون خودکار', selfTestExp], ['nb', 'دفتر', notebookExp]];
    const nav = h('div', { class: 'labnav' }), host = h('div', { class: 'labhost' }), made = {};
    let cur = BZ.store.get('labtab', 'ether');
    function open(id) {
      cur = id; BZ.store.set('labtab', id); host.innerHTML = '';
      if (!made[id]) made[id] = tabs.find((t) => t[0] === id)[2]();
      host.append(made[id].el); Array.from(nav.children).forEach((b) => b.classList.toggle('on', b._id === id));
    }
    tabs.forEach(([id, name]) => { const b = h('button', { type: 'button', class: 'segb', onclick: () => open(id) }, name); b._id = id; nav.append(b); });
    open(tabs.some((t) => t[0] === cur) ? cur : 'ether');
    const root = h('div', { class: 'lab' }, nav, host);
    root.paint = (now) => { const e = made[cur]; if (e && e.paint) e.paint(now); };
    root.runTests = () => { if (!made.test) made.test = selfTestExp(); return made.test.run(); };
    return root;
  };
})();
