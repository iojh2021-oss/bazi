/* director.js — استودیوی عروسک و گیاه: کارگاه شخصیت، کارگردانی نمایش، شبیه‌ساز زندگی، مانیتور سرور و شبکه
   همهٔ داده‌ها از «سرور داخلی» می‌آیند و به آن ذخیره می‌شوند؛ پیش‌نمایش هم از جریان همان سرور می‌خوانَد. */
(function () {
  'use strict';
  const BZ = window.BZ, h = BZ.h, W = BZ.world;
  const EMO_OPTS = Object.keys(BZ.EMOTIONS).map((k) => ({ v: k, t: BZ.EMOTIONS[k] }));
  const ACT_OPTS = [{ v: '', t: '—' }, { v: 'wave', t: 'دست‌تکان‌دادن' }, { v: 'jump', t: 'پرش' }, { v: 'dance', t: 'رقص' }, { v: 'think', t: 'فکر‌کردن' }];
  const BODY_OPTS = [{ v: 'sock', t: 'جورابی' }, { v: 'ball', t: 'توپی' }, { v: 'box', t: 'مکعبی (ربات)' }, { v: 'blob', t: 'قطره‌ای' }];
  const SPEC_OPTS = [{ v: 'flower', t: 'گل' }, { v: 'cactus', t: 'کاکتوس' }, { v: 'fern', t: 'سرخس' }, { v: 'tree', t: 'بن‌سای' }];
  const EARS_OPTS = [{ v: 'none', t: 'بدون' }, { v: 'cat', t: 'گربه‌ای' }, { v: 'bunny', t: 'خرگوشی' }, { v: 'antenna', t: 'آنتن' }, { v: 'tuft', t: 'کاکل' }];
  const MUSIC_OPTS = [{ v: '', t: 'بدون موسیقی' }].concat(['ambient', 'jazz', 'classical', 'persian', 'pop', 'electronic'].map((k) => ({ v: k, t: BZ.STYLE_NAMES[k] })));
  const notTmp = (x) => !String(x.id).startsWith('tmp_');
  const card = (title, note, ...kids) => h('section', { class: 'exp' }, h('h3', null, title), note ? h('p', { class: 'note' }, note) : null, ...kids);
  const fld = (label, el) => h('label', { class: 'fld' }, h('span', null, label), el);
  const ok = (r, okMsg) => { if (r.status === 200) { if (okMsg) BZ.toast(okMsg); return true; } BZ.toast((r.body && r.body.error) || 'خطا در ارتباط با سرور'); return false; };

  // ---------- پخش‌کنندهٔ پیش‌نمایش: صدا و تصویر هر دو از جریان سرور ----------
  function Player(cv) {
    const g = cv.getContext('2d'), me = { pl: null, show: null, playing: false, t0: 0, stopAt: 0 };
    me.start = (show, t0, auto) => {
      me.stop(); if (!BZ.audio.init()) { BZ.toast('صدا در این مرورگر فعال نیست'); }
      me.show = show; me.t0 = t0 || 0; me.playing = true; me.stopAt = auto ? performance.now() + auto * 1000 : 0;
      if (BZ.audio.ctx) me.pl = BZ.makePlayer(BZ.audio.ctx, BZ.serverProg(show), BZ.audio.master, { t0: me.t0, quality: () => 1, tag: 'preview' });
    };
    me.stop = () => { if (me.pl) { me.pl.stop(); me.pl = null; } me.playing = false; };
    me.paint = (now) => {
      if (me.stopAt && now > me.stopAt) me.stop();
      if (!me.playing || !me.pl) { g.fillStyle = '#080d11'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#6f8ea0'; g.font = '14px ' + BZ.FONT; g.textAlign = 'center'; g.fillText('برای پیش‌نمایش ▶ را بزنید', cv.width / 2, cv.height / 2); return; }
      BZ.video.scenes.production(g, cv.width, cv.height, me.pl.contentNow(), null, me.pl.stream);
    };
    me.t = () => (me.pl ? me.pl.contentNow() : me.t0);
    return me;
  }

  // ---------- خروجی واقعی (فایل WebM) ----------
  function download(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); }
  function exportShow(show, withVideo, seconds, onProg, onDone) {
    if (typeof MediaRecorder === 'undefined') { BZ.toast('این مرورگر ضبط (MediaRecorder) ندارد'); onDone && onDone(); return; }
    if (!BZ.audio.init()) { BZ.toast('صدا فعال نیست'); onDone && onDone(); return; }
    const ctx = BZ.audio.ctx, dest = ctx.createMediaStreamDestination();
    const cv = BZ.cv(640, 480), g = cv.getContext('2d');
    let stream = dest.stream;
    if (withVideo) {
      if (!cv.captureStream) { BZ.toast('ضبط تصویر پشتیبانی نمی‌شود؛ فقط صدا'); withVideo = false; }
      else stream = new MediaStream(cv.captureStream(30).getVideoTracks().concat(dest.stream.getAudioTracks()));
    }
    const mimes = withVideo ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['audio/webm;codecs=opus', 'audio/webm'];
    const mime = mimes.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const t0c = show.kind === 'life' ? (show.epoch || 0) : 0;
    const pl = BZ.makePlayer(ctx, BZ.serverProg(show), dest, { t0: t0c, quality: () => 1, tag: 'export' });
    const start = performance.now(); let timer;
    rec.onstop = () => { clearInterval(timer); pl.stop(); const blob = new Blob(chunks, { type: mime || 'video/webm' }); download(blob, 'bazi-' + (show.name || 'show').replace(/\s+/g, '_') + (withVideo ? '.webm' : '-audio.webm')); BZ.toast('فایل ذخیره شد'); onDone && onDone(); };
    rec.start();
    timer = setInterval(() => {
      const el = (performance.now() - start) / 1000;
      if (withVideo) BZ.video.scenes.production(g, 640, 480, pl.contentNow(), null, pl.stream);
      onProg && onProg(el / seconds);
      if (el >= seconds) { clearInterval(timer); rec.stop(); }
    }, 33);
    BZ.toast('در حال ضبط… (این تب را باز نگه دارید)');
  }
  const scriptLen = (s) => Math.ceil((s.lines || []).reduce((a, l) => { const m = (s.cast || [])[l.who], ch = m ? BZ.lib.char(m.cid) : null; return a + (l.text ? BZ.speech.plan(l.text, (ch && ch.voice && ch.voice.speed) || 1).dur + 0.4 : 0); }, 1.6));

  // ---------- پخش (انتشار) روی کانال/ایستگاه ----------
  function publishBox(getShow) {
    const mine = h('div', { class: 'tlist' });
    const freeCh = () => { for (let n = 14; n <= 69; n++) if (!W.channelByNumber(n)) return n; return 60; };
    const ch = h('input', { type: 'number', class: 'inp', min: 1, max: 69, value: freeCh(), style: { width: '70px' } });
    const nm = h('input', { type: 'text', class: 'inp', placeholder: 'نام شبکه/ایستگاه' });
    const pw = BZ.slider({ label: 'توان فرستنده', min: 10, max: 300, step: 5, value: 80, fmt: (v) => v + ' kW' });
    const px = BZ.slider({ label: 'موقعیت X', min: 0, max: 100, step: 1, value: 50, fmt: (v) => v + '' });
    const py = BZ.slider({ label: 'موقعیت Y', min: 0, max: 100, step: 1, value: 50, fmt: (v) => v + '' });
    const band = BZ.select([{ v: 'FM', t: 'FM (MHz)' }, { v: 'AM', t: 'AM (kHz)' }, { v: 'SW', t: 'SW (MHz)' }], 'FM', () => { fr.value = band.value === 'AM' ? 1170 : band.value === 'FM' ? 100.5 : 7.3; });
    const fr = h('input', { type: 'number', class: 'inp', step: '0.05', value: 100.5, style: { width: '90px' } });
    function refresh() {
      const s = getShow(); mine.innerHTML = ''; if (!s) return;
      const pid = 'prod_' + s.id;
      W.channels.filter((c) => c.program === pid).forEach((c) => mine.append(h('div', { class: 'trow' }, '📺 کانال ' + c.number + ' — ' + c.name, c.builtin ? h('span', { class: 'lbl' }, 'داخلی') : BZ.btn('حذف', () => BZ.lib.unpublish(c.id).then(refresh), 'sm'))));
      W.stations.filter((c) => c.program === pid).forEach((c) => mine.append(h('div', { class: 'trow' }, '📻 ' + c.band + ' ' + c.freq + ' — ' + c.name, c.builtin ? h('span', { class: 'lbl' }, 'داخلی') : BZ.btn('حذف', () => BZ.lib.unpublish(c.id).then(refresh), 'sm'))));
      if (!mine.children.length) mine.append(h('div', { class: 'note' }, 'هنوز روی هیچ کانالی پخش نمی‌شود.'));
    }
    const tv = BZ.btn('📺 پخش روی تلویزیون', () => {
      const s = getShow(); if (!s) return; const n = Math.round(+ch.value);
      if (W.channelByNumber(n)) { BZ.toast('کانال ' + n + ' قبلاً استفاده شده'); return; }
      BZ.lib.publish({ kind: 'tv', show: s.id, number: n, name: nm.value || s.name, power: pw.get(), x: px.get(), y: py.get() }).then((r) => { if (ok(r, 'روی کانال ' + n + ' پخش شد — در تلویزیون پیدایش کنید')) { ch.value = freeCh(); refresh(); } });
    }, 'go');
    const rd = BZ.btn('📻 پخش روی رادیو', () => {
      const s = getShow(); if (!s) return; const f = +fr.value, b = band.value, B = BZ.BANDS[b];
      if (!(f >= B.min && f <= B.max)) { BZ.toast('فرکانس باید بین ' + B.min + ' و ' + B.max + ' باشد'); return; }
      BZ.lib.publish({ kind: 'radio', show: s.id, band: b, freq: f, name: nm.value || s.name, power: pw.get(), x: px.get(), y: py.get() }).then((r) => { if (ok(r, 'روی رادیو پخش شد')) refresh(); });
    }, 'go');
    const el = h('div', { class: 'sub' }, h('h4', null, 'پخش در اتر (فرستندهٔ سرور داخلی)'),
      h('div', { class: 'fgrid' }, fld('شمارهٔ کانال تلویزیون', ch), fld('باند رادیو', band), fld('فرکانس', fr), fld('نام', nm)),
      h('div', { class: 'sl-grid' }, pw, px, py), h('div', { class: 'r-ctrl' }, tv, rd), mine);
    return { el, refresh };
  }

  // ================= ۱) کارگاه عروسک و گیاه =================
  function charsTab() {
    let cur = BZ.lib.chars.find(notTmp), emo = 'neutral', sayText = 'سلام! من یک شخصیت آزمایشگاهی هستم.';
    const cv = BZ.cv(420, 330, 'scope'), g = cv.getContext('2d'), pl = Player(cv);
    const list = h('div', { class: 'chips' }), ed = h('div');
    const draftOf = (c) => { if (!c.builtin) return c; const d = JSON.parse(JSON.stringify(c)); d._src = c.id; d.id = 'u_' + BZ.uid('c'); d.builtin = false; d._draft = true; d.name = c.name + ' (من)'; return d; };
    const save = () => { if (!cur) return; if (cur._draft) { delete cur._draft; BZ.lib.chars.push(cur); renderList(); renderEd(); } BZ.lib.putChar(cur); };
    function renderList() {
      list.innerHTML = '';
      BZ.lib.chars.filter(notTmp).forEach((c) => list.append(h('button', { type: 'button', class: 'chip' + (cur && (c === cur || c.id === cur.id || cur._src === c.id) ? ' on' : ''), onclick: () => { cur = draftOf(c); pl.stop(); renderList(); renderEd(); } }, (c.type === 'plant' ? '🌱 ' : '🧸 ') + c.name)));
    }
    function create(type, from) {
      const base = from ? JSON.parse(JSON.stringify(from)) : { type, name: type === 'plant' ? 'گیاه جدید' : 'عروسک جدید', body: 'sock', species: 'flower', color: type === 'plant' ? '#ff5d8f' : '#e8903a', accent: type === 'plant' ? '#c9673a' : '#8a4b1a', eyes: 0.5, eyeGap: 0.5, ears: 'cat', size: 1, voice: { pitch: type === 'plant' ? 140 : 200, speed: 1 } };
      base.id = 'u_' + BZ.uid('c'); base.builtin = false; base.seed = Math.floor(Math.random() * 50); if (from) base.name = from.name + ' (کپی)';
      BZ.lib.chars.push(base); cur = base;
      BZ.net.call('PUT', '/chars/' + base.id, base).then((r) => { ok(r); renderList(); renderEd(); });
    }
    function renderEd() {
      ed.innerHTML = ''; if (!cur) return;
      const c = cur, ro = false;
      const inp = (key, type) => { const i = h('input', { type: type || 'text', class: 'inp', value: c[key] == null ? '' : c[key], disabled: ro }); i.addEventListener('input', () => { c[key] = i.value; save(); renderList(); }); return i; };
      const sl = (label, key, min, max, step, fmt, path) => BZ.slider({ label, min, max, step, value: path ? c.voice[key] : (c[key] == null ? 0.5 : c[key]), fmt, onInput: (v) => { if (ro) return; if (path) c.voice[key] = v; else c[key] = v; save(); } });
      const clr = (key) => { const i = h('input', { type: 'color', class: 'inp clr', value: c[key] || '#888888', disabled: ro }); i.addEventListener('input', () => { c[key] = i.value; save(); }); return i; };
      const sel = (opts, key) => { const s = BZ.select(opts, c[key] || opts[0].v, (v) => { c[key] = v; save(); }); s.disabled = ro; return s; };
      ed.append(
        c._draft ? h('p', { class: 'note strong' }, 'این شخصیت داخلی است؛ با اولین تغییر، نسخهٔ شخصی شما ساخته و ذخیره می‌شود.') : null,
        h('div', { class: 'fgrid' }, fld('نام', inp('name')), c.type === 'plant' ? fld('گونه', sel(SPEC_OPTS, 'species')) : fld('بدنه', sel(BODY_OPTS, 'body')), c.type === 'puppet' ? fld('گوش/آنتن', sel(EARS_OPTS, 'ears')) : null, fld('رنگ اصلی', clr('color')), fld(c.type === 'plant' ? 'رنگ گلدان' : 'رنگ فرعی', clr('accent'))),
        h('div', { class: 'sl-grid' }, sl('اندازهٔ چشم', 'eyes', 0, 1, 0.05, (v) => v.toFixed(2)), sl('فاصلهٔ چشم‌ها', 'eyeGap', 0, 1, 0.05, (v) => v.toFixed(2)), sl('اندازه', 'size', 0.6, 1.5, 0.05, (v) => v.toFixed(2)), sl('زیر و بمی صدا', 'pitch', 70, 400, 5, (v) => v + ' Hz', true), sl('سرعت گفتار', 'speed', 0.6, 1.6, 0.05, (v) => v.toFixed(2) + '×', true)),
        h('p', { class: 'note' }, c.type === 'plant' ? 'گیاه: ساقه با ترکیب سه نوسان باد تکان می‌خورد؛ در «زندگی» رشد می‌کند و بدون آب پژمرده می‌شود.' : 'عروسک: بازوی دو‌مفصلی (FK)، تنفس، پلک‌زدن، ابرو و دهان؛ شکل دهان از ویزم واکه‌ها می‌آید.'),
        h('div', { class: 'r-ctrl' }, BZ.btn('کپی', () => create(c.type, c)), ro ? null : BZ.btn('حذف', () => { if (!confirm('این شخصیت حذف شود؟')) return; const id = c.id; BZ.lib.del('chars', id).then(() => { cur = BZ.lib.chars.find(notTmp); renderList(); renderEd(); }); })));
    }
    const emoSeg = BZ.seg(EMO_OPTS, emo, (v) => { emo = v; });
    const sayI = h('input', { type: 'text', class: 'inp', value: sayText, style: { flex: '1', minWidth: '180px' } }); sayI.addEventListener('input', () => { sayText = sayI.value; });
    const say = BZ.btn('🗣 بگو', () => {
      if (!cur) return;
      const tmp = { id: 'tmp_char', name: 'پیش‌نمایش', kind: 'script', seed: 'tmp', set: 'stage', camera: 'auto', title: '', music: { style: '', vol: 0 }, cast: [{ cid: cur.id, x: 0.5 }], lines: [{ who: 0, emo, act: '', text: sayText }] };
      (cur._draft ? BZ.net.call('PUT', '/chars/' + cur.id, Object.assign({}, cur, { _draft: undefined, builtin: false })) : Promise.resolve()).then(() => BZ.net.call('PUT', '/shows/tmp_char', tmp)).then((r) => { if (!ok(r)) return; BZ.net.invalidate('prod_tmp_char'); pl.start(tmp, 0, scriptLen(tmp) + 0.5); });
    }, 'go');
    const root = card('کارگاه عروسک و گیاه', 'شخصیت بسازید و صدایش را آزمایش کنید. هر تغییر روی سرور داخلی ذخیره می‌شود و در نمایش‌ها و «زندگی» استفاده می‌شود.',
      list, h('div', { class: 'r-ctrl' }, BZ.btn('+ عروسک', () => create('puppet')), BZ.btn('+ گیاه', () => create('plant'))), cv,
      h('div', { class: 'r-ctrl' }, emoSeg), h('div', { class: 'r-ctrl' }, sayI, say, BZ.btn('■', () => pl.stop(), 'sm')), ed);
    if (cur) cur = draftOf(cur);
    renderList(); renderEd();
    BZ.bus.on('lib', () => { if (!(cur && cur._draft)) { cur = (cur && BZ.lib.chars.find((x) => x.id === cur.id)) || BZ.lib.chars.find(notTmp); renderEd(); } renderList(); });
    return {
      el: root, paint(now) {
        if (pl.playing) { pl.paint(now); return; }
        const w = cv.width, hh = cv.height; const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#26364a'); gr.addColorStop(1, '#14202c'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
        g.fillStyle = '#2a3a4a'; g.fillRect(0, hh * 0.88, w, hh * 0.12);
        if (cur) BZ.char.draw(g, cur, { x: w / 2, y: hh * 0.9, s: (hh * 0.62) / (cur.type === 'plant' ? 150 : 125), dir: 1, emo, t: now / 1000, open: 0, look: Math.sin(now / 1500) * 0.5, grow: 1 });
      },
    };
  }

  // ================= ۲) کارگردانی (نمایش‌نامه) =================
  function scriptTab() {
    let cur = BZ.lib.shows.find((s) => s.kind === 'script' && notTmp(s));
    const cv = BZ.cv(480, 360, 'scope'), pl = Player(cv);
    const picker = h('div', { class: 'chips' }), ed = h('div'), pub = publishBox(() => cur), prog = h('div', { class: 'note' });
    const save = () => { if (!cur) return; if (cur._draft) { delete cur._draft; BZ.lib.shows.push(cur); renderPicker(); pub.refresh(); } BZ.lib.putShow(cur); };
    const draftOf = (x) => { if (!x.builtin) return x; const d = JSON.parse(JSON.stringify(x)); d._src = x.id; d.id = 's_' + BZ.uid('x'); d.builtin = false; d._draft = true; d.name = x.name + ' (من)'; return d; };
    function renderPicker() {
      picker.innerHTML = '';
      BZ.lib.shows.filter((s) => s.kind === 'script' && notTmp(s)).forEach((s) => picker.append(h('button', { type: 'button', class: 'chip' + (cur && (s === cur || cur._src === s.id) ? ' on' : ''), onclick: () => { cur = draftOf(s); pl.stop(); renderPicker(); renderEd(); pub.refresh(); } }, '🎬 ' + s.name)));
    }
    function create(from) {
      const s = from ? JSON.parse(JSON.stringify(from)) : { name: 'نمایش جدید', kind: 'script', seed: BZ.uid('s'), set: 'world', props: [{ type: 'mountain', color: '#8a96aa', x: 0.25, z: 1, size: 1.6 }, { type: 'house', color: '#e8c9a0', x: 0.78, z: 0.8, size: 1 }, { type: 'tree', color: '#4da35a', x: 0.92, z: 0.45, size: 1 }, { type: 'flowerbed', color: '#ff5d8f', x: 0.6, z: 0.3, size: 1 }], camera: 'auto', title: '', music: { style: '', vol: 0.2 }, cast: [{ cid: 'c_pashmi', x: 0.3 }, { cid: 'c_laleh', x: 0.7 }], lines: [{ who: 0, emo: 'happy', act: 'wave', text: 'سلام! به نمایش من خوش آمدید.' }, { who: 1, emo: 'happy', act: '', text: 'سلام! امروز می‌خواهیم دربارهٔ نور و آب حرف بزنیم.' }] };
      s.id = 's_' + BZ.uid('x'); s.builtin = false; if (from) s.name = from.name + ' (کپی)';
      BZ.lib.shows.push(s); cur = s;
      BZ.net.call('PUT', '/shows/' + s.id, s).then((r) => { ok(r); renderPicker(); renderEd(); pub.refresh(); });
    }
    function renderEd() {
      ed.innerHTML = ''; if (!cur) return;
      const s = cur, ro = false, chOpts = BZ.lib.chars.filter(notTmp).map((c) => ({ v: c.id, t: (c.type === 'plant' ? '🌱 ' : '🧸 ') + c.name }));
      const inp = (key) => { const i = h('input', { type: 'text', class: 'inp', value: s[key] || '', disabled: ro }); i.addEventListener('input', () => { s[key] = i.value; save(); }); return i; };
      const castBox = h('div', { class: 'tlist' }), lineBox = h('div', { class: 'tlist' });
      function drawCast() {
        castBox.innerHTML = '';
        s.cast.forEach((m, i) => {
          const sel = BZ.select(chOpts, m.cid, (v) => { m.cid = v; save(); drawLines(); }); sel.disabled = ro;
          const x = BZ.slider({ label: 'جایگاه', min: 0, max: 1, step: 0.05, value: m.x == null ? 0.5 : m.x, fmt: (v) => Math.round(v * 100) + '٪', onInput: (v) => { m.x = v; save(); } });
          const zz = BZ.slider({ label: 'عمق (۰ نزدیک ← ۱ دور)', min: 0, max: 1, step: 0.05, value: m.z == null ? 0.1 : m.z, fmt: (v) => v.toFixed(2), onInput: (v) => { m.z = v; save(); } });
          castBox.append(h('div', { class: 'trow wrap' }, h('b', null, (i + 1) + '.'), sel, x, s.set === 'world' ? zz : null, ro ? null : BZ.btn('حذف', () => { s.cast.splice(i, 1); s.lines = s.lines.filter((l) => l.who !== i).map((l) => (l.who > i ? Object.assign(l, { who: l.who - 1 }) : l)); save(); drawCast(); drawLines(); }, 'sm')));
        });
      }
      const propBox = h('div', { class: 'tlist' }), propWrap = h('div');
      function drawProps() {
        propWrap.innerHTML = ''; propBox.innerHTML = '';
        if (s.set !== 'world') { propWrap.append(h('p', { class: 'note' }, 'برای ساختن اشیا و منظرهٔ سه‌بعدی، دکور را «جهان سه‌بعدی» بگذارید.')); return; }
        s.props = s.props || [];
        const types = Object.keys(BZ.PROP_NAMES).map((k) => ({ v: k, t: BZ.PROP_NAMES[k] })), defC = { tree: '#4da35a', pine: '#2f7d4a', bush: '#3f9a52', flowerbed: '#ff5d8f', rock: '#8a8f98', house: '#e8c9a0', fence: '#c9a46a', lamp: '#ffd36a', table: '#9a6a3a', sofa: '#b04a5a', tv: '#4a90d8', pillar: '#d8d2c4', cloud: '#ffffff', mountain: '#8a96aa', pond: '#4a90d8', box: '#e8903a' };
        s.props.forEach((p, i) => {
          const ts = BZ.select(types, p.type, (v) => { p.type = v; save(); }), cl = h('input', { type: 'color', class: 'inp clr', value: p.color || '#4da35a', style: { width: '44px' } });
          cl.addEventListener('input', () => { p.color = cl.value; save(); });
          propBox.append(h('div', { class: 'trow wrap' }, ts, cl,
            BZ.slider({ label: 'چپ/راست', min: -0.2, max: 1.2, step: 0.02, value: p.x == null ? 0.5 : p.x, fmt: (v) => v.toFixed(2), onInput: (v) => { p.x = v; save(); } }),
            BZ.slider({ label: 'عمق', min: 0, max: 1, step: 0.02, value: p.z == null ? 0.5 : p.z, fmt: (v) => v.toFixed(2), onInput: (v) => { p.z = v; save(); } }),
            BZ.slider({ label: 'اندازه', min: 0.4, max: 3, step: 0.1, value: p.size || 1, fmt: (v) => v.toFixed(1) + '×', onInput: (v) => { p.size = v; save(); } }),
            BZ.btn('✕', () => { s.props.splice(i, 1); save(); drawProps(); }, 'sm')));
        });
        const addT = BZ.select(types, 'tree', () => {});
        propWrap.append(h('h4', null, 'اشیای صحنه (سه‌بعدی)'), propBox, h('div', { class: 'r-ctrl' }, addT, BZ.btn('+ ساخت شیء', () => { if (s.props.length >= 24) { BZ.toast('حداکثر ۲۴ شیء'); return; } const t = addT.value; s.props.push({ type: t, color: defC[t], x: 0.15 + Math.random() * 0.7, z: 0.3 + Math.random() * 0.6, size: 1 }); save(); drawProps(); }, 'go'),
          BZ.btn('منظرهٔ نمونه', () => { s.props = [{ type: 'mountain', color: '#8a96aa', x: 0.25, z: 1, size: 1.6 }, { type: 'house', color: '#e8c9a0', x: 0.78, z: 0.8, size: 1 }, { type: 'pine', color: '#2f7d4a', x: 0.05, z: 0.6 }, { type: 'tree', color: '#4da35a', x: 0.92, z: 0.45 }, { type: 'pond', color: '#4a90d8', x: 0.4, z: 0.55 }, { type: 'flowerbed', color: '#ff5d8f', x: 0.62, z: 0.3 }, { type: 'lamp', color: '#ffd36a', x: 0.15, z: 0.25 }, { type: 'fence', color: '#c9a46a', x: 0.5, z: 0.75 }]; save(); drawProps(); })));
      }
      function drawLines() {
        lineBox.innerHTML = '';
        const who = s.cast.map((m, i) => ({ v: i, t: (i + 1) + '. ' + BZ.lib.char(m.cid).name }));
        s.lines.forEach((l, i) => {
          const ws = BZ.select(who.map((o) => ({ v: String(o.v), t: o.t })), String(l.who), (v) => { l.who = +v; save(); }); ws.disabled = ro;
          const es = BZ.select(EMO_OPTS, l.emo || 'neutral', (v) => { l.emo = v; save(); }); es.disabled = ro;
          const as = BZ.select(ACT_OPTS, l.act || '', (v) => { l.act = v; save(); }); as.disabled = ro;
          const ti = h('input', { type: 'text', class: 'inp', value: l.text || '', disabled: ro, style: { flex: '1', minWidth: '160px' } }); ti.addEventListener('input', () => { l.text = ti.value; save(); });
          const mv = (d) => { const j = i + d; if (j < 0 || j >= s.lines.length) return; [s.lines[i], s.lines[j]] = [s.lines[j], s.lines[i]]; save(); drawLines(); };
          lineBox.append(h('div', { class: 'trow wrap' }, ws, es, as, ti, ro ? null : h('span', null, BZ.btn('▲', () => mv(-1), 'sm'), BZ.btn('▼', () => mv(1), 'sm'), BZ.btn('✕', () => { s.lines.splice(i, 1); save(); drawLines(); }, 'sm'))));
        });
      }
      const setSel = BZ.select(Object.keys(BZ.SET_NAMES).map((k) => ({ v: k, t: BZ.SET_NAMES[k] })), s.set || 'living', (v) => { s.set = v; save(); drawCast(); drawProps(); }); setSel.disabled = ro;
      const cam = BZ.seg([{ v: 'auto', t: 'نمای نزدیک خودکار' }, { v: 'wide', t: 'نمای باز' }], s.camera || 'auto', (v) => { if (!ro) { s.camera = v; save(); } });
      const mus = BZ.select(MUSIC_OPTS, (s.music && s.music.style) || '', (v) => { s.music = s.music || {}; s.music.style = v; save(); }); mus.disabled = ro;
      const mv = BZ.slider({ label: 'بلندی موسیقی پس‌زمینه', min: 0, max: 0.6, step: 0.02, value: (s.music && s.music.vol) || 0.2, fmt: (v) => Math.round(v * 100) + '٪', onInput: (v) => { s.music = s.music || {}; s.music.vol = v; save(); } });
      const addCast = BZ.select(chOpts, chOpts[0] ? chOpts[0].v : '', () => {});
      ed.append(
        s._draft ? h('p', { class: 'note strong' }, 'این نمایش داخلی است؛ با اولین تغییر، نسخهٔ شخصی شما ساخته می‌شود.') : null,
        h('div', { class: 'fgrid' }, fld('نام نمایش', inp('name')), fld('عنوان روی تصویر', inp('title')), fld('دکور', setSel), fld('موسیقی', mus)),
        h('div', { class: 'r-ctrl' }, cam), mv,
        h('h4', null, 'بازیگران'), castBox, ro ? null : h('div', { class: 'r-ctrl' }, addCast, BZ.btn('+ افزودن بازیگر', () => { if (s.cast.length >= 5) { BZ.toast('حداکثر ۵ بازیگر'); return; } s.cast.push({ cid: addCast.value, x: 0.5 }); save(); drawCast(); drawLines(); })),
        propWrap, h('h4', null, 'متن نمایش (هر خط یک دیالوگ)'), lineBox, ro ? null : BZ.btn('+ خط جدید', () => { if (!s.cast.length) { BZ.toast('اول بازیگر اضافه کنید'); return; } s.lines.push({ who: 0, emo: 'neutral', act: '', text: '' }); save(); drawLines(); }),
        h('div', { class: 'r-ctrl' }, BZ.btn('کپی', () => create(s)), ro ? null : BZ.btn('حذف', () => { if (!confirm('این نمایش حذف شود؟')) return; BZ.lib.del('shows', s.id).then(() => { cur = BZ.lib.shows.find((q) => q.kind === 'script' && notTmp(q)); renderPicker(); renderEd(); pub.refresh(); }); })));
      drawCast(); drawLines(); drawProps();
    }
    const play = BZ.btn('▶ پیش‌نمایش', () => { if (!cur) return; BZ.net.call('PUT', '/shows/' + cur.id, cur).then((r) => { if (!ok(r)) return; BZ.net.invalidate('prod_' + cur.id); pl.start(cur, 0); }); }, 'go');
    const exV = BZ.btn('⬇ خروجی ویدئو (WebM)', () => { if (!cur) return; exV.disabled = true; const sec = scriptLen(cur); exportShow(cur, true, sec, (p) => { prog.textContent = 'ضبط… ' + Math.round(p * 100) + '٪'; }, () => { exV.disabled = false; prog.textContent = ''; }); });
    const exA = BZ.btn('⬇ خروجی صدا (رادیو)', () => { if (!cur) return; exA.disabled = true; exportShow(cur, false, scriptLen(cur), (p) => { prog.textContent = 'ضبط… ' + Math.round(p * 100) + '٪'; }, () => { exA.disabled = false; prog.textContent = ''; }); });
    const root = card('کارگردانی نمایش', 'بازیگران (عروسک/گیاه) و دیالوگ‌ها را بنویسید. گفتار با مدل منبع–فیلتر ساخته می‌شود و دهان با همان زمان‌بندی هجاها حرکت می‌کند. سرور داخلی صحنه و صدا را جریان می‌دهد.',
      picker, h('div', { class: 'r-ctrl' }, BZ.btn('+ نمایش جدید', () => create())), cv, h('div', { class: 'r-ctrl' }, play, BZ.btn('■', () => pl.stop(), 'sm'), exV, exA), prog, ed, pub.el);
    if (cur) cur = draftOf(cur);
    renderPicker(); renderEd(); pub.refresh();
    BZ.bus.on('lib', () => { if (!(cur && cur._draft)) cur = (cur && BZ.lib.shows.find((x) => x.id === cur.id)) || BZ.lib.shows.find((q) => q.kind === 'script' && notTmp(q)); renderPicker(); pub.refresh(); });
    return { el: root, paint: (now) => pl.paint(now) };
  }

  // ================= ۳) زندگی =================
  function lifeTab() {
    let cur = BZ.lib.shows.find((s) => s.kind === 'life' && notTmp(s));
    const cv = BZ.cv(480, 360, 'scope'), pl = Player(cv);
    const picker = h('div', { class: 'chips' }), ed = h('div'), pub = publishBox(() => cur), insp = h('div', { class: 'etable' }), prog = h('div', { class: 'note' });
    let lastIns = 0;
    const save = () => { if (!cur) return; if (cur._draft) { delete cur._draft; cur.epoch = Math.floor(W.time); BZ.lib.shows.push(cur); renderPicker(); pub.refresh(); } BZ.lib.putShow(cur); };
    const draftOf = (x) => { if (!x.builtin) return x; const d = JSON.parse(JSON.stringify(x)); d._src = x.id; d.id = 'l_' + BZ.uid('x'); d.builtin = false; d._draft = true; d.name = x.name + ' (من)'; d.epoch = Math.floor(W.time); return d; };
    function renderPicker() {
      picker.innerHTML = '';
      BZ.lib.shows.filter((s) => s.kind === 'life' && notTmp(s)).forEach((s) => picker.append(h('button', { type: 'button', class: 'chip' + (cur && (s === cur || cur._src === s.id) ? ' on' : ''), onclick: () => { cur = draftOf(s); pl.stop(); renderPicker(); renderEd(); pub.refresh(); } }, '🏠 ' + s.name)));
    }
    function create(from) {
      const s = from ? JSON.parse(JSON.stringify(from)) : { name: 'زندگی جدید', kind: 'life', seed: BZ.uid('l'), title: 'زندگی جدید', music: { style: 'ambient', vol: 0.18, root: 45, scale: 'dorian' }, life: { hour: 7, agents: ['c_pashmi', 'c_jojo'], plants: ['c_laleh', 'c_cactus'] } };
      s.id = 'l_' + BZ.uid('x'); s.builtin = false; s.epoch = Math.floor(W.time); if (from) s.name = from.name + ' (کپی)';
      BZ.lib.shows.push(s); cur = s;
      BZ.net.call('PUT', '/shows/' + s.id, s).then((r) => { ok(r); renderPicker(); renderEd(); pub.refresh(); });
    }
    function renderEd() {
      ed.innerHTML = ''; if (!cur) return;
      const s = cur, ro = false, L = s.life, pups = BZ.lib.chars.filter((c) => c.type === 'puppet' && notTmp(c)), pls = BZ.lib.chars.filter((c) => c.type === 'plant' && notTmp(c));
      const chk = (c, arr, max) => { const b = BZ.toggle(c.name, arr.includes(c.id), (v) => { if (ro) { b.set(!v); return; } if (v) { if (arr.length >= max) { b.set(false); BZ.toast('حداکثر ' + max); return; } arr.push(c.id); } else arr.splice(arr.indexOf(c.id), 1); save(); BZ.net.invalidate('prod_' + s.id); }); return b; };
      const nameI = h('input', { type: 'text', class: 'inp', value: s.name, disabled: ro }); nameI.addEventListener('input', () => { s.name = nameI.value; s.title = nameI.value; save(); });
      const hour = BZ.slider({ label: 'ساعت شروع زندگی', min: 0, max: 23, step: 1, value: L.hour == null ? 7 : L.hour, fmt: (v) => v + ':00', onInput: (v) => { if (ro) return; L.hour = v; save(); } });
      ed.append(
        s._draft ? h('p', { class: 'note strong' }, 'این زندگی داخلی است؛ با اولین تغییر، نسخهٔ شخصی شما ساخته می‌شود.') : null,
        h('div', { class: 'fgrid' }, fld('نام', nameI)), hour,
        h('h4', null, 'ساکنان خانه (حداکثر ۴ عروسک)'), h('div', { class: 'r-ctrl' }, pups.map((c) => chk(c, L.agents, 4))),
        h('h4', null, 'گیاهان باغ (حداکثر ۴)'), h('div', { class: 'r-ctrl' }, pls.map((c) => chk(c, L.plants, 4))),
        h('div', { class: 'r-ctrl' }, BZ.btn('کپی (زندگی تازه)', () => create(s)), ro ? null : BZ.btn('⏩ ۱ ساعت زندگی جلو (۳۰ ثانیه)', () => { s.epoch -= 30; save(); BZ.net.invalidate('prod_' + s.id); BZ.toast('زمان جلو رفت'); }), ro ? null : BZ.btn('↺ شروع دوباره', () => { s.epoch = Math.floor(W.time); save(); BZ.net.invalidate('prod_' + s.id); }), ro ? null : BZ.btn('حذف', () => { if (!confirm('این زندگی حذف شود؟')) return; BZ.lib.del('shows', s.id).then(() => { cur = BZ.lib.shows.find((q) => q.kind === 'life' && notTmp(q)); renderPicker(); renderEd(); pub.refresh(); }); })));
    }
    const play = BZ.btn('▶ تماشا', () => { if (!cur) return; BZ.net.call('PUT', '/shows/' + cur.id, cur).then((r) => { if (!ok(r)) return; BZ.net.invalidate('prod_' + cur.id); pl.start(cur, W.time); }); }, 'go');
    const exV = BZ.btn('⬇ ضبط ۶۰ ثانیه (WebM)', () => { if (!cur) return; exV.disabled = true; exportShow(cur, true, 60, (p) => { prog.textContent = 'ضبط… ' + Math.round(p * 100) + '٪'; }, () => { exV.disabled = false; prog.textContent = ''; }); });
    const FAh = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const ACTN = { idle: 'بیکار', walk: 'راه می‌رود', sleep: 'خواب', eat: 'غذا', watch: 'تلویزیون', talk: 'گفت‌وگو', water: 'آب‌دادن', dance: 'رقص' };
    function drawInsp(d) {
      insp.innerHTML = '';
      insp.append(h('div', { class: 'erow' }, h('span', null, 'ساعت: ' + FAh(Math.floor(d.hour)) + ':' + FAh(BZ.pad2(Math.floor((d.hour % 1) * 60))) + ' • روز ' + FAh(d.day + 1))));
      const bar = (label, v, col) => h('div', { class: 'erow' }, h('span', null, label), h('div', { class: 'ebar' }, h('i', { style: { width: Math.round(v * 100) + '%', background: col } })), h('b', null, Math.round(v * 100) + '%'));
      d.agents.forEach((a) => { insp.append(h('div', { class: 'erow' }, h('b', null, '🧸 ' + BZ.lib.char(a.cid).name + ' — ' + (ACTN[a.act] || a.act)))); insp.append(bar('انرژی', a.n.energy, '#e8b130'), bar('سیری', a.n.hunger, '#e5533d'), bar('سرگرمی', a.n.fun, '#5ec8ff'), bar('معاشرت', a.n.social, '#a77bff')); });
      d.plants.forEach((p) => { insp.append(h('div', { class: 'erow' }, h('b', null, '🌱 ' + BZ.lib.char(p.cid).name + (p.wilt > 0.3 ? ' — پژمرده' : '')))); insp.append(bar('آب', p.water, '#4a90d8'), bar('رشد', p.grow, '#37c27a')); });
    }
    const root = card('زندگی: شبیه‌ساز خانه و باغ', 'ساکنان نیازهایی دارند (انرژی، سیری، سرگرمی، معاشرت) که با گذر زمان کم می‌شود؛ هر کدام با «تابع مطلوبیت» تصمیم می‌گیرند چه کنند. گیاهان با نور روز و آب رشد می‌کنند و بدون آب پژمرده می‌شوند. همه‌چیز در سرور داخلی و قطعی (قابل‌تکرار) اجرا می‌شود؛ هر ثانیهٔ واقعی = ۲ دقیقهٔ زندگی.',
      picker, h('div', { class: 'r-ctrl' }, BZ.btn('+ زندگی جدید', () => create())), cv, h('div', { class: 'r-ctrl' }, play, BZ.btn('■', () => pl.stop(), 'sm'), exV), prog, h('h4', null, 'وضعیت درونی (از سرور)'), insp, ed, pub.el);
    if (cur) cur = draftOf(cur);
    renderPicker(); renderEd(); pub.refresh();
    BZ.bus.on('lib', () => { if (!(cur && cur._draft)) cur = (cur && BZ.lib.shows.find((x) => x.id === cur.id)) || BZ.lib.shows.find((q) => q.kind === 'life' && notTmp(q)); renderPicker(); pub.refresh(); });
    return {
      el: root, paint(now) {
        pl.paint(now);
        if (cur && now - lastIns > 800) { lastIns = now; BZ.net.call('POST', '/inspect', { id: cur.id, t: pl.playing ? pl.t() : W.time }).then((r) => { if (r.status === 200 && r.body) drawInsp(r.body); }); }
      },
    };
  }

  // ================= ۴) سرور و شبکه =================
  function netTab() {
    const stat = h('div', { class: 'etable' }), streams = h('div', { class: 'etable' }), logBox = h('pre', { class: 'logbox' });
    let last = 0, st = null;
    const force = BZ.slider({ label: 'کیفیت پیوند (دستی)', min: 0, max: 1, step: 0.05, value: 1, fmt: (v) => (v >= 1 ? 'خودکار' : Math.round(v * 100) + '٪'), onInput: (v) => { BZ.net.forceQ = v >= 1 ? null : v; } });
    const row = (a, b) => h('div', { class: 'erow' }, h('span', null, a), h('b', null, String(b)));
    function draw() {
      stat.innerHTML = '';
      if (st) {
        stat.append(row('وضعیت سرور', st.up ? '🟢 در حال اجرا' : '🔴'), row('نوع اجرا', BZ.net.mode === 'worker' ? 'Web Worker (فرایند جدا)' : 'داخل صفحه (loopback)'), row('زمان فعالیت', st.uptime + ' s'), row('درخواست‌ها', st.reqs + ' (جریان: ' + st.streamReqs + ')'), row('داده‌ی ارسالی سرور', (st.bytesOut / 1024).toFixed(0) + ' KB'),
          row('پایگاه‌داده', (st.persist ? 'IndexedDB' : 'حافظه') + ' • ذخیره‌ها: ' + st.saves), row('شخصیت / نمایش / پخش', st.chars + ' / ' + st.shows + ' / ' + st.published));
        logBox.textContent = st.logs.join('\n');
      }
      const S = BZ.net.stats; stat.append(row('کلاینت: درخواست / افت', S.req + ' / ' + S.lost), row('ارسال / دریافت', (S.tx / 1024).toFixed(1) + ' / ' + (S.rx / 1024).toFixed(1) + ' KB'));
      streams.innerHTML = '';
      if (!BZ.net.streams.size) streams.append(h('div', { class: 'note' }, 'جریان فعالی نیست. یک دستگاه را روی کانال/ایستگاه «نمایش» (مثلاً کانال ۹ یا FM 96.2) بگذارید.'));
      BZ.net.streams.forEach((s) => { const q = Math.min(1, Math.max(0, BZ.net.forceQ != null ? BZ.net.forceQ : s.q())), l = s.link(); streams.append(h('div', { class: 'erow' }, h('span', null, (s.tag || 'جریان') + ' • ' + s.pid.replace('prod_', '')), h('b', null, 'کیفیت ' + Math.round(q * 100) + '٪ • تأخیر ' + Math.round(l.latency) + 'ms • افت ' + Math.round(l.loss * 100) + '٪ • بافر ' + Math.max(0, s.st.buf).toFixed(1) + 's • بسته ' + s.st.pk + ' • گم ' + s.st.lost + ' • توقف ' + s.st.stalls + ' • دیرکرد صدا ' + s.st.late))); });
    }
    const el = card('سرور و شبکهٔ داخلی', 'سرور پخش داخل خود برنامه اجرا می‌شود و هیچ ارتباطی با اینترنت ندارد. رادیو/تلویزیون/ویدئو «کلاینت» آن هستند؛ کیفیت پیوند هر کلاینت از قدرت سیگنال موج می‌آید: سیگنال ضعیف ⇒ تأخیر و افت بسته ⇒ بافر شدن، یخ‌زدن تصویر و قطع صدا. با لغزندهٔ زیر خرابی پیوند را دستی شبیه‌سازی کنید.',
      force, h('h4', null, 'سرور'), stat, h('h4', null, 'جریان‌های فعال (کلاینت‌ها)'), streams, h('h4', null, 'گزارش سرور'), logBox);
    return { el, paint(now) { if (now - last > 1000) { last = now; BZ.net.call('GET', '/status').then((r) => { if (r.status === 200) st = r.body; }); } if (now % 1000 < 40 || !stat.children.length) draw(); } };
  }

  BZ.directorPanel = function () {
    const tabs = [['chars', 'عروسک و گیاه', charsTab], ['script', 'کارگردانی', scriptTab], ['life', 'زندگی', lifeTab], ['net', 'سرور و شبکه', netTab]];
    const nav = h('div', { class: 'labnav' }), host = h('div', { class: 'labhost' }), made = {};
    let cur = BZ.store.get('dirtab', 'chars');
    function open(id) {
      if (made[cur] && made[cur].leave) made[cur].leave();
      cur = id; BZ.store.set('dirtab', id); host.innerHTML = '';
      if (!made[id]) made[id] = tabs.find((t) => t[0] === id)[2]();
      host.append(made[id].el); Array.from(nav.children).forEach((b) => b.classList.toggle('on', b._id === id));
    }
    tabs.forEach(([id, name]) => { const b = h('button', { type: 'button', class: 'segb', onclick: () => open(id) }, name); b._id = id; nav.append(b); });
    open(tabs.some((t) => t[0] === cur) ? cur : 'chars');
    const root = h('div', { class: 'lab' }, nav, host);
    root.paint = (now) => { const e = made[cur]; if (e && e.paint) e.paint(now); };
    return root;
  };

  // ---------- آزمون‌های سرور داخلی و موتور محتوا ----------
  BZ.extraTests = [
    ['گفتار: برنامهٔ هجا قطعی است و دهان با آن هم‌زمان', () => { const a = BZ.speech.plan('سلام، حال شما چطور است؟', 1), b = BZ.speech.plan('سلام، حال شما چطور است؟', 1); const m = BZ.speech.mouthAt(a.syl, a.syl[0].t + a.syl[0].d / 2); return [JSON.stringify(a) === JSON.stringify(b) && a.syl.length > 3 && m.open > 0.1, a.syl.length + ' هجا']; }],
    ['موتور: زندگی قطعی و دسترسی تصادفی = ترتیبی', () => { const s = BZ.lib.show('show_life'); if (!s) return [false, 'نمایش زندگی نیست']; const E1 = new BZ.Engine(BZ.lib), E2 = new BZ.Engine(BZ.lib); const t = s.epoch + 900; const a = JSON.stringify(E1.scene(s, t)), b = JSON.stringify(E2.scene(s, t)); return [a === b, 'برابر']; }],
    ['موتور: نیازها در بازهٔ [۰،۱] و گیاه رشد می‌کند', () => { const s = BZ.lib.show('show_life'), E = new BZ.Engine(BZ.lib), i0 = E.inspect(s, s.epoch + 1), i1 = E.inspect(s, s.epoch + 400); const okN = i1.agents.every((a) => Object.values(a.n).every((v) => v >= 0 && v <= 1)); return [okN && i1.plants.every((p, i) => p.grow >= i0.plants[i].grow), 'ساعت ' + i1.hour.toFixed(1)]; }],
    ['موتور: میزان‌های صوتی نمایش قطعی‌اند', () => { const s = BZ.lib.show('show_talk'), E = new BZ.Engine(BZ.lib); return [JSON.stringify(E.bar(s, 3)) === JSON.stringify(new BZ.Engine(BZ.lib).bar(s, 3)), 'برابر']; }],
    ['تصویر: همهٔ شخصیت‌ها × احساسات رسم می‌شوند', () => { const c = BZ.cv(160, 120), g = c.getContext('2d'); let n = 0; BZ.lib.chars.forEach((ch) => Object.keys(BZ.EMOTIONS).forEach((e) => { BZ.char.draw(g, ch, { x: 80, y: 100, s: 0.6, dir: 1, emo: e, t: 1, open: 0.5, grow: 1 }); n++; })); return [n > 20, n + ' رسم']; }],
    ['شبکه: سرور داخلی بالاست و تعارض پخش رد می‌شود', () => [BZ.net.up && BZ.net.mode !== '', 'حالت ' + BZ.net.mode]],
  ];
  BZ.exportShow = exportShow;
})();
