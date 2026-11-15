/* world.js — «اتر» مجازی: ایستگاه‌ها، شبکه‌های تلویزیونی، مدل انتشار امواج و ساعت جهان */
(function () {
  'use strict';
  const BZ = window.BZ;

  // ---------- برنامه‌ها (محتوای پخش؛ صدا و تصویر هر دو از روی seed ساخته می‌شوند) ----------
  const P = (id, name, kind, audio, video) => ({ id, name, kind, audio, video });
  const TICK = 'سامانهٔ آزمایشی باز — همهٔ پخش‌ها درون همین برنامه تولید می‌شوند • موج، مدولاسیون و گیرنده را در آزمایشگاه بیازمایید';
  const BUILTIN_PROGRAMS = [
    P('talk1', 'گفتگوی شبانه', 'talk', { style: 'talk', bpm: 100, root: 48, scale: 'minor', seed: 'talk1', f0: 118, density: 0.7 }, { scene: 'news', pal: ['#0b2a55', '#1d5fc4', '#e9eef9'], title: 'گفتگوی شبانه', ticker: TICK }),
    P('news1', 'اخبار سراسری', 'talk', { style: 'talk', bpm: 112, root: 50, scale: 'minor', seed: 'news1', f0: 205, density: 0.85 }, { scene: 'news', pal: ['#3a0c0c', '#b3261e', '#fbeaea'], title: 'اخبار سراسری', ticker: TICK }),
    P('classic1', 'کنسرت کلاسیک', 'music', { style: 'classical', bpm: 84, root: 55, scale: 'major', seed: 'cl1', density: 0.6 }, { scene: 'music', pal: ['#1b1330', '#6b4bd8', '#f1d9a0'], title: 'کنسرت کلاسیک', ticker: '' }),
    P('persian1', 'نوای سنتی', 'music', { style: 'persian', bpm: 92, root: 50, scale: 'chahargah', seed: 'pe1', density: 0.7 }, { scene: 'music', pal: ['#0d2b2b', '#1c8c86', '#f4c15d'], title: 'نوای سنتی', ticker: '' }),
    P('persian2', 'شبانگاه همایون', 'music', { style: 'persian', bpm: 76, root: 52, scale: 'homayun', seed: 'pe2', density: 0.55 }, { scene: 'music', pal: ['#2a0f1c', '#a3345b', '#f7d9b0'], title: 'شبانگاه همایون', ticker: '' }),
    P('jazz1', 'جاز شبانه', 'music', { style: 'jazz', bpm: 118, root: 48, scale: 'dorian', seed: 'jz1', density: 0.6 }, { scene: 'music', pal: ['#14100a', '#a9762a', '#f2dfb5'], title: 'جاز شبانه', ticker: '' }),
    P('pop1', 'پیام موج', 'music', { style: 'pop', bpm: 108, root: 52, scale: 'major', seed: 'pp1', density: 0.7 }, { scene: 'music', pal: ['#150a2a', '#ff3d81', '#ffd23f'], title: 'پیام موج', ticker: '' }),
    P('amb1', 'نوای آرام', 'music', { style: 'ambient', bpm: 60, root: 45, scale: 'dorian', seed: 'am1', density: 0.5 }, { scene: 'nature', pal: ['#0a1a2a', '#3d7fa8', '#f0e6c8'], title: 'نوای آرام', ticker: '' }),
    P('elec1', 'الکترو ویو', 'music', { style: 'electronic', bpm: 124, root: 45, scale: 'minor', seed: 'el1', density: 0.75 }, { scene: 'music', pal: ['#050816', '#00e5ff', '#ff2bd6'], title: 'الکترو ویو', ticker: '' }),
    P('test1', 'سیگنال آزمون', 'test', { style: 'tone', bpm: 60, root: 69, scale: 'major', seed: 'ts1', density: 1 }, { scene: 'testcard', pal: ['#111', '#888', '#fff'], title: 'تصویر آزمون', ticker: '' }),
    P('kids1', 'شبکهٔ کودک', 'music', { style: 'pop', bpm: 128, root: 55, scale: 'pent', seed: 'kd1', density: 0.8 }, { scene: 'cartoon', pal: ['#2b6cff', '#ffd23f', '#ff5a5f'], title: 'ماجراهای رنگی', ticker: '' }),
    P('nature1', 'مستند طبیعت', 'music', { style: 'ambient', bpm: 66, root: 48, scale: 'pent', seed: 'na1', density: 0.6 }, { scene: 'nature', pal: ['#0b2a3a', '#2f8f6b', '#fff1c1'], title: 'سیاره آبی', ticker: '' }),
    P('sport1', 'ورزش زنده', 'talk', { style: 'talk', bpm: 128, root: 48, scale: 'minor', seed: 'sp1', f0: 130, density: 0.95 }, { scene: 'sport', pal: ['#0e5a2a', '#1f9d4d', '#ffffff'], title: 'مسابقهٔ زنده', ticker: '' }),
    P('film1', 'فیلم سینمایی', 'music', { style: 'classical', bpm: 70, root: 52, scale: 'minor', seed: 'fl1', density: 0.5 }, { scene: 'cinema', pal: ['#0a0a10', '#3b4a6b', '#f2e2b8'], title: 'شب‌های مهتاب', ticker: '' }),
    P('weather1', 'هواشناسی', 'music', { style: 'jazz', bpm: 96, root: 55, scale: 'major', seed: 'we1', density: 0.4 }, { scene: 'weather', pal: ['#082338', '#2b82c9', '#ffffff'], title: 'وضعیت جوی', ticker: '' }),
  ];

  // ایستگاه‌های رادیویی — AM: کیلوهرتز، FM و SW: مگاهرتز. موقعیت روی نقشهٔ ۱۰۰×۱۰۰ کیلومتر
  const S = (id, name, band, freq, power, x, y, program, stereo) => ({ id, name, band, freq, power, x, y, program, stereo: !!stereo });
  const BUILTIN_STATIONS = [
    S('am594', 'رادیو گفتگو', 'AM', 594, 50, 30, 60, 'talk1'),
    S('am810', 'رادیو کلاسیک', 'AM', 810, 20, 70, 30, 'classic1'),
    S('am1008', 'رادیو سنتی', 'AM', 1008, 10, 45, 52, 'persian1'),
    S('am1224', 'رادیو جاز', 'AM', 1224, 30, 20, 25, 'jazz1'),
    S('am1440', 'فرستندهٔ آزمون AM', 'AM', 1440, 2, 52, 48, 'test1'),
    S('am1566', 'رادیو دورشنو', 'AM', 1566, 250, 95, 95, 'amb1'),
    S('fm884', 'پیام موج', 'FM', 88.4, 60, 55, 45, 'pop1', true),
    S('fm912', 'نوای آرام', 'FM', 91.2, 40, 35, 60, 'amb1', true),
    S('fm946', 'جاز شبانه', 'FM', 94.6, 50, 60, 70, 'jazz1', true),
    S('fm980', 'الکترو ویو', 'FM', 98.0, 80, 48, 40, 'elec1', true),
    S('fm1013', 'گفتگوی ایران', 'FM', 101.3, 60, 70, 55, 'news1', true),
    S('fm1045', 'سنتی اف‌ام', 'FM', 104.5, 40, 25, 35, 'persian2', true),
    S('fm1071', 'فرستندهٔ آزمون FM', 'FM', 107.1, 5, 51, 51, 'test1', true),
    S('sw475', 'موج کوتاه شبانه', 'SW', 4.75, 500, 80, 80, 'talk1'),
    S('sw620', 'صدای دور', 'SW', 6.2, 500, 10, 10, 'persian2'),
    S('sw950', 'کلاسیک بین‌المللی', 'SW', 9.5, 500, 90, 20, 'classic1'),
    S('sw1530', 'الکترو دور', 'SW', 15.3, 500, 10, 90, 'elec1'),
    S('sw1770', 'آرامش روز', 'SW', 17.7, 500, 95, 60, 'amb1'),
  ];

  // شبکه‌های تلویزیونی (شماره کانال)
  const C = (id, number, name, power, x, y, program) => ({ id, number, name, band: number <= 13 ? 'VHF' : 'UHF', power, x, y, program });
  const BUILTIN_CHANNELS = [
    C('ch2', 2, 'شبکهٔ خبر', 80, 50, 60, 'news1'),
    C('ch4', 4, 'تصویر آزمون', 30, 52, 52, 'test1'),
    C('ch6', 6, 'شبکهٔ کودک', 60, 40, 45, 'kids1'),
    C('ch8', 8, 'مستند طبیعت', 60, 65, 40, 'nature1'),
    C('ch11', 11, 'ورزش', 80, 30, 55, 'sport1'),
    C('ch25', 25, 'سینما', 100, 55, 70, 'film1'),
    C('ch32', 32, 'موزیک‌ویدئو', 100, 45, 30, 'pop1'),
    C('ch41', 41, 'هواشناسی', 60, 80, 55, 'weather1'),
  ];

  // ---------- مدل انتشار ----------
  const rf = (BZ.rf = {
    noiseFloor(band, env) { return (band === 'AM' ? 12 : band === 'SW' ? 14 : 10) + 30 * env.noise; },
    txdB(src) { return 10 * Math.log10(src.power * 1000) + 20; },
    dist(src, env) { return Math.max(0.5, Math.hypot(src.x - env.rx.x, src.y - env.rx.y)); },
    pathLoss(src, d, night) {
      const b = src.band;
      if (b === 'AM') { let L = 20 * Math.log10(d) + 0.2 * d; if (night) L -= Math.min(12, d / 4); return L; } // شب: موج آسمانی
      if (b === 'SW') { const opt = night ? 6 : 16; return 20 * Math.log10(d) + 0.1 * d + Math.abs(src.freq - opt) * 1.1 - 2; }
      return 20 * Math.log10(d) + 0.35 * d; // FM / VHF / UHF: دید مستقیم
    },
    // قدرت سیگنال ۰..۱
    strength(src, env, night) {
      const d = rf.dist(src, env);
      const m = rf.txdB(src) - rf.pathLoss(src, d, night) - rf.noiseFloor(src.band, env);
      return BZ.clamp(m / 30, 0, 1);
    },
    selectivity(df, bw) { return Math.exp(-2 * (df / bw) * (df / bw)); },
    // گیرنده‌ای روی فرکانس f با پهنای باند bw: همهٔ ایستگاه‌های قابل‌شنیدن به ترتیب وزن
    receive(band, f, bw, env, night, list) {
      const out = [];
      for (const s of list) {
        if (s.band !== band) continue;
        const df = Math.abs(s.freq - f);
        const st = rf.strength(s, env, night);
        const w = st * rf.selectivity(df, bw);
        out.push({ src: s, s: st, df, w });
      }
      return out.sort((a, b) => b.w - a.w);
    },
  });

  // ---------- جهان ----------
  const W = (BZ.world = {
    time: 19.5 * 3600, // ساعت جهان به ثانیه (۱۹:۳۰ روز اول)
    speed: 1,
    env: { noise: 0.3, interference: 0.15, multipath: 0.2, standard: 'PAL', dayMode: 'auto', rx: { x: 50, y: 50 } },
    programs: {}, stations: [], channels: [],
    custom: { programs: [], stations: [], channels: [] },
    hour() { return (W.time / 3600) % 24; },
    isNight() {
      const m = W.env.dayMode;
      if (m === 'night') return true;
      if (m === 'day') return false;
      const h = W.hour();
      return h >= 18.5 || h < 6;
    },
    tick(dt) { W.time += dt * W.speed; },
    rebuild() {
      W.programs = {};
      BUILTIN_PROGRAMS.concat(W.custom.programs).forEach((p) => { W.programs[p.id] = p; });
      W.stations = BUILTIN_STATIONS.concat(W.custom.stations);
      W.channels = BUILTIN_CHANNELS.concat(W.custom.channels);
    },
    save() { BZ.store.set('world', { env: W.env, custom: W.custom, speed: W.speed }); },
    load() {
      const d = BZ.store.get('world', null);
      if (d) {
        Object.assign(W.env, d.env || {});
        if (d.env && d.env.rx) W.env.rx = d.env.rx;
        if (d.custom) W.custom = { programs: d.custom.programs || [], stations: d.custom.stations || [], channels: d.custom.channels || [] };
        W.speed = d.speed || 1;
      }
      W.rebuild();
    },
    program(id) { return W.programs[id] || W.programs.test1; },
    addCustom(kind, obj) { W.custom[kind].push(obj); W.rebuild(); W.save(); },
    removeCustom(kind, id) { W.custom[kind] = W.custom[kind].filter((x) => x.id !== id); W.rebuild(); W.save(); },
    stationFor(band, f) { return W.stations.find((s) => s.band === band && Math.abs(s.freq - f) < 1e-6); },
    channelByNumber(n) { return W.channels.find((c) => c.number === n); },
  });
  W.rebuild();
})();
