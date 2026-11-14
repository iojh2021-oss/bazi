/* app.js — راه‌اندازی برنامه: دستگاه‌ها، اتاق (خانه)، ناوبری، حلقهٔ زمان و ثبت PWA */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  BZ.world.load();
  BZ.radio = new BZ.Radio('main');
  BZ.tv = new BZ.TV();
  BZ.vcr = new BZ.VCR();
  BZ.hifi = new BZ.HiFi();

  const main = document.getElementById('main'), nav = document.getElementById('nav'), clockEl = document.getElementById('clock');
  const views = {};
  let cur = 'home';

  const cabinet = (cls, title, sub, body) => h('div', { class: 'cab ' + cls }, h('div', { class: 'cab-head' }, h('h2', null, title), h('span', null, sub)), body);

  function homeView() {
    const tiles = {};
    const mk = (id, icon, title, open) => {
      const st = h('div', { class: 'tile-st' }), led = BZ.led('green');
      const pw = BZ.toggle('⏻', false, (v) => {
        BZ.audio.init();
        if (id === 'radio') BZ.radio.power(v); else if (id === 'tv') { BZ.tv.power(v); BZ.vcr.setDemand('tv', v && BZ.tv.input === 'AV'); } else if (id === 'vcr') BZ.vcr.power(v); else BZ.hifi.power(v);
      }, 'pw');
      const t = h('div', { class: 'tile' }, h('div', { class: 'tile-ic' }, icon), h('div', { class: 'tile-body' }, h('b', null, title), st), h('div', { class: 'tile-act' }, led, pw, BZ.btn('باز کردن', () => show(open), 'sm')));
      tiles[id] = { st, led, pw }; return t;
    };
    const flow = h('div', { class: 'flow' },
      h('div', { class: 'fl-box' }, '🌐 اتر مجازی', h('small', null, 'فرستنده‌ها • نویز • روز/شب')),
      h('span', { class: 'fl-arrow' }, '➜'),
      h('div', { class: 'fl-col' }, h('div', { class: 'fl-box' }, '📻 رادیو'), h('div', { class: 'fl-box' }, '📺 تلویزیون'), h('div', { class: 'fl-box' }, '📼 ویدئو (تیونر + نوار)')),
      h('span', { class: 'fl-arrow' }, '➜'),
      h('div', { class: 'fl-box' }, '🔊 هایفای', h('small', null, 'ورودی: تیونر، CD، گرامافون، TV، VCR')));
    const info = h('div', { class: 'info' },
      h('p', null, h('b', null, 'همه‌چیز درون همین برنامه شبیه‌سازی می‌شود: '), 'ایستگاه‌ها، شبکه‌های تلویزیونی و نوارها ساختگی‌اند و هیچ ارتباطی با شبکه، میکروفن یا سخت‌افزار رادیویی واقعی ندارند.'),
      h('ol', null,
        h('li', null, 'یک دستگاه را روشن کنید (نخستین بار صدا فعال می‌شود).'),
        h('li', null, 'رادیو: دایال را بکشید یا «جستجو» بزنید؛ شب، ایستگاه‌های دور AM بهتر شنیده می‌شوند.'),
        h('li', null, 'ویدئو: نوار خام بگذارید، کانال را انتخاب و ضبط کنید؛ سپس تلویزیون را روی AV بگذارید و پخش کنید.'),
        h('li', null, 'هایفای: منبع را TV یا VCR بگذارید تا صدای آن‌ها از آمپلی‌فایر پخش شود.'),
        h('li', null, 'آزمایشگاه: محیط اتر را تغییر دهید، برنامه بسازید و اکوسیستم را آزمون کنید.')));
    const root = h('div', { class: 'home' },
      cabinet('wood', 'اتاق آزمایش', 'چهار دستگاه یک اکوسیستم', h('div', { class: 'tiles' }, mk('radio', '📻', 'رادیو', 'radio'), mk('tv', '📺', 'تلویزیون', 'tv'), mk('vcr', '📼', 'ویدئو', 'vcr'), mk('hifi', '🎛', 'هایفای', 'hifi'))),
      h('div', { class: 'panel' }, h('h3', null, 'مسیر سیگنال'), flow), info,
      h('div', { class: 'r-ctrl' }, BZ.btn('خاموش‌کردن همهٔ دستگاه‌ها', () => { BZ.radio.power(false); BZ.tv.power(false); BZ.vcr.power(false); BZ.hifi.power(false); BZ.vcr.setDemand('tv', false); }), BZ.btn('🧪 رفتن به آزمایشگاه', () => show('lab'), 'go')));
    root.paint = function () {
      const r = BZ.radio, tv = BZ.tv, v = BZ.vcr, hf = BZ.hifi;
      const rs = r.on ? (r.station ? r.station.name + ' — ' + BZ.BANDS[r.band].fmt(r.freq[r.band]) + ' ' + BZ.BANDS[r.band].unit : 'نویز — ' + BZ.BANDS[r.band].fmt(r.freq[r.band])) : 'خاموش';
      const c = BZ.world.channelByNumber(tv.channel), ts = tv.on ? (tv.input === 'AV' ? 'ورودی AV' : 'کانال ' + tv.channel + (c ? ' — ' + c.name : '')) : 'خاموش';
      const hs = hf.on ? { TUNER: 'تیونر', CD: 'سی‌دی', PHONO: 'گرامافون', TV: 'ورودی تلویزیون', VCR: 'ورودی ویدئو' }[hf.source] : 'خاموش';
      const map = { radio: [r.on, rs], tv: [tv.on, ts], vcr: [v.on, v.on ? v.statusText() : 'خاموش'], hifi: [hf.on, hs] };
      Object.keys(map).forEach((k) => { tiles[k].st.textContent = map[k][1]; tiles[k].led.set(map[k][0]); tiles[k].pw.set(map[k][0]); });
    };
    return root;
  }

  views.home = { build: homeView };
  views.radio = { build: () => cabinet('wood', 'رادیو', 'AM • FM استریو • موج کوتاه', BZ.radioPanel(BZ.radio)) };
  views.tv = { build: () => cabinet('tvcab', 'تلویزیون', 'لامپی (CRT) • PAL/NTSC', BZ.tvPanel(BZ.tv)) };
  views.vcr = { build: () => cabinet('vcrcab', 'ویدئوی نواری', 'ضبط • پخش • زمان‌بندی • ردیابی', BZ.vcrPanel(BZ.vcr)) };
  views.hifi = { build: () => cabinet('hifi', 'هایفای استریو', 'تیونر • CD • گرامافون • آمپلی‌فایر', BZ.hifiPanel(BZ.hifi)) };
  views.lab = { build: () => BZ.labPanel() };

  function show(id) {
    cur = id; BZ.store.set('view', id);
    main.innerHTML = '';
    if (!views[id].el) views[id].el = views[id].build();
    main.append(views[id].el);
    Array.from(nav.children).forEach((b) => b.classList.toggle('on', b._id === id));
    window.scrollTo(0, 0);
  }
  BZ.show = show;

  [['home', '🏠', 'اتاق'], ['radio', '📻', 'رادیو'], ['tv', '📺', 'تلویزیون'], ['vcr', '📼', 'ویدئو'], ['hifi', '🎛', 'هایفای'], ['lab', '🧪', 'آزمایشگاه']].forEach(([id, ic, name]) => {
    const b = h('button', { type: 'button', class: 'navb', onclick: () => show(id) }, h('span', null, ic), name); b._id = id; nav.append(b);
  });

  // ----- ولوم کل و بی‌صدا -----
  const vol = document.getElementById('mvol'), mute = document.getElementById('mmute');
  vol.value = BZ.audio.volume;
  vol.addEventListener('input', () => BZ.audio.setVolume(+vol.value));
  mute.addEventListener('click', () => { BZ.audio.setMuted(!BZ.audio.muted); mute.textContent = BZ.audio.muted ? '🔇' : '🔊'; });

  // ----- شروع (برای فعال‌شدن صدا لازم است کاربر لمس کند) -----
  const gate = document.getElementById('gate');
  document.getElementById('enter').addEventListener('click', () => {
    if (!BZ.audio.init()) BZ.toast('این مرورگر Web Audio ندارد؛ تصویر و آزمایش‌ها کار می‌کنند ولی صدا نه');
    gate.classList.add('hide');
  });

  // ----- حلقهٔ زمان (۱۰ بار در ثانیه) -----
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
    try {
      BZ.world.tick(dt); BZ.vcr.tick(dt);
      if (BZ.audio.ctx) { BZ.radio.update(dt); BZ.tv.update(); BZ.vcr.update(); BZ.hifi.update(dt); }
      clockEl.textContent = BZ.clockHM(BZ.world.time) + (BZ.world.isNight() ? ' 🌙' : ' ☀') + (BZ.world.speed > 1 ? ' ×' + BZ.world.speed : '');
    } catch (e) { console.error(e); }
  }, 100);
  setInterval(() => BZ.vcr.on && BZ.vcr.save(), 5000);

  // ----- رسم -----
  (function frame(now) {
    const v = views[cur];
    if (v && v.el && v.el.paint) { try { v.el.paint(now); } catch (e) { console.error(e); } }
    requestAnimationFrame(frame);
  })(performance.now());

  window.addEventListener('error', (e) => BZ.toast('خطا: ' + (e.message || '')));
  show(views[BZ.store.get('view', 'home')] ? BZ.store.get('view', 'home') : 'home');

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
