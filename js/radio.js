/* radio.js — گیرندهٔ رادیو (AM / FM استریو / موج کوتاه) با مدل واقعی‌نما: انتخاب‌پذیری، نویز، محو شدن، سوت تداخل، اثر غلبهٔ FM */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  const BANDS = {
    AM: { min: 531, max: 1701, step: 9, fine: 1, unit: 'kHz', fmt: (f) => String(Math.round(f)), bw: 5, bwN: 3, lp: 5200, lpN: 2800, label: 'موج متوسط AM' },
    FM: { min: 87.5, max: 108, step: 0.1, fine: 0.02, unit: 'MHz', fmt: (f) => f.toFixed(1), bw: 0.12, bwN: 0.12, lp: 15000, lpN: 15000, label: 'اف‌ام استریو' },
    SW: { min: 3, max: 22, step: 0.05, fine: 0.005, unit: 'MHz', fmt: (f) => f.toFixed(3), bw: 0.015, bwN: 0.01, lp: 4200, lpN: 2600, label: 'موج کوتاه SW' },
  };
  BZ.BANDS = BANDS;

  BZ.Radio = class Radio {
    constructor(id, opts) {
      opts = opts || {};
      this.id = id; this.useSpeaker = opts.speaker !== false;
      this.on = false; this.band = 'FM';
      const saved = BZ.store.get('radio.' + id, {});
      this.freq = Object.assign({ AM: 1008, FM: 91.2, SW: 6.2 }, saved.freq);
      this.vol = saved.vol != null ? saved.vol : 0.6; this.tone = saved.tone != null ? saved.tone : 0.5;
      this.narrow = !!saved.narrow; this.squelch = saved.squelch || 0;
      this.presets = saved.presets || [{ band: 'FM', f: 88.4 }, { band: 'FM', f: 91.2 }, { band: 'FM', f: 98.0 }, { band: 'AM', f: 1008 }, { band: 'AM', f: 594 }, { band: 'SW', f: 9.5 }];
      this.sig = 0; this.stereo = false; this.station = null; this.dom = null; this.list = [];
      this.players = new Map(); this.g = null; this.glide = null; this.tuning = 0;
    }
    save() { BZ.store.set('radio.' + this.id, { freq: this.freq, vol: this.vol, tone: this.tone, narrow: this.narrow, squelch: this.squelch, presets: this.presets }); }
    ensure() {
      if (this.g || !BZ.audio.ctx) return !!this.g;
      const ctx = BZ.audio.ctx, A = BZ.audio, g = (this.g = {});
      g.pre = ctx.createGain();
      g.src = ctx.createGain(); g.width = A.makeWidth(); g.src.connect(g.width.input); g.width.output.connect(g.pre);
      // نویز و سوت
      g.nw = ctx.createGain(); g.nw.gain.value = 0; g.np = ctx.createGain(); g.np.gain.value = 0;
      const wn = A.noiseLoop('white'), pn = A.noiseLoop('pink'), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      wn.connect(hp); hp.connect(g.nw); pn.connect(g.np); g.nw.connect(g.pre); g.np.connect(g.pre);
      g.beat = ctx.createOscillator(); g.beat.type = 'sine'; g.beat.frequency.value = 1000; g.bg = ctx.createGain(); g.bg.gain.value = 0;
      g.beat.connect(g.bg); g.bg.connect(g.pre); g.beat.start();
      g.lp = ctx.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.frequency.value = 15000; g.lp.Q.value = 0.5;
      g.bass = ctx.createBiquadFilter(); g.bass.type = 'lowshelf'; g.bass.frequency.value = 220;
      g.treb = ctx.createBiquadFilter(); g.treb.type = 'highshelf'; g.treb.frequency.value = 3200;
      g.vol = ctx.createGain(); g.vol.gain.value = 0;
      g.pre.connect(g.lp); g.lp.connect(g.bass); g.bass.connect(g.treb); g.treb.connect(g.vol);
      this.out = ctx.createGain(); g.vol.connect(this.out);
      if (this.useSpeaker) { this.spk = A.speaker(); this.out.connect(this.spk); }
      this.applyTone();
      return true;
    }
    applyTone() {
      if (!this.g) return;
      const T = BZ.audio.ctx.currentTime, k = this.tone - 0.5;
      this.g.bass.gain.setTargetAtTime(-k * 14, T, 0.05); this.g.treb.gain.setTargetAtTime(k * 20, T, 0.05);
    }
    power(on) {
      this.on = on;
      if (on) this.ensure();
      if (!this.g) return;
      if (!on) { this.players.forEach((p) => { p.pl.stop(); }); this.players.clear(); this.g.vol.gain.setTargetAtTime(0, BZ.audio.ctx.currentTime, 0.03); }
      BZ.bus.emit('power', { id: this.id, on });
    }
    setBand(b) { this.band = b; this.glide = null; this.save(); }
    setFreq(f) { const B = BANDS[this.band]; this.freq[this.band] = BZ.clamp(f, B.min, B.max); this.tuning = 1; }
    stepBy(dir, fine) { const B = BANDS[this.band]; this.glide = null; this.setFreq(this.freq[this.band] + dir * (fine ? B.fine : B.step)); this.save(); }
    // جستجو: نزدیک‌ترین ایستگاهِ قابل‌شنیدن در جهت dir
    seek(dir) {
      const env = BZ.world.env, night = BZ.world.isNight(), cur = this.freq[this.band];
      let c = BZ.world.stations.filter((s) => s.band === this.band && BZ.rf.strength(s, env, night) > 0.25);
      if (!c.length) { BZ.toast('ایستگاهی پیدا نشد'); return; }
      c.sort((a, b) => a.freq - b.freq);
      let nx = dir > 0 ? c.find((s) => s.freq > cur + 1e-6) || c[0] : [...c].reverse().find((s) => s.freq < cur - 1e-6) || c[c.length - 1];
      this.glide = { from: cur, to: nx.freq, t0: performance.now(), dur: 900 };
    }
    advanceGlide(now) {
      const g = this.glide; if (!g) return;
      const k = BZ.clamp((now - g.t0) / g.dur, 0, 1), e = BZ.smooth(k);
      this.freq[this.band] = g.from + (g.to - g.from) * e; this.tuning = 1 - k * 0.5;
      if (k >= 1) { this.glide = null; this.save(); }
    }
    stopPlayer(id) { const p = this.players.get(id); if (p) { const T = BZ.audio.ctx.currentTime; p.g.gain.setTargetAtTime(0, T, 0.03); setTimeout(() => { p.pl.stop(); try { p.g.disconnect(); } catch (e) { /* ignore */ } }, 160); this.players.delete(id); } }
    pop() {
      const ctx = BZ.audio.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), T = ctx.currentTime;
      s.buffer = BZ.audio.nbuf; g.gain.setValueAtTime(0.5 + Math.random() * 0.5, T); g.gain.exponentialRampToValueAtTime(0.0001, T + 0.02 + Math.random() * 0.05);
      s.connect(g); g.connect(this.g.pre); s.start(T, Math.random(), 0.1);
    }
    // به‌روزرسانی صوتی — حدود ۱۰ بار در ثانیه
    update(dt) {
      if (!this.on || !this.g) return;
      const ctx = BZ.audio.ctx, T = ctx.currentTime, W = BZ.world, env = W.env, night = W.isNight(), B = BANDS[this.band];
      const f = this.freq[this.band], bw = this.narrow ? B.bwN : B.bw;
      let list = BZ.rf.receive(this.band, f, bw, env, night, W.stations).filter((r) => r.w > 0.03).slice(0, 3);
      const now = performance.now() / 1000;
      list.forEach((r) => { // محو شدن (fading): شب و موج کوتاه شدیدتر
        if (this.band !== 'FM') { const depth = this.band === 'SW' ? 0.5 : night ? 0.28 : 0.06; r.w *= 1 - depth * (0.5 + 0.5 * Math.sin(now * (0.6 + (r.src.freq % 3) * 0.3) + r.src.freq)); }
      });
      list.sort((a, b) => b.w - a.w);
      const dom = list.length ? list[0].w : 0;
      this.dom = list[0] || null; this.list = list;
      // همگام‌سازی پخش‌کننده‌ها
      const want = new Set(list.map((r) => r.src.id));
      for (const id of [...this.players.keys()]) if (!want.has(id)) this.stopPlayer(id);
      list.forEach((r) => {
        if (!this.players.has(r.src.id)) {
          const gn = ctx.createGain(); gn.gain.value = 0; gn.connect(this.g.src);
          const srcSt = r.src; this.players.set(r.src.id, { pl: BZ.makePlayer(ctx, W.program(r.src.program), gn, { t0: W.time, quality: () => BZ.rf.strength(srcSt, W.env, W.isNight()), tag: 'radio' }), g: gn });
        }
        const p = this.players.get(r.src.id);
        let gain;
        if (this.band === 'FM') gain = Math.pow(r.w / Math.max(dom, 1e-6), 4) * Math.min(1, dom * 2.4); // اثر غلبه: ایستگاه قوی‌تر ضعیف‌تر را حذف می‌کند
        else gain = Math.min(1, r.w * 1.6) * 0.95; // AM/SW: ایستگاه‌ها روی هم می‌افتند
        if (this.band === 'FM' && dom < this.squelch) gain = 0;
        p.g.gain.setTargetAtTime(gain, T, 0.06);
      });
      // نویز: برف صوتی بسته به نبودِ سیگنال
      let nW = 0, nP = 0;
      const lack = 1 - Math.min(1, dom * 1.25);
      if (this.band === 'FM') { nW = Math.pow(lack, 2) * 0.5 + 0.004; if (dom < this.squelch) nW *= 0.05; }
      else { nP = (lack * 0.5 + 0.02 + env.noise * 0.1) * (this.band === 'SW' ? 1.25 : 1); nW = lack * 0.12; }
      if (this.tuning > 0.05) { nW += 0.14 * this.tuning; this.tuning *= 0.7; } else this.tuning = 0;
      this.g.nw.gain.setTargetAtTime(nW, T, 0.05); this.g.np.gain.setTargetAtTime(nP, T, 0.05);
      // سوت تداخل بین دو ایستگاه نزدیک
      let wh = 0;
      if (this.band !== 'FM' && list.length > 1) {
        const df = Math.abs(list[0].src.freq - list[1].src.freq) * (this.band === 'AM' ? 1000 : 1000000);
        if (df > 30 && df < 9000) { this.g.beat.frequency.setTargetAtTime(df, T, 0.05); wh = 0.07 * Math.min(list[0].w, list[1].w); }
      }
      this.g.bg.gain.setTargetAtTime(wh, T, 0.05);
      if (Math.random() < env.interference * dt * 3) this.pop();
      // استریو فقط روی FM قوی
      this.stereo = this.band === 'FM' && !!(this.dom && this.dom.src.stereo) && dom > 0.5;
      this.g.width.setWidth(this.stereo ? 1 : 0, 0.15);
      this.g.lp.frequency.setTargetAtTime(this.narrow ? B.lpN : B.lp, T, 0.05);
      this.g.vol.gain.setTargetAtTime(this.vol * this.vol * 0.9, T, 0.03);
      this.sig = dom;
      this.station = dom > 0.25 && list[0].df < bw * 0.9 ? list[0].src : null;
    }
  };

  // ---------- رابط گیرنده (برای رادیو مستقل و تیونر هایفای) ----------
  BZ.radioPanel = function (radio, opts) {
    opts = opts || {};
    let showStations = true, fine = false, saveMode = false;
    const freqEl = h('div', { class: 'r-freq' }), unitEl = h('span', { class: 'r-unit' });
    const nameEl = h('div', { class: 'r-name' });
    const bars = h('div', { class: 'r-bars' }, [0, 1, 2, 3, 4, 5, 6, 7].map(() => h('i')));
    const stLed = BZ.led('amber'), pwLed = BZ.led('red');
    const dial = BZ.cv(480, 92, 'r-dial');
    const dialWrap = h('div', { class: 'r-dialwrap', dir: 'ltr' }, dial);
    const g = dial.getContext('2d');

    function dialX(f) { const B = BANDS[radio.band]; return 14 + ((f - B.min) / (B.max - B.min)) * (dial.width - 28); }
    function dialF(x) { const B = BANDS[radio.band]; return B.min + ((x - 14) / (dial.width - 28)) * (B.max - B.min); }
    let drag = false;
    const ptr = (e) => { const r = dial.getBoundingClientRect(); radio.glide = null; radio.setFreq(dialF(((e.clientX - r.left) / r.width) * dial.width)); };
    dial.addEventListener('pointerdown', (e) => { drag = true; dial.setPointerCapture(e.pointerId); ptr(e); });
    dial.addEventListener('pointermove', (e) => { if (drag) ptr(e); });
    dial.addEventListener('pointerup', () => { drag = false; radio.save(); });

    function paintDial() {
      const B = BANDS[radio.band], W = dial.width, H = dial.height;
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f3e6c4'); bg.addColorStop(1, '#d9c490');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#2a1c0c'; g.fillStyle = '#2a1c0c'; g.lineWidth = 1; g.textAlign = 'center'; g.font = '11px sans-serif';
      const major = radio.band === 'AM' ? 100 : radio.band === 'FM' ? 2 : 1;
      const minor = radio.band === 'AM' ? 20 : radio.band === 'FM' ? 0.5 : 0.25;
      for (let v = Math.ceil(B.min / minor) * minor; v <= B.max; v += minor) {
        const x = dialX(v), isMaj = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        g.beginPath(); g.moveTo(x, 20); g.lineTo(x, isMaj ? 40 : 30); g.stroke();
        if (isMaj) g.fillText(radio.band === 'AM' ? String(Math.round(v)) : String(Math.round(v * 10) / 10), x, 54);
      }
      g.textAlign = 'left'; g.font = 'bold 11px sans-serif'; g.fillText(B.unit, 6, 14);
      if (showStations) {
        const env = BZ.world.env, night = BZ.world.isNight();
        BZ.world.stations.filter((s) => s.band === radio.band).forEach((s) => {
          const st = BZ.rf.strength(s, env, night), x = dialX(s.freq);
          g.fillStyle = st > 0.25 ? '#0a6a3a' : '#9a7a3a'; g.globalAlpha = 0.35 + st * 0.65;
          g.beginPath(); g.moveTo(x, 62); g.lineTo(x - 4, 72); g.lineTo(x + 4, 72); g.closePath(); g.fill(); g.globalAlpha = 1;
          if (st > 0.25) { g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(s.name.slice(0, 10), x, 83); }
        });
      }
      const nx = dialX(radio.freq[radio.band]);
      g.strokeStyle = radio.on ? '#d82020' : '#702020'; g.lineWidth = 2.5; g.shadowColor = '#f33'; g.shadowBlur = radio.on ? 8 : 0;
      g.beginPath(); g.moveTo(nx, 4); g.lineTo(nx, H - 4); g.stroke(); g.shadowBlur = 0;
    }

    const bandSeg = BZ.seg([{ v: 'AM', t: 'AM' }, { v: 'FM', t: 'FM' }, { v: 'SW', t: 'SW' }], radio.band, (b) => { radio.setBand(b); });
    const pw = BZ.toggle('⏻ روشن', radio.on, (v) => { if (v) BZ.audio.init(); radio.power(v); }, 'pw');
    const volK = BZ.knob({ label: 'بلندی', min: 0, max: 1, value: radio.vol, fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => { radio.vol = v; radio.save(); } });
    const toneK = BZ.knob({ label: 'زیر/بم', min: 0, max: 1, value: radio.tone, fmt: (v) => (v < 0.45 ? 'بم' : v > 0.55 ? 'زیر' : 'صاف'), onInput: (v) => { radio.tone = v; radio.applyTone(); radio.save(); } });
    const sqK = BZ.knob({ label: 'اسکوئلچ', min: 0, max: 0.5, value: radio.squelch, step: 0.01, fmt: (v) => (v ? v.toFixed(2) : 'خاموش'), onInput: (v) => { radio.squelch = v; radio.save(); } });
    const tuneK = BZ.knob({ label: 'تنظیم', min: 0, max: 1, value: 0.5, size: 64, horizontal: true, fmt: () => '', onInput: (v) => { radio.glide = null; const B = BANDS[radio.band]; radio.setFreq(radio.freq[radio.band] + (v - 0.5) * B.step * (fine ? 0.6 : 3)); tuneK.set(0.5); radio.save(); } });
    const narrowT = BZ.toggle('باند باریک', radio.narrow, (v) => { radio.narrow = v; radio.save(); });
    const fineT = BZ.toggle('ریز', false, (v) => { fine = v; });
    const showT = BZ.toggle('نمایش ایستگاه‌ها', true, (v) => { showStations = v; });
    const saveT = BZ.toggle('ذخیره', false, (v) => { saveMode = v; });
    const presetBtns = radio.presets.map((p, i) => BZ.btn(String(i + 1), () => {
      if (saveMode) { radio.presets[i] = { band: radio.band, f: radio.freq[radio.band] }; radio.save(); saveMode = false; saveT.set(false); BZ.toast('پیش‌تنظیم ' + (i + 1) + ' ذخیره شد'); return; }
      const q = radio.presets[i]; radio.setBand(q.band); bandSeg.set(q.band); radio.glide = { from: radio.freq[q.band], to: q.f, t0: performance.now(), dur: 500 };
    }, 'preset'));

    const root = h('div', { class: 'radio-body ' + (opts.compact ? 'compact' : '') },
      h('div', { class: 'r-top' },
        h('div', { class: 'r-grille' }, ...Array.from({ length: 9 }, () => h('i'))),
        h('div', { class: 'r-screen' },
          h('div', { class: 'r-row' }, pwLed, h('span', { class: 'r-tag' }, 'ON'), stLed, h('span', { class: 'r-tag' }, 'STEREO'), bars),
          h('div', { class: 'r-fline', dir: 'ltr' }, freqEl, unitEl), nameEl)),
      dialWrap,
      h('div', { class: 'r-ctrl' }, pw, bandSeg, BZ.btn('◀◀ جستجو', () => radio.seek(-1)), BZ.btn('جستجو ▶▶', () => radio.seek(1)), BZ.btn('◀', () => radio.stepBy(-1, fine), 'sm'), BZ.btn('▶', () => radio.stepBy(1, fine), 'sm'), fineT),
      h('div', { class: 'r-knobs' }, tuneK, volK, toneK, sqK),
      h('div', { class: 'r-ctrl' }, narrowT, showT, saveT, h('div', { class: 'presets' }, presetBtns)));

    root.paint = function (now) {
      radio.advanceGlide(now);
      const B = BANDS[radio.band];
      freqEl.textContent = radio.on ? B.fmt(radio.freq[radio.band]) : '—';
      unitEl.textContent = B.unit;
      const lvl = radio.on ? Math.round(radio.sig * 8) : 0;
      Array.from(bars.children).forEach((b, i) => b.classList.toggle('on', i < lvl));
      stLed.set(radio.on && radio.stereo); pwLed.set(radio.on);
      nameEl.textContent = !radio.on ? 'خاموش' : radio.station ? radio.station.name : radio.sig > 0.12 ? 'در حال تنظیم…' : 'فقط نویز';
      pw.set(radio.on); bandSeg.set(radio.band);
      paintDial();
    };
    return root;
  };
})();
