/* hifi.js — سیستم هایفای استریو: تیونر، CD، گرامافون (RIAA)، ورودی TV/VCR، آمپلی‌فایر، اکولایزر ۷ باند، اتاق، VU و طیف‌نما */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  // ---------- آلبوم‌های مجازی (هر آهنگ از روی seed ساخته می‌شود) ----------
  const ALB = [
    { name: 'ساعت‌های آبی', artist: 'گروه موج', st: ['ambient', 'classical', 'ambient', 'jazz', 'ambient'], sc: ['dorian', 'major', 'pent', 'dorian', 'minor'], tt: ['سپیده', 'باران روی شیشه', 'مه', 'بازگشت', 'خواب'] },
    { name: 'شب‌های تهران', artist: 'کوارتت چهارگاه', st: ['persian', 'persian', 'jazz', 'persian', 'classical'], sc: ['chahargah', 'homayun', 'dorian', 'chahargah', 'minor'], tt: ['آغاز', 'کوچه‌باغ', 'ترافیک شبانه', 'سه‌تار', 'پایان'] },
    { name: 'مدار باز', artist: 'الکترو ویو', st: ['electronic', 'pop', 'electronic', 'pop', 'electronic'], sc: ['minor', 'major', 'minor', 'pent', 'dorian'], tt: ['سیگنال', 'حلقهٔ بسته', 'فرکانس', 'نوسان‌ساز', 'پژواک'] },
  ];
  BZ.ALBUMS = ALB.map((a, i) => ({
    name: a.name, artist: a.artist,
    tracks: a.tt.map((t, j) => {
      const R = BZ.rng(BZ.hash('alb' + i + ':' + j));
      return { title: t, dur: 140 + Math.floor(R() * 70), prog: { id: 'cd' + i + '_' + j, name: t, kind: 'music', audio: { style: a.st[j], bpm: 70 + Math.floor(R() * 60), root: 43 + Math.floor(R() * 12), scale: a.sc[j], seed: 'cd' + i + j, density: 0.55 + R() * 0.3 }, video: { scene: 'music', pal: ['#111', '#4a7', '#fd5'], title: t, ticker: '' } } };
    }),
  }));

  const EQ_F = [63, 160, 400, 1000, 2500, 6300, 16000];
  const EQ_PRESETS = { flat: [0, 0, 0, 0, 0, 0, 0], rock: [5, 3, -2, -3, 2, 4, 5], jazz: [3, 2, 0, 2, -1, 2, 3], classic: [0, 0, 0, 0, -2, -2, -4], vocal: [-3, -2, 1, 4, 4, 1, -2] };

  BZ.HiFi = class HiFi {
    constructor() {
      const s = BZ.store.get('hifi', {});
      this.on = false; this.source = s.source || 'TUNER'; this.vol = s.vol != null ? s.vol : 0.5; this.bal = 0; this.bass = 0; this.treble = 0;
      this.loud = false; this.direct = false; this.mono = false; this.room = s.room != null ? s.room : 0.15; this.eq = s.eq || EQ_PRESETS.flat.slice();
      this.tuner = new BZ.Radio('hifi', { speaker: false });
      this.disc = 0; this.track = 0; this.playing = false; this.pos = 0; this.shuffle = false; this.repeat = false;
      this.phono = { rpm: 33, riaa: true, on: false, alb: 0, trk: 0, pos: 0, angle: 0 };
      this.g = null; this.pl = null; this.clip = false; this.vu = [0, 0]; this.hold = [0, 0]; this.linked = {};
    }
    save() { BZ.store.set('hifi', { source: this.source, vol: this.vol, room: this.room, eq: this.eq }); }
    ensure() {
      if (this.g || !BZ.audio.ctx) return !!this.g;
      const ctx = BZ.audio.ctx, A = BZ.audio, g = (this.g = {});
      const mkG = () => { const n = ctx.createGain(); n.channelCount = 2; n.channelCountMode = 'explicit'; return n; };
      g.bus = mkG(); g.in = {};
      ['TUNER', 'CD', 'PHONO', 'TV', 'VCR'].forEach((k) => { g.in[k] = mkG(); g.in[k].gain.value = 0; g.in[k].connect(g.bus); });
      // مسیر گرامافون: ضدّ-RIAA وقتی پیش‌تقویت‌کنندهٔ RIAA خاموش است (صدای نازک و پرتیز)
      g.phBass = ctx.createBiquadFilter(); g.phBass.type = 'lowshelf'; g.phBass.frequency.value = 500; g.phTreb = ctx.createBiquadFilter(); g.phTreb.type = 'highshelf'; g.phTreb.frequency.value = 2500;
      g.phIn = mkG(); g.phIn.connect(g.phBass); g.phBass.connect(g.phTreb); g.phTreb.connect(g.in.PHONO);
      g.phNoise = ctx.createGain(); g.phNoise.gain.value = 0; const pn = A.noiseLoop('pink'), hp0 = ctx.createBiquadFilter(); hp0.type = 'highpass'; hp0.frequency.value = 900; pn.connect(hp0); hp0.connect(g.phNoise); g.phNoise.connect(g.phIn);
      // تُن، لاودنس، اکولایزر
      g.bassF = ctx.createBiquadFilter(); g.bassF.type = 'lowshelf'; g.bassF.frequency.value = 100;
      g.trebF = ctx.createBiquadFilter(); g.trebF.type = 'highshelf'; g.trebF.frequency.value = 8000;
      g.loB = ctx.createBiquadFilter(); g.loB.type = 'lowshelf'; g.loB.frequency.value = 70; g.loT = ctx.createBiquadFilter(); g.loT.type = 'highshelf'; g.loT.frequency.value = 9000;
      g.bus.connect(g.bassF); g.bassF.connect(g.trebF); g.trebF.connect(g.loB); g.loB.connect(g.loT);
      let prev = g.loT; g.eqF = EQ_F.map((f) => { const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = 1.1; prev.connect(b); prev = b; return b; });
      g.width = A.makeWidth(); prev.connect(g.width.input);
      g.bal = ctx.createStereoPanner(); g.width.output.connect(g.bal);
      g.drive = ctx.createGain(); g.drive.gain.value = 0.2; g.bal.connect(g.drive);
      g.pre = ctx.createAnalyser(); g.pre.fftSize = 1024; g.drive.connect(g.pre);
      g.shape = ctx.createWaveShaper(); const n = 2048, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3)); }
      g.shape.curve = c; g.shape.oversample = '2x'; g.drive.connect(g.shape);
      g.trim = ctx.createGain(); g.trim.gain.value = 0.55; g.shape.connect(g.trim);
      g.spkHp = ctx.createBiquadFilter(); g.spkHp.type = 'highpass'; g.spkHp.frequency.value = 38; g.trim.connect(g.spkHp);
      this.spk = A.speaker(); g.dry = ctx.createGain(); g.spkHp.connect(g.dry); g.dry.connect(this.spk);
      g.conv = ctx.createConvolver(); g.conv.buffer = A.makeImpulse(1.8, 3); g.wet = ctx.createGain(); g.wet.gain.value = this.room; g.spkHp.connect(g.conv); g.conv.connect(g.wet); g.wet.connect(this.spk);
      // اندازه‌گیری
      g.ana = ctx.createAnalyser(); g.ana.fftSize = 2048; g.ana.smoothingTimeConstant = 0.7; g.trim.connect(g.ana);
      const sp = ctx.createChannelSplitter(2); g.trim.connect(sp); g.aL = ctx.createAnalyser(); g.aR = ctx.createAnalyser(); g.aL.fftSize = g.aR.fftSize = 1024; sp.connect(g.aL, 0); sp.connect(g.aR, 1);
      this.applyAll();
      return true;
    }
    applyAll() {
      if (!this.g) return;
      const T = BZ.audio.ctx.currentTime, g = this.g, d = this.direct;
      g.bassF.gain.setTargetAtTime(d ? 0 : this.bass, T, 0.05); g.trebF.gain.setTargetAtTime(d ? 0 : this.treble, T, 0.05);
      const lo = this.loud && !d ? (1 - this.vol) * 14 : 0; g.loB.gain.setTargetAtTime(lo, T, 0.05); g.loT.gain.setTargetAtTime(lo * 0.5, T, 0.05);
      g.eqF.forEach((b, i) => b.gain.setTargetAtTime(d ? 0 : this.eq[i], T, 0.05));
      g.width.setWidth(this.mono ? 0 : 1, 0.05);
      g.bal.pan.setTargetAtTime(this.bal, T, 0.05);
      g.drive.gain.setTargetAtTime(this.on ? Math.pow(this.vol, 2) * 2.4 : 0, T, 0.04);
      g.wet.gain.setTargetAtTime(this.room, T, 0.1);
      g.phBass.gain.setTargetAtTime(this.phono.riaa ? 0 : -16, T, 0.05); g.phTreb.gain.setTargetAtTime(this.phono.riaa ? 0 : 14, T, 0.05);
    }
    power(on) {
      this.on = on; if (on) this.ensure();
      if (!on) { this.stopPlayer(); this.tuner.power(false); } else this.setSource(this.source);
      this.applyAll(); BZ.bus.emit('power', { id: 'hifi', on });
    }
    setSource(s) {
      this.source = s; this.save(); if (!this.g) return;
      const T = BZ.audio.ctx.currentTime;
      Object.keys(this.g.in).forEach((k) => this.g.in[k].gain.setTargetAtTime(k === s && this.on ? 1 : 0, T, 0.04));
      this.stopPlayer(); this.playing = false; this.phono.on = false;
      if (s === 'TUNER' && this.on) { this.tuner.power(true); this.link('tuner', this.tuner.out, this.g.in.TUNER); } else this.tuner.power(false);
      if (BZ.tv) BZ.tv.external = this.on && s === 'TV';
      if (BZ.vcr) BZ.vcr.setDemand('hifi', this.on && s === 'VCR');
    }
    link(key, from, to) { if (from && !this.linked[key]) { from.connect(to); this.linked[key] = true; } }
    cur() { return BZ.ALBUMS[this.disc].tracks[this.track]; }
    stopPlayer() { if (this.pl) { this.pl.stop(); this.pl = null; } }
    startPlayer(prog, t0, rate, dest) { this.stopPlayer(); this.pl = new BZ.ProgramPlayer(BZ.audio.ctx, prog, dest, { t0, rate: rate || 1 }); }
    // CD
    play() { if (!this.on || this.source !== 'CD') return; this.playing = true; this.startPlayer(this.cur().prog, this.pos, 1, this.g.in.CD); }
    pause() { this.playing = false; this.stopPlayer(); }
    stopCd() { this.pause(); this.pos = 0; }
    seekCd(t) { this.pos = BZ.clamp(t, 0, this.cur().dur - 1); if (this.playing) this.play(); }
    goto(i) { const n = BZ.ALBUMS[this.disc].tracks.length; this.track = ((i % n) + n) % n; this.pos = 0; if (this.playing) this.play(); }
    nextTrack() { this.goto(this.shuffle ? Math.floor(Math.random() * BZ.ALBUMS[this.disc].tracks.length) : this.track + 1); }
    setDisc(i) { this.disc = i; this.track = 0; this.pos = 0; if (this.playing) this.play(); }
    // گرامافون
    phonoPlay(v) {
      const p = this.phono; if (!this.on || this.source !== 'PHONO') return;
      p.on = v; if (!v) { this.stopPlayer(); return; }
      const trk = BZ.ALBUMS[p.alb].tracks[p.trk], rate = p.rpm === 45 ? 45 / 33.3333 : 1; // سرعت نادرست = تغییر زیر و بمی و تمپو
      this.startPlayer(trk.prog, p.pos, rate, this.g.phIn);
    }
    update(dt) {
      if (!this.g) return;
      const T = BZ.audio.ctx.currentTime, W = BZ.world;
      if (!this.on) return;
      // اتصال ورودی‌های بیرونی
      if (BZ.tv && BZ.tv.out) this.link('tv', BZ.tv.out, this.g.in.TV);
      if (BZ.vcr && BZ.vcr.out) this.link('vcr', BZ.vcr.out, this.g.in.VCR);
      if (this.source === 'TUNER') { this.link('tuner', this.tuner.out, this.g.in.TUNER); this.tuner.update(dt); }
      if (this.source === 'CD' && this.playing) {
        this.pos += dt; if (this.pos >= this.cur().dur) { if (this.repeat) this.goto(this.track); else if (this.track < BZ.ALBUMS[this.disc].tracks.length - 1 || this.shuffle) this.nextTrack(); else this.stopCd(); }
      }
      const p = this.phono;
      if (this.source === 'PHONO' && p.on) {
        p.pos += dt * (p.rpm === 45 ? 45 / 33.3333 : 1);
        const tr = BZ.ALBUMS[p.alb].tracks[p.trk]; if (p.pos >= tr.dur) { p.pos = 0; p.trk = (p.trk + 1) % BZ.ALBUMS[p.alb].tracks.length; this.phonoPlay(true); }
        if (Math.random() < dt * 2.2) { const s = BZ.audio.ctx.createBufferSource(), gn = BZ.audio.ctx.createGain(); s.buffer = BZ.audio.nbuf; gn.gain.setValueAtTime(0.18 + Math.random() * 0.3, T); gn.gain.exponentialRampToValueAtTime(0.0001, T + 0.012 + Math.random() * 0.02); s.connect(gn); gn.connect(this.g.phIn); s.start(T, Math.random(), 0.05); }
      }
      this.g.phNoise.gain.setTargetAtTime(this.source === 'PHONO' && p.on ? 0.014 : 0, T, 0.1);
      this.applyAll();
    }
    meters() {
      if (!this.g) return null;
      const g = this.g, buf = new Float32Array(1024), peak = (a) => { a.getFloatTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > m) m = v; } return m; };
      const l = peak(g.aL), r = peak(g.aR), pre = peak(g.pre);
      this.vu[0] = Math.max(l, this.vu[0] * 0.9); this.vu[1] = Math.max(r, this.vu[1] * 0.9);
      this.hold[0] = Math.max(this.vu[0], this.hold[0] * 0.985); this.hold[1] = Math.max(this.vu[1], this.hold[1] * 0.985);
      this.clip = pre > 0.98; return { l, r, pre };
    }
  };

  BZ.hifiPanel = function (hf) {
    const lcd = h('div', { class: 'h-lcd', dir: 'ltr' }), lcd2 = h('div', { class: 'h-lcd2' });
    const meters = BZ.cv(560, 190, 'h-meters'), mg = meters.getContext('2d');
    const clipLed = BZ.led('red'), pw = BZ.toggle('⏻', hf.on, (v) => { if (v) BZ.audio.init(); hf.power(v); }, 'pw');
    const panes = {}, srcBtns = {};
    const tunerPanel = BZ.radioPanel(hf.tuner, { compact: true }), tunerPane = h('div', { class: 'h-pane' }, tunerPanel);
    // CD
    const discSel = BZ.select(BZ.ALBUMS.map((a, i) => ({ v: String(i), t: a.name + ' — ' + a.artist })), '0', (v) => { hf.setDisc(+v); fillTracks(); });
    const tlist = h('div', { class: 'tracks' });
    function fillTracks() { tlist.innerHTML = ''; BZ.ALBUMS[hf.disc].tracks.forEach((t, i) => tlist.append(h('button', { class: 'trk' + (i === hf.track ? ' on' : ''), type: 'button', onclick: () => { hf.goto(i); if (!hf.playing) hf.play(); } }, (i + 1) + '. ' + t.title + ' (' + BZ.fmtTime(t.dur).slice(3) + ')'))); }
    fillTracks();
    const seek = BZ.slider({ label: 'موقعیت', min: 0, max: 1, step: 0.001, value: 0, fmt: () => '', onInput: (v) => hf.seekCd(v * hf.cur().dur) });
    const cdPane = h('div', { class: 'h-pane' }, discSel, tlist, seek,
      h('div', { class: 'r-ctrl' }, BZ.btn('⏮', () => hf.goto(hf.track - 1), 'sm'), BZ.btn('▶ پخش', () => hf.play(), 'sm go'), BZ.btn('⏸', () => hf.pause(), 'sm'), BZ.btn('■', () => hf.stopCd(), 'sm'), BZ.btn('⏭', () => hf.nextTrack(), 'sm'), BZ.toggle('تصادفی', false, (v) => { hf.shuffle = v; }), BZ.toggle('تکرار', false, (v) => { hf.repeat = v; })));
    // گرامافون
    const platter = BZ.cv(150, 150, 'h-platter'), pg = platter.getContext('2d');
    const phAlb = BZ.select(BZ.ALBUMS.map((a, i) => ({ v: String(i), t: a.name })), '0', (v) => { hf.phono.alb = +v; hf.phono.trk = 0; hf.phono.pos = 0; if (hf.phono.on) hf.phonoPlay(true); });
    const phTrk = BZ.select([0, 1, 2, 3, 4].map((i) => ({ v: String(i), t: 'آهنگ ' + (i + 1) })), '0', (v) => { hf.phono.trk = +v; hf.phono.pos = 0; if (hf.phono.on) hf.phonoPlay(true); });
    const phonoPane = h('div', { class: 'h-pane' }, h('div', { class: 'r-ctrl' }, platter, h('div', null, phAlb, phTrk)),
      h('div', { class: 'r-ctrl' }, BZ.btn('▶ سوزن روی صفحه', () => hf.phonoPlay(true), 'sm go'), BZ.btn('⏏ بلند کردن سوزن', () => hf.phonoPlay(false), 'sm'),
        BZ.seg([{ v: 33, t: '33⅓ rpm' }, { v: 45, t: '45 rpm (اشتباه!)' }], 33, (v) => { hf.phono.rpm = v; if (hf.phono.on) hf.phonoPlay(true); }),
        BZ.toggle('پیش‌تقویت RIAA', true, (v) => { hf.phono.riaa = v; })),
      BZ.note('صفحه با ۳۳⅓ دور ضبط شده است. ۴۵ دور = بم و زیرِ بالاتر و تمپوی سریع‌تر. خاموش کردن RIAA صدا را نازک و پرتیز می‌کند.'));
    const extPane = (txt) => h('div', { class: 'h-pane' }, BZ.note(txt));
    panes.TUNER = tunerPane; panes.CD = cdPane; panes.PHONO = phonoPane;
    panes.TV = extPane('صدای تلویزیون از طریق هایفای پخش می‌شود و بلندگوی تلویزیون قطع است. تلویزیون را روشن کنید و کانال را عوض کنید.');
    panes.VCR = extPane('خروجی صدای ویدئو به هایفای وصل است. نوار بگذارید و پخش کنید (ورودی AV تلویزیون لازم نیست).');
    const NAMES = { TUNER: 'تیونر', CD: 'سی‌دی', PHONO: 'گرامافون', TV: 'تلویزیون', VCR: 'ویدئو' };
    const srcRow = h('div', { class: 'seg' }, Object.keys(NAMES).map((k) => (srcBtns[k] = h('button', { type: 'button', class: 'segb', onclick: () => { BZ.audio.init(); hf.setSource(k); show(); } }, NAMES[k]))));
    const paneHost = h('div', { class: 'h-panes' });
    function show() { paneHost.innerHTML = ''; paneHost.append(panes[hf.source]); Object.keys(srcBtns).forEach((k) => srcBtns[k].classList.toggle('on', k === hf.source)); }
    show();
    // آمپلی‌فایر
    const volK = BZ.knob({ label: 'بلندی', value: hf.vol, size: 78, fmt: (v) => Math.round(v * 100) + '', onInput: (v) => { hf.vol = v; hf.save(); } });
    const knobs = h('div', { class: 'r-knobs' }, volK,
      BZ.knob({ label: 'بالانس', min: -1, max: 1, value: 0, fmt: (v) => (Math.abs(v) < 0.05 ? 'مرکز' : v < 0 ? 'چپ' : 'راست'), onInput: (v) => { hf.bal = v; } }),
      BZ.knob({ label: 'بم', min: -10, max: 10, value: 0, fmt: (v) => v.toFixed(0) + ' dB', onInput: (v) => { hf.bass = v; } }),
      BZ.knob({ label: 'زیر', min: -10, max: 10, value: 0, fmt: (v) => v.toFixed(0) + ' dB', onInput: (v) => { hf.treble = v; } }),
      BZ.knob({ label: 'اتاق (reverb)', value: hf.room, fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => { hf.room = v; hf.save(); } }));
    const eqSl = EQ_F.map((f, i) => BZ.slider({ label: f >= 1000 ? f / 1000 + 'k' : String(f), min: -12, max: 12, step: 1, value: hf.eq[i], fmt: (v) => v + ' dB', onInput: (v) => { hf.eq[i] = v; hf.save(); }, cls: 'eqs' }));
    const eqPre = BZ.seg(Object.keys(EQ_PRESETS).map((k) => ({ v: k, t: { flat: 'صاف', rock: 'راک', jazz: 'جاز', classic: 'کلاسیک', vocal: 'صدا' }[k] })), 'flat', (k) => { hf.eq = EQ_PRESETS[k].slice(); eqSl.forEach((s, i) => s.set(hf.eq[i])); hf.save(); });
    const root = h('div', { class: 'hifi-body' },
      h('div', { class: 'h-top' }, lcd, lcd2), h('div', { class: 'r-ctrl' }, pw, srcRow), paneHost, knobs,
      h('div', { class: 'r-ctrl' }, BZ.toggle('لودنس', false, (v) => { hf.loud = v; }), BZ.toggle('مونو', false, (v) => { hf.mono = v; }), BZ.toggle('Direct (بدون تُن/EQ)', false, (v) => { hf.direct = v; }), clipLed, h('span', { class: 'lbl' }, 'CLIP')),
      h('details', { class: 'sub', open: true }, h('summary', null, 'اکولایزر گرافیکی ۷ باند'), eqPre, h('div', { class: 'eqbox' }, eqSl)), meters);
    const fbuf = new Uint8Array(1024), ta = new Float32Array(1024), tb = new Float32Array(1024);
    root.paint = function (now) {
      show.last = show.last || ''; if (show.last !== hf.source) { show.last = hf.source; show(); }
      pw.set(hf.on);
      if (hf.source === 'TUNER') tunerPanel.paint(now);
      let l1 = hf.on ? NAMES[hf.source] : 'OFF', l2 = '';
      if (hf.on) {
        if (hf.source === 'TUNER') { const r = hf.tuner; l1 += '  ' + BZ.BANDS[r.band].fmt(r.freq[r.band]) + ' ' + BZ.BANDS[r.band].unit; l2 = r.station ? r.station.name : 'در حال جستجو…'; }
        if (hf.source === 'CD') { const t = hf.cur(); l1 += '  ' + String(hf.track + 1).padStart(2, '0') + '  ' + BZ.fmtTime(hf.pos).slice(3) + (hf.playing ? ' ▶' : ' ■'); l2 = t.title + ' — ' + BZ.ALBUMS[hf.disc].artist; seek.set(hf.pos / t.dur); }
        if (hf.source === 'PHONO') { l1 += '  ' + (hf.phono.rpm === 45 ? '45' : '33⅓') + ' rpm'; l2 = BZ.ALBUMS[hf.phono.alb].tracks[hf.phono.trk].title; hf.phono.angle += hf.phono.on ? (hf.phono.rpm / 60) * 0.0167 * 6.283 : 0; }
        if (hf.source === 'TV') l2 = BZ.tv && BZ.tv.on ? 'کانال ' + BZ.tv.channel : 'تلویزیون خاموش است';
        if (hf.source === 'VCR') l2 = BZ.vcr ? BZ.vcr.statusText() : '';
      }
      lcd.textContent = l1; lcd2.textContent = l2;
      if (hf.source === 'CD') Array.from(tlist.children).forEach((b, i) => b.classList.toggle('on', i === hf.track));
      // صفحهٔ گرامافون
      pg.fillStyle = '#17171a'; pg.fillRect(0, 0, 150, 150); pg.save(); pg.translate(75, 75); pg.rotate(hf.phono.angle);
      pg.fillStyle = '#0a0a0a'; pg.beginPath(); pg.arc(0, 0, 70, 0, 7); pg.fill(); pg.strokeStyle = '#222'; for (let r = 25; r < 68; r += 5) { pg.beginPath(); pg.arc(0, 0, r, 0, 7); pg.stroke(); }
      pg.fillStyle = '#c0392b'; pg.beginPath(); pg.arc(0, 0, 20, 0, 7); pg.fill(); pg.fillStyle = '#eee'; pg.fillRect(-2, -20, 4, 8); pg.restore();
      pg.strokeStyle = '#bbb'; pg.lineWidth = 3; pg.beginPath(); pg.moveTo(140, 10); pg.lineTo(hf.phono.on ? 100 : 130, hf.phono.on ? 80 : 40); pg.stroke();
      // مترها
      mg.fillStyle = '#0c0f12'; mg.fillRect(0, 0, meters.width, meters.height);
      const m = hf.meters(); clipLed.set(hf.on && hf.clip);
      if (m && hf.on) {
        hf.g.ana.getByteFrequencyData(fbuf);
        const N = 40; for (let i = 0; i < N; i++) {
          const a = Math.floor(Math.pow(i / N, 2.1) * 520) + 2, b = Math.floor(Math.pow((i + 1) / N, 2.1) * 520) + 3; let s = 0, c = 0; for (let k = a; k < b && k < 1024; k++) { s += fbuf[k]; c++; }
          const v = c ? s / c / 255 : 0, w = 270 / N; mg.fillStyle = v > 0.8 ? '#e5533d' : v > 0.55 ? '#e8b130' : '#37c27a'; mg.fillRect(8 + i * w, 150 - v * 140, w - 2, v * 140);
        }
        [0, 1].forEach((c) => { const v = BZ.clamp(Math.sqrt(hf.vu[c]) * 1.05, 0, 1), x = 300 + c * 32; mg.fillStyle = '#222'; mg.fillRect(x, 10, 22, 140); mg.fillStyle = v > 0.9 ? '#e5533d' : '#37c27a'; mg.fillRect(x, 150 - v * 140, 22, v * 140); mg.fillStyle = '#fff'; mg.fillRect(x, 150 - BZ.clamp(Math.sqrt(hf.hold[c]), 0, 1) * 140, 22, 2); mg.fillStyle = '#9ab'; mg.font = '10px sans-serif'; mg.textAlign = 'center'; mg.fillText(c ? 'R' : 'L', x + 11, 168); });
        // لیساژو (XY) استریو
        hf.g.aL.getFloatTimeDomainData(ta); hf.g.aR.getFloatTimeDomainData(tb);
        mg.strokeStyle = '#334'; mg.strokeRect(380, 10, 170, 170); mg.strokeStyle = '#4fe0b0'; mg.beginPath();
        for (let i = 0; i < 512; i++) { const x = 465 + ta[i] * 160, y = 95 - tb[i] * 160; if (i) mg.lineTo(x, y); else mg.moveTo(x, y); } mg.stroke();
      } else { mg.fillStyle = '#456'; mg.font = '13px ' + BZ.FONT; mg.textAlign = 'center'; mg.fillText('طیف‌نما، VU و لیساژو (XY) — دستگاه را روشن کنید', 280, 95); }
    };
    return root;
  };
})();
