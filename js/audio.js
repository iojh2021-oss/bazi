/* audio.js — موتور صدا: تولیدکنندهٔ موسیقی قابل‌تکرار، سینتی‌سایزر، پخش‌کنندهٔ برنامه و گذرگاه‌های صوتی */
(function () {
  'use strict';
  const BZ = window.BZ;

  const SC = (BZ.SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    pent: [0, 2, 4, 7, 9], minpent: [0, 3, 5, 7, 10], chahargah: [0, 1, 4, 5, 7, 8, 11], homayun: [0, 1, 4, 5, 7, 8, 10],
  });
  BZ.SCALE_NAMES = { major: 'ماژور', minor: 'مینور', dorian: 'دُریان', pent: 'پنتاتونیک ماژور', minpent: 'پنتاتونیک مینور', chahargah: 'چهارگاه', homayun: 'همایون' };
  BZ.STYLE_NAMES = { ambient: 'آرام (امبینت)', pop: 'پاپ', jazz: 'جاز', classical: 'کلاسیک', electronic: 'الکترونیک', persian: 'سنتی ایرانی', talk: 'گفتار', tone: 'سیگنال آزمون' };

  const nt = (a, deg, oct) => {
    const s = SC[a.scale] || SC.major, n = s.length;
    return a.root + s[((deg % n) + n) % n] + 12 * (Math.floor(deg / n) + (oct || 0));
  };
  const CHORDS = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [5, 3, 0, 4], [0, 2, 5, 4], [0, 3, 0, 4]];

  // ---------- تولید یک میزان (۴ ضرب) — تابع خالص: همان seed و شمارهٔ میزان ⇒ همان نت‌ها ----------
  BZ.music = {
    bar(p, idx) {
      const a = p.audio, st = a.style;
      if (st === 'production') return [];
      const R = BZ.rng(BZ.hash(a.seed + ':' + idx));
      const PR = BZ.rng(BZ.hash(a.seed + ':p:' + (idx >> 3)));
      const prog = CHORDS[Math.floor(PR() * CHORDS.length)];
      const deg = prog[((idx % 4) + 4) % 4];
      const dn = a.density == null ? 0.6 : a.density;
      const ch = [nt(a, deg, 0), nt(a, deg + 2, 0), nt(a, deg + 4, 0)];
      const ev = [];
      const add = (o) => ev.push(o);
      if (st === 'ambient') {
        ch.forEach((m, i) => add({ b: 0, d: 4, m, v: 'pad', g: 0.15, pan: (i - 1) * 0.5 }));
        add({ b: 0, d: 4, m: ch[0] - 12, v: 'pad', g: 0.13, pan: 0 });
        for (let i = 0; i < 4; i++) if (R() < 0.15 + 0.35 * dn) add({ b: i + R() * 0.5, d: 3, m: nt(a, deg + Math.floor(R() * 7), 2), v: 'bell', g: 0.11, pan: R() * 2 - 1 });
      } else if (st === 'pop' || st === 'electronic') {
        const el = st === 'electronic';
        for (let i = 0; i < 4; i++) {
          if (el || i % 2 === 0) add({ b: i, k: 'kick', g: 0.9 });
          if (!el && i % 2 === 1) add({ b: i, k: 'snare', g: 0.5 });
          add({ b: i + 0.5, k: 'hat', g: el ? 0.2 : 0.16 });
          if (el && i % 2 === 1) add({ b: i, k: 'snare', g: 0.35 });
        }
        for (let i = 0; i < 8; i++) add({ b: i / 2, d: 0.42, m: ch[0] - 12 + (i % 4 === 3 ? 7 : 0), v: el ? 'acid' : 'bass', g: el ? 0.22 : 0.4 });
        ch.forEach((m, i) => add({ b: 0, d: 4, m, v: 'pad', g: 0.06, pan: (i - 1) * 0.6 }));
        const arp = [0, 2, 4, 2, 1, 3, 4, 5];
        for (let i = 0; i < 8; i++) if (R() < 0.45 + 0.5 * dn) add({ b: i / 2, d: 0.4, m: nt(a, deg + arp[i] + (R() < 0.2 ? 1 : 0), 1), v: el ? 'acid' : 'lead', g: el ? 0.13 : 0.14, pan: 0.3 });
      } else if (st === 'jazz') {
        const sw = 2 / 3;
        for (let i = 0; i < 4; i++) {
          add({ b: i, k: 'ride', g: 0.18 });
          if (i % 2 === 1) add({ b: i + sw, k: 'ride', g: 0.12 });
          add({ b: i, d: 0.9, m: nt(a, deg + [0, 2, 4, 5][i] + (R() < 0.3 ? 1 : 0), -1), v: 'bass', g: 0.42 });
        }
        if (R() < 0.8) ch.concat([nt(a, deg + 6, 0)]).forEach((m, i) => add({ b: R() < 0.5 ? 0 : 1.5, d: 1.2, m: m + 0, v: 'keys', g: 0.1, pan: (i - 1.5) * 0.3 }));
        for (let i = 0; i < 4; i++) if (R() < 0.3 + 0.5 * dn) add({ b: i + (R() < 0.4 ? sw : 0), d: 0.6, m: nt(a, deg + Math.floor(R() * 9) - 1, 1), v: 'lead', g: 0.14, pan: 0.25 });
      } else if (st === 'classical') {
        const alb = [0, 2, 1, 2];
        for (let i = 0; i < 8; i++) add({ b: i / 2, d: 0.55, m: ch[alb[i % 4]] - 12, v: 'keys', g: 0.13, pan: -0.2 });
        let b = 0;
        while (b < 4) { const d = R() < 0.5 ? 1 : R() < 0.5 ? 2 : 0.5; if (R() < 0.85) add({ b, d: d * 0.95, m: nt(a, deg + Math.floor(R() * 8) - 1, 1), v: 'lead', g: 0.15, pan: 0.2 }); b += d; }
      } else if (st === 'persian') {
        add({ b: 0, d: 4, m: ch[0] - 12, v: 'pad', g: 0.1, pan: -0.3 });
        add({ b: 0, d: 4, m: ch[0] - 5, v: 'pad', g: 0.06, pan: 0.3 });
        const pat = [['dum', 0], ['tak', 1], ['tak', 1.5], ['dum', 2], ['dum', 2.5], ['tak', 3]];
        pat.forEach(([k, b]) => add({ b, k: 'ton' + k, g: k === 'dum' ? 0.55 : 0.3 }));
        let b = 0;
        while (b < 4) {
          const d = R() < 0.55 ? 0.5 : R() < 0.5 ? 1 : 0.25;
          const m = nt(a, deg + Math.floor(R() * 7) - 1, 1);
          if (R() < 0.35 + 0.5 * dn) {
            if (R() < 0.3) add({ b: Math.max(0, b - 0.12), d: 0.12, m: m + 1, v: 'pluck', g: 0.1, pan: 0.2 });
            add({ b, d: d * 1.4, m, v: 'pluck', g: 0.22, pan: 0.2 });
          }
          b += d;
        }
      } else if (st === 'talk') {
        const f0 = (a.f0 || 120) * (0.94 + R() * 0.12);
        let b = R() * 0.3;
        while (b < 3.9) {
          if (R() < 0.12) { b += 0.4 + R() * 0.5; continue; } // مکث
          const d = 0.18 + R() * 0.3;
          add({ b, d, talk: 1, f0: f0 * (0.9 + R() * 0.3), f1: 320 + R() * 450, f2: 900 + R() * 1500, g: 0.5 + R() * 0.4 });
          b += d + 0.03;
        }
      } else if (st === 'tone') {
        add({ b: 0, d: 3.6, tone: idx % 2 === 0 ? 1000 : 440, g: 0.22 });
      }
      return ev;
    },
  };

  // ---------- سینتی‌سایزر ----------
  function adsr(gp, t, peak, a, dur, r) {
    const hold = t + Math.max(a, dur);
    gp.setValueAtTime(0.0001, t);
    gp.linearRampToValueAtTime(peak, t + a);
    gp.setValueAtTime(peak, hold);
    gp.exponentialRampToValueAtTime(0.0001, hold + r);
  }
  function outNode(ctx, g, dest, pan) {
    if (pan != null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = BZ.clamp(pan, -1, 1); g.connect(p); p.connect(dest);
    } else g.connect(dest);
  }
  function osc(ctx, type, f, t, end, dest, det) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (det) o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(end);
    return o;
  }
  function voice(ctx, dest, t, dur, f, o) {
    const g = ctx.createGain();
    let inp = g;
    if (o.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.connect(g); inp = lp; }
    outNode(ctx, g, dest, o.pan);
    adsr(g.gain, t, o.g, o.a, dur, o.r);
    const end = t + Math.max(o.a, dur) + o.r + 0.05;
    osc(ctx, o.type, f, t, end, inp, 0);
    if (o.type2) osc(ctx, o.type2, f * (o.mul || 1), t, end, inp, o.det || 0);
  }
  function noiseHit(ctx, dest, t, dur, ftype, freq, q, g, pan) {
    const s = ctx.createBufferSource(); s.buffer = BZ.audio.nbuf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q || 0.7;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); outNode(ctx, gn, dest, pan);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  BZ.synth = {
    play(ctx, dest, e, when, spb, rate) {
      const dur = (e.d || 0) * spb / rate, r = rate || 1;
      if (e.k) {
        const k = e.k, g = e.g || 0.5;
        if (k === 'kick' || k === 'tondum') {
          const o = ctx.createOscillator(), gn = ctx.createGain();
          const f0 = k === 'kick' ? 130 : 170, f1 = k === 'kick' ? 44 : 95;
          o.frequency.setValueAtTime(f0 * r, when); o.frequency.exponentialRampToValueAtTime(f1 * r, when + 0.12);
          gn.gain.setValueAtTime(g, when); gn.gain.exponentialRampToValueAtTime(0.0001, when + (k === 'kick' ? 0.32 : 0.22));
          o.connect(gn); gn.connect(dest); o.start(when); o.stop(when + 0.4);
        } else if (k === 'snare') { noiseHit(ctx, dest, when, 0.16, 'bandpass', 1900 * r, 0.8, g); const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 190 * r; gn.gain.setValueAtTime(g * 0.5, when); gn.gain.exponentialRampToValueAtTime(0.0001, when + 0.1); o.connect(gn); gn.connect(dest); o.start(when); o.stop(when + 0.15); }
        else if (k === 'hat') noiseHit(ctx, dest, when, 0.045, 'highpass', 7000, 0.7, g);
        else if (k === 'ride') noiseHit(ctx, dest, when, 0.28, 'highpass', 5200, 1.2, g);
        else if (k === 'tontak') noiseHit(ctx, dest, when, 0.07, 'bandpass', 3400 * r, 2.5, g);
        return;
      }
      if (e.talk) {
        const f = e.f0 * r, g = ctx.createGain(), end = when + dur + 0.05;
        g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(e.g * 0.35, when + dur * 0.25);
        g.gain.setValueAtTime(e.g * 0.3, when + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, end);
        g.connect(dest);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, when); o.frequency.linearRampToValueAtTime(f * (e.fe || 0.88), end);
        if (e.cons === 'f') noiseHit(ctx, dest, when, 0.1, 'highpass', 4800, 0.7, 0.16);
        else if (e.cons === 'p') noiseHit(ctx, dest, when, 0.035, 'bandpass', 1500, 1, 0.2);
        [[e.f1, 6, 1], [e.f2, 8, 0.6]].forEach(([fr, q, gain]) => {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
          const gg = ctx.createGain(); gg.gain.value = gain; o.connect(bp); bp.connect(gg); gg.connect(g);
        });
        o.start(when); o.stop(end);
        if (e.g > 0.7) noiseHit(ctx, dest, when, 0.06, 'highpass', 5000, 0.7, 0.05);
        return;
      }
      if (e.tone) {
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(e.g, when + 0.02);
        g.gain.setValueAtTime(e.g, when + dur); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.03);
        g.connect(dest); osc(ctx, 'sine', e.tone * r, when, when + dur + 0.05, g, 0);
        return;
      }
      const f = BZ.mtof(e.m) * r;
      switch (e.v) {
        case 'pad': voice(ctx, dest, when, dur, f, { type: 'sawtooth', type2: 'triangle', det: 7, g: e.g * 0.5, a: 0.7, r: 0.9, lp: 1100, pan: e.pan }); break;
        case 'bass': voice(ctx, dest, when, dur, f, { type: 'triangle', type2: 'sawtooth', g: e.g, a: 0.01, r: 0.12, lp: 700 }); break;
        case 'acid': voice(ctx, dest, when, dur, f, { type: 'sawtooth', g: e.g, a: 0.005, r: 0.08, lp: 1300, pan: e.pan }); break;
        case 'lead': voice(ctx, dest, when, dur, f, { type: 'triangle', type2: 'square', mul: 1, det: 5, g: e.g, a: 0.02, r: 0.18, lp: 3200, pan: e.pan }); break;
        case 'keys': voice(ctx, dest, when, Math.min(dur, 0.8), f, { type: 'triangle', type2: 'sine', mul: 2, g: e.g, a: 0.008, r: 0.5, pan: e.pan }); break;
        case 'pluck': voice(ctx, dest, when, 0.05, f, { type: 'triangle', type2: 'sawtooth', det: 3, g: e.g, a: 0.003, r: Math.max(0.25, dur * 0.8), lp: 2600, pan: e.pan }); break;
        case 'bell': voice(ctx, dest, when, 0.1, f, { type: 'sine', type2: 'sine', mul: 2.76, g: e.g, a: 0.005, r: 2.2, pan: e.pan }); break;
        default: break;
      }
    },
  };

  // ---------- پخش‌کنندهٔ برنامه: زمان محتوا (ثانیه) ← صدا ----------
  BZ.ProgramPlayer = class {
    constructor(ctx, prog, dest, opts) {
      opts = opts || {};
      this.ctx = ctx; this.p = prog; this.rate = opts.rate || 1; this.t0 = opts.t0 || 0; this.stream = opts.stream || null;
      this.out = ctx.createGain(); this.out.gain.value = 1; this.out.connect(dest);
      this.spb0 = 60 / prog.audio.bpm; this.barDur = 4 * this.spb0;
      this.ctxStart = ctx.currentTime + 0.06; this.nextBar = Math.floor(this.t0 / this.barDur + 1e-9); this.dead = false;
      this.tick();
      this.timer = setInterval(() => this.tick(), 90);
    }
    contentNow() { return this.t0 + (this.ctx.currentTime - this.ctxStart) * this.rate; }
    tick() {
      if (this.dead) return;
      const ctx = this.ctx, horizon = this.contentNow() + 1.3 * this.rate;
      while (this.nextBar * this.barDur < horizon) {
        const idx = this.nextBar, bs = idx * this.barDur;
        let evs;
        if (this.stream) {
          evs = this.stream.bar(idx);
          // بستهٔ صوتی هنوز نرسیده: صبر می‌کنیم؛ اگر زمانش گذشته باشد، افتِ بسته (قطع کوتاه صدا)
          if (!evs) { if (bs + this.barDur > this.contentNow() - 0.2) break; this.nextBar++; continue; }
        } else evs = BZ.music.bar(this.p, idx);
        this.nextBar++;
        for (const e of evs) {
          const when = this.ctxStart + (bs + e.b * this.spb0 - this.t0) / this.rate;
          if (when < ctx.currentTime - 0.02) continue;
          BZ.synth.play(ctx, this.out, e, when, this.spb0, this.rate);
        }
      }
    }
    stop() {
      if (this.dead) return;
      this.dead = true; clearInterval(this.timer);
      try { this.out.gain.cancelScheduledValues(0); this.out.gain.setValueAtTime(0, this.ctx.currentTime); this.out.disconnect(); } catch (e) { /* ignore */ }
    }
  };

  // ---------- موتور اصلی صدا ----------
  const A = (BZ.audio = {
    ctx: null, master: null, analyser: null, nbuf: null, pbuf: null, volume: 0.8, muted: false,
    available() { return !!(window.AudioContext || window.webkitAudioContext); },
    init() {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (A.ctx = new AC({ latencyHint: 'interactive' }));
      A.master = ctx.createGain(); A.master.gain.value = A.volume;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6;
      A.master.connect(comp); comp.connect(ctx.destination);
      A.analyser = ctx.createAnalyser(); A.analyser.fftSize = 2048; A.analyser.smoothingTimeConstant = 0.75;
      A.master.connect(A.analyser);
      const n = Math.max(1, Math.floor(ctx.sampleRate * 2));
      A.nbuf = ctx.createBuffer(1, n, ctx.sampleRate); A.pbuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const w = A.nbuf.getChannelData(0), p = A.pbuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 2 - 1; w[i] = x;
        b0 = 0.99765 * b0 + x * 0.099046; b1 = 0.963 * b1 + x * 0.2965164; b2 = 0.57 * b2 + x * 1.0526913;
        p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    },
    setVolume(v) { A.volume = v; if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : v, A.ctx.currentTime, 0.02); },
    setMuted(m) { A.muted = m; A.setVolume(A.volume); },
    // منبع نویز حلقه‌ای (white | pink)
    noiseLoop(kind) {
      const s = A.ctx.createBufferSource(); s.buffer = kind === 'pink' ? A.pbuf : A.nbuf; s.loop = true;
      s.start(0, Math.random() * 1.5); return s;
    },
    // مبدل عرض استریو: w=1 استریو، w=0 مونو
    makeWidth() {
      const ctx = A.ctx;
      const input = ctx.createGain(); input.channelCount = 2; input.channelCountMode = 'explicit'; input.channelInterpretation = 'speakers';
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      input.connect(split);
      const g = {};
      [['LL', 0, 0], ['LR', 1, 0], ['RL', 0, 1], ['RR', 1, 1]].forEach(([n, from, to]) => {
        g[n] = ctx.createGain(); split.connect(g[n], from); g[n].connect(merge, 0, to);
      });
      const o = { input, output: merge, setWidth(w, t) { const tc = t || 0.05, T = ctx.currentTime; g.LL.gain.setTargetAtTime((1 + w) / 2, T, tc); g.RR.gain.setTargetAtTime((1 + w) / 2, T, tc); g.LR.gain.setTargetAtTime((1 - w) / 2, T, tc); g.RL.gain.setTargetAtTime((1 - w) / 2, T, tc); } };
      o.setWidth(1, 0.001);
      return o;
    },
    // پاسخ ضربهٔ اتاق برای واکنش‌گرا (reverb)
    makeImpulse(sec, decay) {
      const ctx = A.ctx, n = Math.max(1, Math.floor(ctx.sampleRate * sec));
      const b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
      return b;
    },
    // بلندگوی یک دستگاه: به مستر وصل می‌شود
    speaker() {
      const g = A.ctx.createGain(); g.gain.value = 1; g.connect(A.master); return g;
    },
  });
})();
